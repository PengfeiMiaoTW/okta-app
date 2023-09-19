import { AwsGatewayApiKeyConsumerAction, AwsGatewayApiKeySourceAction, Password } from "../types";
import {
  APIGatewayClient,
  CreateApiKeyCommand,
  CreateApiKeyCommandOutput,
  CreateUsagePlanKeyCommand,
  DeleteApiKeyCommand,
  GetApiKeysCommand,
  GetUsagePlanKeysCommand,
  UsagePlanKeys,
} from "@aws-sdk/client-api-gateway";
import { ApiKey, UsagePlanKey } from "@aws-sdk/client-api-gateway/dist-types/models/models_0";
import moment from "moment";
import { iif } from "../utils/functions";


export async function rotateAWSGatewayApiKey(
  config: AwsGatewayApiKeySourceAction | AwsGatewayApiKeyConsumerAction,
  password?: Password,
) {
  try {
    let createApiKeyResponse: CreateApiKeyCommandOutput;
    console.info("Initializing the api gateway client");
    const apiGatewayClient = new APIGatewayClient({
      region: config.region,
      credentials: config.authentication?.credentials,
    });
    console.info("Successfully initialized the api gateway client");
    await getUsagePlanApiKeysAndDeleteTheOldestIfRequired(apiGatewayClient, config);
    await iif(async function createNewApiKeyAndAddToUsagePlan() {
      createApiKeyResponse = await createApiKey(apiGatewayClient, password);
      console.info("Successfully created a new api key");
      console.info("Started adding newly created api key to the usage plan");
      await apiGatewayClient.send(
        new CreateUsagePlanKeyCommand({
          usagePlanId: config.usagePlanId,
          keyId: createApiKeyResponse.id,
          keyType: "API_KEY",
        },
        ));
      console.info("Successfully added the newly created api key to the usage plan");
    });
    return createApiKeyResponse.value;
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    console.info(`Error while rotating the api key in api gateway. Error Message:${error.message}`);
    throw error;
  }
}

async function getUsagePlanApiKeysAndDeleteTheOldestIfRequired(
  apiGatewayClient: APIGatewayClient, config: AwsGatewayApiKeySourceAction | AwsGatewayApiKeyConsumerAction,
) {
  let usagePlanKeys: UsagePlanKeys;
  try {
    console.info("Fetching the existing api keys in usage plan");
    usagePlanKeys = await apiGatewayClient.send(
      new GetUsagePlanKeysCommand({
        usagePlanId: config.usagePlanId,
      },
      ));
    console.info("Successfully fetched the existing usage plan api keys");
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    console.info(`Error while fetching the existing api keys in usage plan. Error Message:${error.message}`);
    throw error;
  }
  if (usagePlanKeys.items.length > 1) {
    console.info("Fetching oldest api key in usage plan");
    const oldestAPIKeyId = await getOldestUsagePlanAPIKeyId(apiGatewayClient, usagePlanKeys.items);
    console.info("Successfully fetched the oldest api key in usage plan");
    console.info("Started deleting the oldest api key");
    await deleteAWSGatewayAPIKey(apiGatewayClient, oldestAPIKeyId);
    console.info("Successfully deleted the oldest api key");
  }
}

async function createApiKey(apiGatewayClient: APIGatewayClient, password?: Password) {
  console.info("Started creating a new api key in enabled state");
  return apiGatewayClient.send(
    new CreateApiKeyCommand({
      name: `aws_gateway_api_key_${moment().format("YYYY-MM-DD HH:mm:ss")}`,
      value: password,
      enabled: true,
    },
    ));
}

async function getOldestUsagePlanAPIKeyId(apiGatewayClient: APIGatewayClient, usagePlanKeys: UsagePlanKey[]) {
  try {
    console.info("Fetching the api keys");
    const apiKeys = await apiGatewayClient.send(
      new GetApiKeysCommand({
        includeValues: false,
      }),
    );
    console.info("Successfully fetched the api keys");
    const usagePlanKeysWithCreatedDate = apiKeys.items.filter((apiKey) => usagePlanKeys.some((usagePlanKey) => usagePlanKey.id === apiKey.id));
    return usagePlanKeysWithCreatedDate.reduce((result, apiKey) => result?.createdDate < apiKey.createdDate ? result : apiKey, null).id;
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    console.info(`Error while fetching the api keys. Error Message:${error.message}`);
    throw error;
  }
}

async function deleteAWSGatewayAPIKey(apiGatewayClient: APIGatewayClient, oldestAPIKeyId: ApiKey["id"]) {
  try {
    await apiGatewayClient.send(
      new DeleteApiKeyCommand({
        apiKey: oldestAPIKeyId,
      },
      ));
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    console.info(`Error while deleting oldest api key. Error Message:${error.message}`);
    throw error;
  }
}


