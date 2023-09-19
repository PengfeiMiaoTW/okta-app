import {
  ApiClientSecretAction,
  ApiConsumerAction,
  ApiPlatformApiServiceTokenConsumerAction,
  ApiSourceAction,
  AwsGatewayApiKeyConsumerAction,
  AwsGatewayApiKeySourceAction,
  AwsSecretManagerConsumerAction,
  ConsumerAction,
  ConsumerActionType,
  EventSubscriptionTokenConsumerAction,
  GcpSecretManagerConsumerAction,
  GCPServiceAccountKeySourceAction,
  Password,
  SecretConsumer,
  SecretRotationConfig,
  SecretSource,
  SendGridSourceAction,
  SourceAction,
  SourceActionType,
} from "./types";
import { rotatePostgresDbPassword as rotatePostgresDatabasePassword } from "./gcp/db-password-rotator";
import { generate } from "generate-password";
import { rotateSecretsInSecretManager } from "./gcp/secret-manager";
import {
  rotateClientSecretByApiCall,
  rotateConsumerSecretByApiCall,
  rotateSourceSecretByApiCall,
} from "./api/api-action";
import { rotateSendGridApiKey } from "./sendgrid/sendgrid-key";
import { rotateServiceAccount } from "./gcp/service-account";
import { reportFileLogger } from "./logger";
import castTo, { identity } from "./utils/cast-to";
import { promises as fs } from "fs";
import { decryptedReportFileName, encryptedReportFileName, outputFileName } from "./data";
import { iif } from "./utils/functions";
import { decrypt, encrypt } from "./utils/encrypt";
import { rotateApiPlatformApiServiceToken } from "./api-platform/api-service-token";
import { redeploy } from "./circleci/redeploy";
import { rotateEventSubscriptionToken } from "./event-platform/event-subscription-token";
import { validateConfigFileSchema } from "./utils/validate-schema";
import { rotateSecretsInAWSSecretManager } from "./aws/secret-manager";
import { rotateAWSGatewayApiKey } from "./aws/api-gateway-api-key";

async function generatePasswordAndPerformSecretRotation(
  source: SecretSource,
  handlerFunction: (config: SourceAction | ConsumerAction, password: Password) => Promise<void>,
) {
  const password = await generatePassword(source.passwordConfig);
  console.info("Password generated successfully");
  await handlerFunction(source.action, password);
  return password;
}

async function generatePassword(passwordConfig: SecretSource["passwordConfig"]) {
  return generate(passwordConfig);
}

async function performSourceAction(source: SecretSource): Promise<Password> {
  try {
    console.info(`Rotation of source secret for "${source.name}" started`);
    const sourceActionHandlerMap: { [actionType in SourceActionType]: () => Promise<Password> } = {
      [SourceActionType.GCP_POSTGRES_DATABASE]: () => generatePasswordAndPerformSecretRotation(source, rotatePostgresDatabasePassword),
      [SourceActionType.API]: () => rotateSourceSecretByApiCall(castTo<ApiSourceAction>(source.action)),
      [SourceActionType.API_PLATFORM_CLIENT_SECRET]: () => rotateClientSecretByApiCall(castTo<ApiClientSecretAction>(source.action)),
      [SourceActionType.API_PLATFORM_API_SERVICE_TOKEN]: () => generatePasswordAndPerformSecretRotation(source, rotateApiPlatformApiServiceToken),
      [SourceActionType.SENDGRID]: () => rotateSendGridApiKey(castTo<SendGridSourceAction>(source.action)),
      [SourceActionType.GCP_SERVICE_ACCOUNT_KEY]: () => rotateServiceAccount(castTo<GCPServiceAccountKeySourceAction>(source.action)),
      [SourceActionType.GCP_SECRET_MANAGER]: () => generatePasswordAndPerformSecretRotation(source, rotateSecretsInSecretManager),
      [SourceActionType.AWS_SECRET_MANAGER]: () => generatePasswordAndPerformSecretRotation(source, rotateSecretsInAWSSecretManager),
      [SourceActionType.AWS_GATEWAY_API_KEY]: () => rotateAWSGatewayApiKey(castTo<AwsGatewayApiKeySourceAction>(source.action)),
      [SourceActionType.GENERATE_PASSWORD]: () => generatePassword(source.passwordConfig),
    };
    const password = await sourceActionHandlerMap[source.action.type]();
    console.info(`Successfully rotated secret in source for "${source.name}"`);
    reportFileLogger.appendText(`New secret value for "${source.name}": ${password}`);
    return password;
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    console.info(`Failed to rotate source secret for "${source.name}". Error Message: ${error.message}`);
    throw error;
  }
}

