import { iif } from "../../../src/utils/functions";
import {
  mockAWSAPIGatewayClient,
  mockAWSCreateApiKeyCommand,
  mockAWSCreateUsagePlanKeyCommand,
  mockAWSDeleteApiKeyCommand,
  mockAWSGetApiKeysCommand,
  mockAWSGetUsagePlanKeysCommand,
} from "../../test-helpers/mocks";
import { runSecretRotation } from "../../../src/rotator";
import { assertAPIGatewayClientCallsNotMade, assertAPIGatewayClientSendRequests } from "../../test-helpers/request";
import {
  CreateApiKeyCommand,
  CreateUsagePlanKeyCommand,
  DeleteApiKeyCommand,
  GetApiKeysCommand,
  GetUsagePlanKeysCommand,
} from "@aws-sdk/client-api-gateway";

const usagePlanId = "sample-usage-plan";
const apiId = "api123";
const region = "sample-region";
const hashKey = "test-hash-key";
const sourceName = "Test API consumer client secret rotation";
const restApiId = "sample-rest-api-id";
const stageNameDev = "dev";
const stageNameQa = "qa";
const oldApiId = "old-api-id";
const latestApiId = "latest-api-id";

beforeEach(() => {
  iif(function setupEnv() {
    process.env = {
      ...process.env,
      SOURCE_NAME: sourceName,
      HASH_KEY: hashKey,
      USAGE_PLAN_ID: usagePlanId,
      REGION: region,
      REST_API_ID: restApiId,
      STAGE_NAME_DEV: stageNameDev,
      STAGE_NAME_QA: stageNameQa,
    };
  });
  jest.useFakeTimers();
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

const mockTimeStamp = "2023-03-11 07:12:22";
const newToken = "wgfdhgdjgfs345637EFSRETVNSBDJWBMFMD32t4ydfshfeydjghfdg";
jest.mock("moment", () => () => ({
  format: () => mockTimeStamp,
}));
jest.mock("generate-password", () => ({
  generate: jest.fn(() => newToken),
}));

describe("AWS API gateway api key Rotation", () => {
  describe("success scenarios", () => {
    describe("should not delete any key if usage plan contains only one api key", () => {
      describe("should successfully create a new api key in enabled state", () => {
        it("should add the new api key to usage plan", async () => {
          const { mockAPIGatewayClient } = mockAWSAPIGatewayClient();
          mockAWSGetUsagePlanKeysCommand({
            mockAPIGatewayClient,
            mockResponse: {
              items: [
                {
                  id: oldApiId,
                  type: "API_KEY",
                  value: "sample-secret-value",
                  name: "sample-api-name",
                },
              ],
            },
          });
          mockAWSCreateApiKeyCommand({
            mockAPIGatewayClient,
            mockResponse: {
              id: apiId,
              value: newToken,
              name: `aws_gateway_api_key_${mockTimeStamp}`,
              enabled: true,
              createdDate: new Date(mockTimeStamp),
            },
          });
          mockAWSCreateUsagePlanKeyCommand({
            mockAPIGatewayClient,
            mockResponse: {
              id: apiId,
              type: "API_KEY",
              value: newToken,
              name: `aws_gateway_api_key_${mockTimeStamp}`,
            },
          });
          mockAWSDeleteApiKeyCommand({
            mockAPIGatewayClient,
          });

          await runSecretRotation("./tests/integration/aws/mock-configs/aws-api-gateway-api-key-rotation-config.json");

          assertAPIGatewayClientSendRequests({
            mockAPIGatewayClient,
            sendRequestsInputFields: [
              {
                usagePlanId,
              },
              {
                value: newToken,
                enabled: true,
                name: `aws_gateway_api_key_${mockTimeStamp}`,
              },
              {
                usagePlanId,
                keyId: apiId,
                keyType: "API_KEY",
              },
            ],
          });
          assertAPIGatewayClientCallsNotMade({
            mockAPIGatewayClient,
            command: DeleteApiKeyCommand,
          });
        });
      });

      describe("should successfully create a new api key with autogenerated api key value in enabled state", () => {
        it("should add the new api key to usage plan", async () => {
          const { mockAPIGatewayClient } = mockAWSAPIGatewayClient();
          mockAWSGetUsagePlanKeysCommand({
            mockAPIGatewayClient,
            mockResponse: {
              items: [
                {
                  id: oldApiId,
                  type: "API_KEY",
                  value: "sample-secret-value",
                  name: "sample-api-name",
                },
              ],
            },
          });
          mockAWSCreateApiKeyCommand({
            mockAPIGatewayClient,
            mockResponse: {
              id: apiId,
              value: newToken,
              name: `aws_gateway_api_key_${mockTimeStamp}`,
              enabled: true,
              createdDate: new Date(mockTimeStamp),
            },
          });
          mockAWSCreateUsagePlanKeyCommand({
            mockAPIGatewayClient,
            mockResponse: {
              id: apiId,
              type: "API_KEY",
              value: newToken,
              name: `aws_gateway_api_key_${mockTimeStamp}`,
            },
          });
          mockAWSDeleteApiKeyCommand({
            mockAPIGatewayClient,
          });

          await runSecretRotation("./tests/integration/aws/mock-configs/aws-api-gateway-api-key-rotation-config-as-source-action.json");

          assertAPIGatewayClientSendRequests({
            mockAPIGatewayClient,
            sendRequestsInputFields: [
              {
                usagePlanId,
              },
              {
                enabled: true,
                name: `aws_gateway_api_key_${mockTimeStamp}`,
              },
              {
                usagePlanId,
                keyId: apiId,
                keyType: "API_KEY",
              },
            ],
          });
          assertAPIGatewayClientCallsNotMade({
            mockAPIGatewayClient,
            command: DeleteApiKeyCommand,
          });
        });
      });
    });

    describe("should delete the oldest key if usage plan contains more than one api key", () => {
      describe("should successfully create new api key in enabled state", () => {
        it("should add the new api key to usage plan", async () => {
          const { mockAPIGatewayClient } = mockAWSAPIGatewayClient();
          mockAWSGetUsagePlanKeysCommand({
            mockAPIGatewayClient,
            mockResponse: {
              items: [
                {
                  id: oldApiId,
                  type: "API_KEY",
                  value: "sample-old-secret-value",
                  name: "sample-old-api-name",
                },
                {
                  id: latestApiId,
                  type: "API_KEY",
                  value: "sample-latest-secret-value",
                  name: "sample-latest-api-name",
                },
              ],
            },
          });
          mockAWSGetApiKeysCommand({
            mockAPIGatewayClient,
            mockResponse: {
              items: [
                {
                  id: oldApiId,
                  name: "sample-old-api-name",
                  createdDate: new Date("2023-03-11 07:12:22"),
                },
                {
                  id: latestApiId,
                  name: "sample-latest-api-name",
                  createdDate: new Date("2023-06-11 07:12:22"),
                },
                {
                  id: "sample-api-id",
                  name: "sample-api-name",
                  createdDate: new Date("2023-06-23 07:12:22"),
                },
              ],
            },
          });
          mockAWSCreateApiKeyCommand({
            mockAPIGatewayClient,
            mockResponse: {
              id: apiId,
              value: newToken,
              name: `aws_gateway_api_key_${mockTimeStamp}`,
              enabled: true,
              createdDate: new Date(mockTimeStamp),
            },
          });
          mockAWSCreateUsagePlanKeyCommand({
            mockAPIGatewayClient,
            mockResponse: {
              id: apiId,
              type: "API_KEY",
              value: newToken,
              name: `aws_gateway_api_key_${mockTimeStamp}`,
            },
          });
          mockAWSDeleteApiKeyCommand({
            mockAPIGatewayClient,
          });

          await runSecretRotation("./tests/integration/aws/mock-configs/aws-api-gateway-api-key-rotation-config.json");

          assertAPIGatewayClientSendRequests({
            mockAPIGatewayClient,
            sendRequestsInputFields: [
              {
                usagePlanId,
              },
              {
                includeValues: false,
              },
              {
                apiKey: oldApiId,
              },
              {
                value: newToken,
                enabled: true,
                name: `aws_gateway_api_key_${mockTimeStamp}`,
              },
              {
                usagePlanId,
                keyId: apiId,
                keyType: "API_KEY",
              },
            ],
          });
        });
      });

      describe("should successfully create new api key with autogenerated api key value in enabled state", () => {
        it("should add the new api key to usage plan", async () => {
          const { mockAPIGatewayClient } = mockAWSAPIGatewayClient();
          mockAWSGetUsagePlanKeysCommand({
            mockAPIGatewayClient,
            mockResponse: {
              items: [
                {
                  id: oldApiId,
                  type: "API_KEY",
                  value: "sample-old-secret-value",
                  name: "sample-old-api-name",
                },
                {
                  id: latestApiId,
                  type: "API_KEY",
                  value: "sample-latest-secret-value",
                  name: "sample-latest-api-name",
                },
              ],
            },
          });
          mockAWSGetApiKeysCommand({
            mockAPIGatewayClient,
            mockResponse: {
              items: [
                {
                  id: oldApiId,
                  name: "sample-old-api-name",
                  createdDate: new Date("2023-03-11 07:12:22"),
                },
                {
                  id: latestApiId,
                  name: "sample-latest-api-name",
                  createdDate: new Date("2023-06-11 07:12:22"),
                },
                {
                  id: "sample-api-id",
                  name: "sample-api-name",
                  createdDate: new Date("2023-06-23 07:12:22"),
                },
              ],
            },
          });
          mockAWSCreateApiKeyCommand({
            mockAPIGatewayClient,
            mockResponse: {
              id: apiId,
              value: newToken,
              name: `aws_gateway_api_key_${mockTimeStamp}`,
              enabled: true,
              createdDate: new Date(mockTimeStamp),
            },
          });
          mockAWSCreateUsagePlanKeyCommand({
            mockAPIGatewayClient,
            mockResponse: {
              id: apiId,
              type: "API_KEY",
              value: newToken,
              name: `aws_gateway_api_key_${mockTimeStamp}`,
            },
          });
          mockAWSDeleteApiKeyCommand({
            mockAPIGatewayClient,
          });

          await runSecretRotation("./tests/integration/aws/mock-configs/aws-api-gateway-api-key-rotation-config-as-source-action.json");

          assertAPIGatewayClientSendRequests({
            mockAPIGatewayClient,
            sendRequestsInputFields: [
              {
                usagePlanId,
              },
              {
                includeValues: false,
              },
              {
                apiKey: oldApiId,
              },
              {
                enabled: true,
                name: `aws_gateway_api_key_${mockTimeStamp}`,
              },
              {
                usagePlanId,
                keyId: apiId,
                keyType: "API_KEY",
              },
            ],
          });
        });
      });
    });
  });

  describe("error scenarios", () => {
    it("should throw an error when there is some failure while fetching the usage plan api keys.", async () => {
      const { mockAPIGatewayClient } = mockAWSAPIGatewayClient();
      mockAPIGatewayClient.on(GetUsagePlanKeysCommand)
        .rejects(new Error("Error while fetching the existing api keys in usage plan"));

      await expect(runSecretRotation("./tests/integration/aws/mock-configs/aws-api-gateway-api-key-rotation-config.json"))
        .rejects
        .toThrow("Error while fetching the existing api keys in usage plan");
    });

    it("should throw an error when there is some failure while fetching the api keys.", async () => {
      const { mockAPIGatewayClient } = mockAWSAPIGatewayClient();
      mockAWSGetUsagePlanKeysCommand({
        mockAPIGatewayClient,
        mockResponse: {
          items: [
            {
              id: oldApiId,
              type: "API_KEY",
              value: "sample-old-secret-value",
              name: "sample-old-api-name",
            },
            {
              id: latestApiId,
              type: "API_KEY",
              value: "sample-latest-secret-value",
              name: "sample-latest-api-name",
            },
          ],
        },
      });
      mockAPIGatewayClient.on(GetApiKeysCommand)
        .rejects(new Error("Error while fetching api keys"));

      await expect(runSecretRotation("./tests/integration/aws/mock-configs/aws-api-gateway-api-key-rotation-config.json"))
        .rejects.toThrow("Error while fetching api keys");
    });

    it("should throw an error when there is some failure while deleting the oldest api key.", async () => {
      const { mockAPIGatewayClient } = mockAWSAPIGatewayClient();
      mockAWSGetUsagePlanKeysCommand({
        mockAPIGatewayClient,
        mockResponse: {
          items: [
            {
              id: oldApiId,
              type: "API_KEY",
              value: "sample-old-secret-value",
              name: "sample-old-api-name",
            },
            {
              id: latestApiId,
              type: "API_KEY",
              value: "sample-latest-secret-value",
              name: "sample-latest-api-name",
            },
          ],
        },
      });
      mockAWSGetApiKeysCommand({
        mockAPIGatewayClient,
        mockResponse: {
          items: [
            {
              id: oldApiId,
              name: "sample-old-api-name",
              createdDate: new Date("2023-03-11 07:12:22"),
            },
            {
              id: latestApiId,
              name: "sample-latest-api-name",
              createdDate: new Date("2023-06-11 07:12:22"),
            },
            {
              id: "sample-api-ID",
              name: "sample-api-name",
              createdDate: new Date("2023-06-23 07:12:22"),
            },
          ],
        },
      });
      mockAPIGatewayClient.on(DeleteApiKeyCommand)
        .rejects(new Error("Error while deleting oldest api key"));

      await expect(runSecretRotation("./tests/integration/aws/mock-configs/aws-api-gateway-api-key-rotation-config.json"))
        .rejects.toThrow("Error while deleting oldest api key");
    });

    it("should throw an error when there is some failure while creating the new api key.", async () => {
      const { mockAPIGatewayClient } = mockAWSAPIGatewayClient();
      mockAWSGetUsagePlanKeysCommand({
        mockAPIGatewayClient,
        mockResponse: {
          items: [
            {
              id: oldApiId,
              type: "API_KEY",
              value: "sample-old-secret-value",
              name: "sample-old-api-name",
            },
          ],
        },
      });
      mockAPIGatewayClient.on(CreateApiKeyCommand)
        .rejects(new Error("Error while creating the new api key"));

      await expect(runSecretRotation("./tests/integration/aws/mock-configs/aws-api-gateway-api-key-rotation-config.json"))
        .rejects.toThrow("Error while creating the new api key");
    });

    it("should throw an error when there is some failure while adding the new api key to the usage plan.", async () => {
      const { mockAPIGatewayClient } = mockAWSAPIGatewayClient();
      mockAWSGetUsagePlanKeysCommand({
        mockAPIGatewayClient,
        mockResponse: {
          items: [
            {
              id: oldApiId,
              type: "API_KEY",
              value: "sample-old-secret-value",
              name: "sample-old-api-name",
            },
          ],
        },
      });
      mockAWSCreateApiKeyCommand({
        mockAPIGatewayClient,
        mockResponse: {
          id: apiId,
          value: newToken,
          name: `aws_gateway_api_key_${mockTimeStamp}`,
          enabled: true,
          createdDate: new Date(mockTimeStamp),
        },
      });
      mockAPIGatewayClient.on(CreateUsagePlanKeyCommand)
        .rejects(new Error("Error while adding the new api key to the usage plan"));

      await expect(runSecretRotation("./tests/integration/aws/mock-configs/aws-api-gateway-api-key-rotation-config.json"))
        .rejects.toThrow("Error while adding the new api key to the usage plan");
    });
  });
});

