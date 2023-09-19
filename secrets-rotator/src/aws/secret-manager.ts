import { AwsSecretManagerConsumerAction, AwsSecretManagerSourceAction, Password } from "../types";
import { GetSecretValueCommand, SecretsManagerClient, UpdateSecretCommand } from "@aws-sdk/client-secrets-manager";
import _ from "lodash";

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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const existingValue: string[] = keyFieldName
      ? _.get(JSON.parse(existingSecret), keyFieldName)
      : JSON.parse(existingSecret);
    if (!Array.isArray(existingValue)) {
      throw new TypeError("Existing secret is not an array");
    }
    existingValue.shift();
    existingValue.push(password);
    return existingValue;
  }
  return password;
}

export async function rotateSecretsInAWSSecretManager(config: AwsSecretManagerSourceAction | AwsSecretManagerConsumerAction, password: Password) {
  try {
    let newSecret: string | string[];
    console.info("Initializing the secret manager client");
    const secretManagerClient = new SecretsManagerClient({
      region: config.region,
      credentials: config.authentication?.credentials,
    });
    console.info("Fetching the existing secret from secret manager");
    let existingSecret = (await secretManagerClient.send(
      new GetSecretValueCommand({
        SecretId: config.secretId,
      },
      ))).SecretString;
    console.info("Successfully fetched the existing secret from secret manager");
    if (config.keyFieldNames) {
      config.keyFieldNames.map((secretDetail) => {
        console.info(`Started updating secret of "${secretDetail.keyFieldName}" field in secret manager`);
        const newKeyFieldValue = getLatestFieldValueBasedOnFieldType({
          existingSecret,
          password,
          isValueArray: secretDetail.isValueArray,
          keyFieldName: secretDetail.keyFieldName,
        });
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        existingSecret = JSON.stringify(_.update(
          JSON.parse(existingSecret),
          secretDetail.keyFieldName,
          () => newKeyFieldValue,
        ));
      });
      newSecret = existingSecret;
    } else {
      const newKeyFieldValue = getLatestFieldValueBasedOnFieldType({
        existingSecret,
        password,
        isValueArray: config.isValueArray,
        keyFieldName: config.keyFieldName,
      });
      if (config.keyFieldName) {
        console.info(`Started updating secret of "${config.keyFieldName}" field in secret manager`);
        newSecret = JSON.stringify(_.update(JSON.parse(existingSecret), config.keyFieldName, () => newKeyFieldValue));
      } else {
        newSecret = newKeyFieldValue;
      }
    }
    await secretManagerClient.send(
      new UpdateSecretCommand({
        SecretId: config.secretId,
        SecretString: typeof newSecret === "string" ? newSecret : JSON.stringify(newSecret),
      },
      ));
    console.info("Secrets updated successfully in secret manager");
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    console.info(`Error while updating the secret of the field ${config.keyFieldName} in secret manager. Error Message:${error.message}`);
    throw error;
  }
}

