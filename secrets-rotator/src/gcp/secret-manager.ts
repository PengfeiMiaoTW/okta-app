import { GcpSecretManagerConsumerAction, GcpSecretManagerSourceAction, Password } from "../types";
import _ from "lodash";
import { SecretManagerServiceClient } from "@google-cloud/secret-manager";
import { createBufferForSecretManager } from "../utils/secret-manager";
import { getGoogleAuthCredentials } from "./authorization";

async function accessLatestSecretVersion(client: SecretManagerServiceClient, secretName: string) {
  try {
    console.info(`Fetching latest version of ${secretName}.`);
    const [version] = await client.accessSecretVersion({
      name: `${secretName}/versions/latest`,
    });
    console.info("Successfully fetched secrets.");
    return ({
      name: version.name,
      payload: version.payload.data.toString(),
    });
  } catch (error) {
    console.info("Failed to fetch secrets.");
    throw error;
  }
}

async function disableSecretVersion(client: SecretManagerServiceClient, secretNameWithVersion: string) {
  try {
    console.info(`Disabling ${secretNameWithVersion} secret version.`);
    await client.disableSecretVersion({
      name: secretNameWithVersion,
    });
    console.info("Successfully disabled secret version.");
  } catch (error) {
    console.info("Failed to disabled secret version.");
    throw error;
  }
}

function getLatestFieldValueBasedOnFieldType(
  options: {
    existingSecret: string;
    password: Password;
    isValueArray?: boolean;
    keyFieldName?: string;
  },
) {
  const { existingSecret, password, isValueArray, keyFieldName } = options;
  if (isValueArray) {
    const existingValue: string[] = keyFieldName
      ? _.get(JSON.parse(existingSecret), keyFieldName)
      : JSON.parse(existingSecret);
    if (!Array.isArray(existingValue)) {
      throw Error("Existing secret is not an array");
    }
    existingValue.shift();
    existingValue.push(password);
    return existingValue;
  }
  return password;
}

export async function rotateSecretsInSecretManager(config: GcpSecretManagerSourceAction | GcpSecretManagerConsumerAction, password: Password) {
  try {
    const client = new SecretManagerServiceClient({
      projectId: config.projectId,
      credentials: config.authentication?.credentials && getGoogleAuthCredentials(config.authentication?.credentials),
    });
    const secretName = `projects/${config.projectId}/secrets/${config.secretName}`;
    let newSecret: string | string[];
    let {
      name: existingSecretNameWithVersion,
      payload: existingSecret,
    } = await accessLatestSecretVersion(client, secretName);
    if (config.keyFieldNames) {
      config.keyFieldNames.map((secretDetails) => {
          console.info(`Started updating secret of "${secretDetails.keyFieldName}" field in secret manager`);
          const newKeyFieldValue = getLatestFieldValueBasedOnFieldType({
            existingSecret,
            password,
            isValueArray: secretDetails.isValueArray,
            keyFieldName: secretDetails.keyFieldName,
          });
          existingSecret = JSON.stringify(_.update(JSON.parse(existingSecret), secretDetails.keyFieldName, () => newKeyFieldValue));
        },
      );
      newSecret = existingSecret;
    } else {
      const newKeyFieldValue = await getLatestFieldValueBasedOnFieldType({
        existingSecret,
        password,
        isValueArray: config.isValueArray,
        keyFieldName: config.keyFieldName,
      });
      if (config.keyFieldName) {
        console.info(`Started updating secret of "${config.keyFieldName}" field in secret manager`);
        newSecret = _.update(JSON.parse(existingSecret), config.keyFieldName, () => newKeyFieldValue);
      } else {
        newSecret = newKeyFieldValue;
      }
    }
    await client.addSecretVersion({
      parent: secretName,
      payload: {
        data: createBufferForSecretManager(newSecret),
      },
    });
    await disableSecretVersion(client, existingSecretNameWithVersion);
    console.info("Secrets updated successfully in secret manager");
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    console.info(`Error while updating the secret of the field ${config.keyFieldName} in secret manager. Error Message:${error.message}`);
    throw error;
  }
}

