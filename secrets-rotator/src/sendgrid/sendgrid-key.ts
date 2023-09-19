import client from "@sendgrid/client";
import { SendGridSourceAction } from "../types";
import castTo from "../utils/cast-to";

type GetSendGridApiKeyResponse = {
  name: string;
  // eslint-disable-next-line camelcase
  api_key_id: string;
};

type GetAllSendGridApiKeysResponse = {
  result: GetSendGridApiKeyResponse[];
};

type CreateSendGridApiKeyResponse = {
  name: string;
  // eslint-disable-next-line camelcase
  api_key_id: string;
  // eslint-disable-next-line camelcase
  api_key: string;
  scopes: string[];
};

async function getApiKeyInfo(apiKeyName: string) {
  try {
    console.info(`Getting sendgrid api-key info by name ${apiKeyName}.`);
    const [response] = await client.request({
      method: "GET",
      url: "/v3/api_keys",
    });
    const apiKeys = castTo<GetAllSendGridApiKeysResponse>(response.body).result;
    const apiKey = apiKeys.find((key) => key.name === apiKeyName);
    if (!apiKey) {
      const errorMessage = `sendgrid api-key with name ${apiKeyName} does not exists.`;
      console.info(errorMessage);
      // noinspection ExceptionCaughtLocallyJS
      throw new Error(errorMessage);
    }
    console.info("Successfully fetched sendgrid api-key info.");
    return apiKey;
  } catch (error) {
    console.info("Failed to fetch sendgrid api-key info.");
    throw error;
  }
}

async function createApiKey(apiKeyName: string) {
  try {
    console.info(`Creating sendgrid api-key with name ${apiKeyName}.`);
    const [response] = await client.request({
      body: {
        name: apiKeyName,
      },
      method: "POST",
      url: "/v3/api_keys",
    });
    console.info("Successfully created sendgrid api-key.");
    return castTo<CreateSendGridApiKeyResponse>(response.body);
  } catch (error) {
    console.info("Failed to create sendgrid api-key.");
    throw error;
  }
}

async function deleteApiKey(apiKeyId: string) {
  try {
    console.info(`Deleted sendgrid api-key with id ${apiKeyId}.`);
    await client.request({
      method: "DELETE",
      url: `/v3/api_keys/${apiKeyId}`,
    });
    console.info("Successfully deleted sendgrid api-key.");
  } catch (error) {
    console.info("Failed to delete sendgrid api-key.");
    throw error;
  }
}

export const rotateSendGridApiKey = async (config: SendGridSourceAction) => {
  try {
    console.info("Started rotating sendgrid api-key.");
    client.setApiKey(config.authentication.apiKey);
    const { api_key_id: apiKeyId } = await getApiKeyInfo(config.apiKeyName);
    const newSendGridApiKey = (await createApiKey(config.apiKeyName)).api_key;
    await deleteApiKey(apiKeyId);
    console.info("Completed rotating sendgrid api-key.");
    return newSendGridApiKey;
  } catch (error) {
    console.info("Failed to rotate sendgrid api-key.");
    throw error;
  }
};