async function performConsumerAction(consumer: SecretConsumer, password: Password) {
  try {
    console.info(`Rotation of secret for consumer: "${consumer.name}" started`);
    const consumerActionHandlerMap: { [actionType in ConsumerActionType]: () => Promise<unknown> } = {
      [ConsumerActionType.GCP_SECRET_MANAGER]: () => rotateSecretsInSecretManager(castTo<GcpSecretManagerConsumerAction>(consumer.action), password),
      [ConsumerActionType.API]: () => rotateConsumerSecretByApiCall(castTo<ApiConsumerAction>(consumer.action), password),
      [ConsumerActionType.API_PLATFORM_API_SERVICE_TOKEN]: () => rotateApiPlatformApiServiceToken(
        castTo<ApiPlatformApiServiceTokenConsumerAction>(consumer.action),
        password,
      ),
      [ConsumerActionType.EVENT_SUBSCRIPTION_TOKEN]: () => rotateEventSubscriptionToken(
        castTo<EventSubscriptionTokenConsumerAction>(consumer.action),
        password,
      ), [ConsumerActionType.AWS_SECRET_MANAGER]: () => rotateSecretsInAWSSecretManager(
        castTo<AwsSecretManagerConsumerAction>(consumer.action),
        password,
      ), [ConsumerActionType.AWS_GATEWAY_API_KEY]: () => rotateAWSGatewayApiKey(
        castTo<AwsGatewayApiKeyConsumerAction>(consumer.action),
        password,
      ),
    };
    await consumerActionHandlerMap[consumer.action.type]();
    console.info(`Successfully rotated secret of consumer: "${consumer.name}"`);
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    console.info(`Failed to rotate secret of consumer: "${consumer.name}". Error Message: ${error.message}`);
    throw error;
  }
}

export async function rotateSecrets(config: SecretRotationConfig) {
  try {
    const { source, consumers } = config;
    const password = await performSourceAction(source);
    for (const consumer of consumers) {
      await performConsumerAction(consumer, password);
      if (consumer.redeploy) {
        Array.isArray(consumer.redeploy)
          ? consumer.redeploy.map(async (redeployConfig) => {
            await redeploy(redeployConfig);
          })
          : await redeploy(consumer.redeploy);
      }
    }
  } catch (error) {
    console.info("Failed to rotate secret");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    console.error(error.message);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    throw new Error(error.message);
  }
}

export function substituteEnvironmentVariables(json: string) {
  const ENV_PATTERN = /\${([\w-_]*)}/gm;
  let matchersResult;
  let resultedJson = json;
  while ((matchersResult = ENV_PATTERN.exec(json)) !== null) {
    const [textToReplace, envVariableName] = matchersResult;
    // eslint-disable-next-line security/detect-object-injection
    if (!process.env[envVariableName]) {
      const errorMessage = `Environment variable: ${envVariableName} mentioned in config has no value.`;
      console.info(errorMessage);
      throw new Error(errorMessage);
    }
    // eslint-disable-next-line security/detect-object-injection
    resultedJson = resultedJson.replace(textToReplace, process.env[envVariableName]);
  }
  return resultedJson;
}

export function validateIfHashKeyEnvironmentVariableIsPresent() {
  const hashKeyEnvVariableName = "HASH_KEY";
  // eslint-disable-next-line security/detect-object-injection
  if (!process.env[hashKeyEnvVariableName]) {
    const errorMessage = `Environment variable: ${hashKeyEnvVariableName} needed for secret rotation is not present.`;
    console.info(errorMessage);
    throw new Error(errorMessage);
  }
}

async function readJsonFile(filePath: string) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  return fs.readFile(filePath, "utf8");
}

export async function getConfigData(filePath: string) {
  try {
    console.info("Started to read config file.");
    const jsonDataAsString = await readJsonFile(filePath);
    const config = identity<SecretRotationConfig>(JSON.parse(substituteEnvironmentVariables(jsonDataAsString)));
    console.info("Successfully read config file.");
    return config;
  } catch (error) {
    console.info("Failed to read config json file.");
    throw error;
  }
}

export async function runSecretRotation(configFilePath: string) {
  try {
    console.info("Started running secret rotation.");
    validateIfHashKeyEnvironmentVariableIsPresent();
    const config = await getConfigData(configFilePath);
    await validateConfigFileSchema(configFilePath);
    await rotateSecrets(config);
    console.info("Secret rotation completed.");
  } catch (error) {
    reportFileLogger.appendError("Failed to rotate secrets", error);
    throw error;
  } finally {
    console.info("Generating report file.");
    await iif(async function generateEncryptedReportFile() {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      const fileInBufferFormat = await fs.readFile(outputFileName);
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      await fs.writeFile(encryptedReportFileName, encrypt(fileInBufferFormat));
    });
    await iif(async function removeTemporaryReportFile() {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      await fs.unlink(outputFileName);
    });
    console.info("Report file generated successfully.");
  }
}

export async function decryptEncryptedReportFile(encryptedReportFilePath: string) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const fileContent = await fs.readFile(encryptedReportFilePath);
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  await fs.writeFile(decryptedReportFileName, decrypt(fileContent).toString());
}
