import { decryptEncryptedReportFile, runSecretRotation } from "../../../src/rotator";
import { iif } from "../../../src/utils/functions";
import {
  mockGCPSecretManager,
  mockGetJobDetailsWithJobNumber,
  mockGetWorkflowJobsApiCall,
  mockRerunCircleCiWorkflowApiCall,
} from "../../test-helpers/mocks";
import * as QueryString from "querystring";
import { getCredentialsForBasicAuth } from "../../../src/utils/api";
import "jest-extended";
import { createBufferForSecretManager } from "../../../src/utils/secret-manager";
import { assertApiRequest, mockAxios } from "../../test-helpers/request";
import {
  assertContentsInDecryptedReportFile,
  assertContentsInEncryptedReportFile,
  assertIfTemporaryReportFileIsRemoved,
} from "../../test-helpers/files";
import { encryptedReportFileName } from "../../../src/data";
import { JobStatus } from "../../../src/circleci/types";
import { validateConfigFileSchema } from "../../../src/utils/validate-schema";

const apiPlatformApiName = "application-service";
const apiId = "8982";
const oktaUrlToGenerateAccessTokenForApiGateway = "http://okta.com/access-token-from-client-id-client-secret";
const apiPlatformBaseUrl = "http://api-platform-base-url";
const apiPlatformUrlToGetApiIdForPublishedApi = `${apiPlatformBaseUrl}/publisher/apis/`;
const apiPlatformUrlToUpdateApiToken = `${apiPlatformBaseUrl}/publisher/apis/${apiId}/plugins/request-transformer`;
const apiPlatformConsumerClientId = "test-consumer-client-id";
const apiPlatformConsumerClientSecret = "test-consumer-client-secret";
const latestApiServiceToken = "latest-api-token";
const gcpProjectId = "12310283";
const gcpSecretName = "test-secret-name";
const oktaAccessTokenToApiGateway = "test-access-token";
const apiPlatformAccessTokenGrantType = "test-grant";
const apiPlatformAccessTokenScope = "test-scope";
const gcloudKey = "ewogICJwcml2YXRlX2tleSI6ICIiLAogICJjbGllbnRfZW1haWwiOiAiIgp9Cg==";
const hashKey = "test-hash-key";
const sourceName = "Generate Password";
const oldApiServiceToken = "old-api-token";
const currentApiServiceToken = "current-api-token";
const workflowId1 = "workflow-000001";
const jobId1 = "job-000001";
const newWorkflowId1 = "workflow-000002";
const projectSlug1 = "test-slug";
const reRunJobNumber1 = 5503;
const jobName1 = "deploy";
const workflowId2 = "workflow-000001";
const jobId2 = "job-000001";
const newWorkflowId2 = "workflow-000002";
const projectSlug2 = "test-slug";
const reRunJobNumber2 = 5503;
const jobName2 = "deploy";
const circleCIAccessToken = "test-token";


jest.mock("generate-password", () => ({
  generate: jest.fn().mockReturnValue("latest-api-token"),
}));

beforeEach(() => {
  iif(function setupEnv() {
    process.env = {
      ...process.env,
      SOURCE_NAME: sourceName,
      HASH_KEY: hashKey,
      API_PLATFORM_API_NAME: apiPlatformApiName,
      API_PLATFORM_TOKEN_URL: oktaUrlToGenerateAccessTokenForApiGateway,
      API_PLATFORM_URL: apiPlatformBaseUrl,
      API_PLATFORM_CLIENT_ID: apiPlatformConsumerClientId,
      API_PLATFORM_CLIENT_SECRET: apiPlatformConsumerClientSecret,
      API_PLATFORM_ACCESS_TOKEN_GRANT_TYPE: apiPlatformAccessTokenGrantType,
      API_PLATFORM_ACCESS_TOKEN_SCOPE: apiPlatformAccessTokenScope,
      GCP_PROJECT_ID: gcpProjectId,
      GCP_SECRET_NAME: gcpSecretName,
      GCLOUD_KEY: gcloudKey,
      WORKFLOW_ID: workflowId1,
      JOB_ID: jobId1,
      WORKFLOW_ID_SERVICE_TWO: workflowId1,
      JOB_ID_SERVICE_TWO: jobId1,
      CIRCLE_CI_ACCESS_TOKEN: circleCIAccessToken,
    };
  });
  jest.useFakeTimers();
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe("API platform x-api-key rotation", () => {
  describe("should generate the new x-api-key using the password config", () => {
    it("should update it in secret manager consumers with Json format and in api platform", async () => {
      const existingSecret = {
        apiPlatform: {
          apiToken: [oldApiServiceToken, currentApiServiceToken],
          serviceToken: currentApiServiceToken,
        },
      };
      const expectedSecretAfterUpdatingTheFirstSecretManagerConsumer = {
        apiPlatform: {
          apiToken: [currentApiServiceToken, latestApiServiceToken],
          serviceToken: currentApiServiceToken,
        },
      };
      const expectedSecretAfterUpdatingTheSecondSecretManagerConsumer = {
        apiPlatform: {
          apiToken: [currentApiServiceToken, latestApiServiceToken],
          serviceToken: latestApiServiceToken,
        },
      };
      const secretManagerPath = `projects/${gcpProjectId}/secrets/${gcpSecretName}`;
      const expectedContentToBeAddedInReportFile = `New secret value for "${sourceName}": ${latestApiServiceToken}\n`;
      const mockedAxiosInstance = mockAxios();
      mockedAxiosInstance
        .onPost(oktaUrlToGenerateAccessTokenForApiGateway)
        .reply(
          200,
          {
            // eslint-disable-next-line camelcase
            access_token: oktaAccessTokenToApiGateway,
          },
        );
      mockedAxiosInstance
        .onGet(apiPlatformUrlToGetApiIdForPublishedApi)
        .reply(
          200,
          {
            result: [
              { name: "Test api", id: "5176" },
              { name: apiPlatformApiName, id: apiId },
              { name: "Demo app", id: "2349" },
            ],
          },
        );
      mockedAxiosInstance
        .onPut(apiPlatformUrlToUpdateApiToken)
        .reply(200, { data: {} });
      const { mockAccessSecretVersion, mockAddSecretVersion, mockDisableSecretVersion } = mockGCPSecretManager();
      mockAccessSecretVersion.mockResolvedValueOnce([{
        name: `${secretManagerPath}/48`,
        payload: {
          data: createBufferForSecretManager(existingSecret),
        },
      }]);
      mockAddSecretVersion.mockResolvedValueOnce([{
        name: `${secretManagerPath}/49`,
        payload: {
          data: createBufferForSecretManager(expectedSecretAfterUpdatingTheFirstSecretManagerConsumer),
        },
      }]);
      mockDisableSecretVersion.mockResolvedValueOnce([{
        name: `${secretManagerPath}/48`,
      }]);
      mockAccessSecretVersion.mockResolvedValueOnce([{
        name: `${secretManagerPath}/49`,
        payload: {
          data: createBufferForSecretManager(expectedSecretAfterUpdatingTheFirstSecretManagerConsumer),
        },
      }]);
      mockAddSecretVersion.mockResolvedValueOnce([{
        name: `${secretManagerPath}/50`,
        payload: {
          data: createBufferForSecretManager(expectedSecretAfterUpdatingTheSecondSecretManagerConsumer),
        },
      }]);
      mockDisableSecretVersion.mockResolvedValueOnce([{
        name: `${secretManagerPath}/49`,
      }]);
      jest.spyOn(global, "setTimeout");
      mockRerunCircleCiWorkflowApiCall(mockedAxiosInstance, workflowId1, jobId1, newWorkflowId1);
      mockGetWorkflowJobsApiCall({
        mockedAxiosInstance,
        workflowId: workflowId1,
        jobId: jobId1,
        projectSlug: projectSlug1,
        jobName: jobName1,
      });
      mockGetWorkflowJobsApiCall({
        mockedAxiosInstance,
        workflowId: newWorkflowId1,
        jobNumber: reRunJobNumber1,
        projectSlug: projectSlug1,
        jobName: jobName1,
      });
      mockGetJobDetailsWithJobNumber(mockedAxiosInstance, {
        status: JobStatus.success,
        jobNumber: reRunJobNumber1,
        workFlowId: newWorkflowId1,
        projectSlug: projectSlug1,
      });

      await runSecretRotation("./tests/integration/gcp/mock-configs/api-platform-api-token-rotation-config-for-secrets-in-json-format.json");

      iif(function assertSecretsAreRotatedInSecretManager() {
        expect(mockAddSecretVersion).toBeCalledTimes(2);
        expect(mockAddSecretVersion.mock.calls).toEqual([
          [{
            parent: secretManagerPath,
            payload: {
              data: createBufferForSecretManager(expectedSecretAfterUpdatingTheFirstSecretManagerConsumer),
            },
          }],
          [{
            parent: secretManagerPath,
            payload: {
              data: createBufferForSecretManager(expectedSecretAfterUpdatingTheSecondSecretManagerConsumer),
            },
          }],
        ]);
        expect(mockDisableSecretVersion).toBeCalledTimes(2);
        expect(mockDisableSecretVersion.mock.calls).toEqual([
          [{
            name: `${secretManagerPath}/48`,
          }],
          [{
            name: `${secretManagerPath}/49`,
          }],
        ]);
      });
      expect(setTimeout).toHaveBeenCalledTimes(0);
      iif(function assertApiCallToGenerateAccessTokenForApiGateway() {
        assertApiRequest(
          mockedAxiosInstance,
          {
            url: oktaUrlToGenerateAccessTokenForApiGateway,
            data: QueryString.stringify({
              // eslint-disable-next-line camelcase
              grant_type: apiPlatformAccessTokenGrantType,
              scope: apiPlatformAccessTokenScope,
            }),
            headers: {
              Authorization: `Basic ${getCredentialsForBasicAuth({
                userName: apiPlatformConsumerClientId,
                password: apiPlatformConsumerClientSecret,
              })}`,
            },
            method: "post",
          },
        );
      });
      iif(function assertApiTokenIsUpdatedInApiPlatform() {
        assertApiRequest(
          mockedAxiosInstance,
          {
            url: apiPlatformUrlToGetApiIdForPublishedApi,
            headers: {
              Authorization: `Bearer ${oktaAccessTokenToApiGateway}`,
            },
            method: "get",
          },
        );
        assertApiRequest(
          mockedAxiosInstance,
          {
            url: apiPlatformUrlToUpdateApiToken,
            data: JSON.stringify({
              config: {
                append: {
                  headers: [`x-api-key:${latestApiServiceToken}`],
                },
              },
              type: "request-transformer",
            }),
            headers: {
              Authorization: `Bearer ${oktaAccessTokenToApiGateway}`,
            },
            method: "put",
          },
        );
      });
      iif(function assertCircleCiApiCalls() {
        assertApiRequest(
          mockedAxiosInstance,
          {
            url: `https://circleci.com/api/v2/workflow/${workflowId1}/rerun`,
            method: "post",
            data: JSON.stringify({
              jobs: [jobId1],
            }),
            headers: {
              "Circle-Token": circleCIAccessToken,
              "Content-Type": "application/json",
            },
          },
        );
        assertApiRequest(
          mockedAxiosInstance,
          {
            url: `https://circleci.com/api/v2/workflow/${workflowId1}/job`,
            method: "get",
            headers: {
              "Circle-Token": circleCIAccessToken,
              "Content-Type": "application/json",
            },
          },
        );
        assertApiRequest(
          mockedAxiosInstance,
          {
            url: `https://circleci.com/api/v2/workflow/${newWorkflowId1}/job`,
            method: "get",
            headers: {
              "Circle-Token": circleCIAccessToken,
              "Content-Type": "application/json",
            },
          },
        );
        assertApiRequest(
          mockedAxiosInstance,
          {
            url: `https://circleci.com/api/v2/project/${projectSlug1}/job/${reRunJobNumber1}`,
            method: "get",
            headers: {
              "Circle-Token": circleCIAccessToken,
            },
          },
        );
      });
      await assertContentsInEncryptedReportFile(expectedContentToBeAddedInReportFile);
      await assertIfTemporaryReportFileIsRemoved();
      await decryptEncryptedReportFile(encryptedReportFileName);
      await assertContentsInDecryptedReportFile(expectedContentToBeAddedInReportFile);
    });
    it("should update it in secret manager consumers with Json format and in api platform when config file has keyFieldNames array", async () => {
      const existingSecret = {
        apiPlatform: {
          apiToken: [oldApiServiceToken, currentApiServiceToken],
          serviceToken: currentApiServiceToken,
        },
      };
      const expectedSecretAfterUpdatingTheSecretManagerConsumer = {
        apiPlatform: {
          apiToken: [currentApiServiceToken, latestApiServiceToken],
          serviceToken: latestApiServiceToken,
        },
      };
      const secretManagerPath = `projects/${gcpProjectId}/secrets/${gcpSecretName}`;
      const expectedContentToBeAddedInReportFile = `New secret value for "${sourceName}": ${latestApiServiceToken}\n`;
      const mockedAxiosInstance = mockAxios();
      mockedAxiosInstance
        .onPost(oktaUrlToGenerateAccessTokenForApiGateway)
        .reply(
          200,
          {
            // eslint-disable-next-line camelcase
            access_token: oktaAccessTokenToApiGateway,
          },
        );
      mockedAxiosInstance
        .onGet(apiPlatformUrlToGetApiIdForPublishedApi)
        .reply(
          200,
          {
            result: [
              { name: "Test api", id: "5176" },
              { name: apiPlatformApiName, id: apiId },
              { name: "Demo app", id: "2349" },
            ],
          },
        );
      mockedAxiosInstance
        .onPut(apiPlatformUrlToUpdateApiToken)
        .reply(200, { data: {} });
      const { mockAccessSecretVersion, mockAddSecretVersion, mockDisableSecretVersion } = mockGCPSecretManager();
      mockAccessSecretVersion.mockResolvedValueOnce([{
        name: `${secretManagerPath}/48`,
        payload: {
          data: createBufferForSecretManager(existingSecret),
        },
      }]);
      mockAddSecretVersion.mockResolvedValueOnce([{
        name: `${secretManagerPath}/49`,
        payload: {
          data: createBufferForSecretManager(expectedSecretAfterUpdatingTheSecretManagerConsumer),
        },
      }]);
      mockDisableSecretVersion.mockResolvedValueOnce([{
        name: `${secretManagerPath}/48`,
      }]);
      jest.spyOn(global, "setTimeout");
      mockRerunCircleCiWorkflowApiCall(mockedAxiosInstance, workflowId1, jobId1, newWorkflowId1);
      mockGetWorkflowJobsApiCall({
        mockedAxiosInstance,
        workflowId: workflowId1,
        jobId: jobId1,
        projectSlug: projectSlug1,
        jobName: jobName1,
      });
      mockGetWorkflowJobsApiCall({
        mockedAxiosInstance,
        workflowId: newWorkflowId1,
        jobNumber: reRunJobNumber1,
        projectSlug: projectSlug1,
        jobName: jobName1,
      });
      mockGetJobDetailsWithJobNumber(mockedAxiosInstance, {
        status: JobStatus.success,
        jobNumber: reRunJobNumber1,
        workFlowId: newWorkflowId1,
        projectSlug: projectSlug1,
      });

      await runSecretRotation("./tests/integration/gcp/mock-configs/api-platform-api-token-rotation-config-for-secrets-with-keyFieldNames-in-json-format.json");

      iif(function assertSecretsAreRotatedInSecretManager() {
        expect(mockAddSecretVersion).toBeCalledTimes(1);
        expect(mockAddSecretVersion.mock.calls).toEqual([
          [{
            parent: secretManagerPath,
            payload: {
              data: createBufferForSecretManager(expectedSecretAfterUpdatingTheSecretManagerConsumer),
            },
          }],
        ]);
        expect(mockDisableSecretVersion).toBeCalledTimes(1);
        expect(mockDisableSecretVersion.mock.calls).toEqual([
          [{
            name: `${secretManagerPath}/48`,
          }],
        ]);
      });
      expect(setTimeout).toHaveBeenCalledTimes(0);
      iif(function assertApiCallToGenerateAccessTokenForApiGateway() {
        assertApiRequest(
          mockedAxiosInstance,
          {
            url: oktaUrlToGenerateAccessTokenForApiGateway,
            data: QueryString.stringify({
              // eslint-disable-next-line camelcase
              grant_type: apiPlatformAccessTokenGrantType,
              scope: apiPlatformAccessTokenScope,
            }),
            headers: {
              Authorization: `Basic ${getCredentialsForBasicAuth({
                userName: apiPlatformConsumerClientId,
                password: apiPlatformConsumerClientSecret,
              })}`,
            },
            method: "post",
          },
        );
      });
      iif(function assertApiTokenIsUpdatedInApiPlatform() {
        assertApiRequest(
          mockedAxiosInstance,
          {
            url: apiPlatformUrlToGetApiIdForPublishedApi,
            headers: {
              Authorization: `Bearer ${oktaAccessTokenToApiGateway}`,
            },
            method: "get",
          },
        );
        assertApiRequest(
          mockedAxiosInstance,
          {
            url: apiPlatformUrlToUpdateApiToken,
            data: JSON.stringify({
              config: {
                append: {
                  headers: [`x-api-key:${latestApiServiceToken}`],
                },
              },
              type: "request-transformer",
            }),
            headers: {
              Authorization: `Bearer ${oktaAccessTokenToApiGateway}`,
            },
            method: "put",
          },
        );
      });
      iif(function assertCircleCiApiCalls() {
        assertApiRequest(
          mockedAxiosInstance,
          {
            url: `https://circleci.com/api/v2/workflow/${workflowId1}/rerun`,
            method: "post",
            data: JSON.stringify({
              jobs: [jobId1],
            }),
            headers: {
              "Circle-Token": circleCIAccessToken,
              "Content-Type": "application/json",
            },
          },
        );
        assertApiRequest(
          mockedAxiosInstance,
          {
            url: `https://circleci.com/api/v2/workflow/${workflowId1}/job`,
            method: "get",
            headers: {
              "Circle-Token": circleCIAccessToken,
              "Content-Type": "application/json",
            },
          },
        );
        assertApiRequest(
          mockedAxiosInstance,
          {
            url: `https://circleci.com/api/v2/workflow/${newWorkflowId1}/job`,
            method: "get",
            headers: {
              "Circle-Token": circleCIAccessToken,
              "Content-Type": "application/json",
            },
          },
        );
        assertApiRequest(
          mockedAxiosInstance,
          {
            url: `https://circleci.com/api/v2/project/${projectSlug1}/job/${reRunJobNumber1}`,
            method: "get",
            headers: {
              "Circle-Token": circleCIAccessToken,
            },
          },
        );
      });
      await assertContentsInEncryptedReportFile(expectedContentToBeAddedInReportFile);
      await assertIfTemporaryReportFileIsRemoved();
      await decryptEncryptedReportFile(encryptedReportFileName);
      await assertContentsInDecryptedReportFile(expectedContentToBeAddedInReportFile);
    });
    it("should update it in secret manager consumers with text format and in api platform", async () => {
      const existingSecret = [oldApiServiceToken, currentApiServiceToken];
      const expectedSecretAfterUpdatingTheSecretManager = [currentApiServiceToken, latestApiServiceToken];
      const secretManagerPath = `projects/${gcpProjectId}/secrets/${gcpSecretName}`;
      const expectedContentToBeAddedInReportFile = `New secret value for "${sourceName}": ${latestApiServiceToken}\n`;
      const mockedAxiosInstance = mockAxios();
      mockedAxiosInstance
        .onPost(oktaUrlToGenerateAccessTokenForApiGateway)
        .reply(
          200,
          {
            // eslint-disable-next-line camelcase
            access_token: oktaAccessTokenToApiGateway,
          },
        );
      mockedAxiosInstance
        .onGet(apiPlatformUrlToGetApiIdForPublishedApi)
        .reply(
          200,
          {
            result: [
              { name: "Test api", id: "5176" },
              { name: apiPlatformApiName, id: apiId },
              { name: "Demo app", id: "2349" },
            ],
          },
        );
      mockedAxiosInstance
        .onPut(apiPlatformUrlToUpdateApiToken)
        .reply(200, { data: {} });
      const { mockAccessSecretVersion, mockAddSecretVersion, mockDisableSecretVersion } = mockGCPSecretManager();
      mockAccessSecretVersion.mockResolvedValue([{
        name: `${secretManagerPath}/48`,
        payload: {
          data: createBufferForSecretManager(existingSecret),
        },
      }]);
      mockAddSecretVersion.mockResolvedValue([{
        name: `${secretManagerPath}/49`,
        payload: {
          data: createBufferForSecretManager(expectedSecretAfterUpdatingTheSecretManager),
        },
      }]);
      mockDisableSecretVersion.mockResolvedValue([{
        name: `${secretManagerPath}/48`,
      }]);
      jest.spyOn(global, "setTimeout");
      mockRerunCircleCiWorkflowApiCall(mockedAxiosInstance, workflowId1, jobId1, newWorkflowId1);
      mockGetWorkflowJobsApiCall({
        mockedAxiosInstance,
        workflowId: workflowId1,
        jobId: jobId1,
        projectSlug: projectSlug1,
        jobName: jobName1,
      });
      mockGetWorkflowJobsApiCall({
        mockedAxiosInstance,
        workflowId: newWorkflowId1,
        jobNumber: reRunJobNumber1,
        projectSlug: projectSlug1,
        jobName: jobName1,
      });
      mockGetJobDetailsWithJobNumber(mockedAxiosInstance, {
        status: JobStatus.success,
        jobNumber: reRunJobNumber1,
        workFlowId: newWorkflowId1,
        projectSlug: projectSlug1,
      });

      await validateConfigFileSchema("./tests/integration/gcp/mock-configs/api-platform-api-token-rotation-config-for-secrets-in-json-format.json");
      await runSecretRotation("./tests/integration/gcp/mock-configs/api-platform-api-token-rotation-config-for-secrets-in-plain-text-format.json");

      iif(function assertSecretsAreRotatedInSecretManager() {
        expect(mockAddSecretVersion).toBeCalledTimes(1);
        expect(mockAddSecretVersion.mock.calls).toEqual([
          [{
            parent: secretManagerPath,
            payload: {
              data: createBufferForSecretManager(expectedSecretAfterUpdatingTheSecretManager),
            },
          }],
        ]);
        expect(mockDisableSecretVersion).toBeCalledTimes(1);
        expect(mockDisableSecretVersion.mock.calls).toEqual([
          [{
            name: `${secretManagerPath}/48`,
          }],
        ]);
      });
      expect(setTimeout).toHaveBeenCalledTimes(0);
      iif(function assertApiCallToGenerateAccessTokenForApiGateway() {
        assertApiRequest(
          mockedAxiosInstance,
          {
            url: oktaUrlToGenerateAccessTokenForApiGateway,
            data: QueryString.stringify({
              // eslint-disable-next-line camelcase
              grant_type: apiPlatformAccessTokenGrantType,
              scope: apiPlatformAccessTokenScope,
            }),
            headers: {
              Authorization: `Basic ${getCredentialsForBasicAuth({
                userName: apiPlatformConsumerClientId,
                password: apiPlatformConsumerClientSecret,
              })}`,
            },
            method: "post",
          },
        );
      });
      iif(function assertApiTokenIsUpdatedInApiPlatform() {
        assertApiRequest(
          mockedAxiosInstance,
          {
            url: apiPlatformUrlToGetApiIdForPublishedApi,
            headers: {
              Authorization: `Bearer ${oktaAccessTokenToApiGateway}`,
            },
            method: "get",
          },
        );
        assertApiRequest(
          mockedAxiosInstance,
          {
            url: apiPlatformUrlToUpdateApiToken,
            data: JSON.stringify({
              config: {
                append: {
                  headers: [`x-api-key:${latestApiServiceToken}`],
                },
              },
              type: "request-transformer",
            }),
            headers: {
              Authorization: `Bearer ${oktaAccessTokenToApiGateway}`,
            },
            method: "put",
          },
        );
      });
      iif(function assertCircleCiApiCalls() {
        assertApiRequest(
          mockedAxiosInstance,
          {
            url: `https://circleci.com/api/v2/workflow/${workflowId1}/rerun`,
            method: "post",
            data: JSON.stringify({
              jobs: [jobId1],
            }),
            headers: {
              "Circle-Token": circleCIAccessToken,
              "Content-Type": "application/json",
            },
          },
        );
        assertApiRequest(
          mockedAxiosInstance,
          {
            url: `https://circleci.com/api/v2/workflow/${workflowId1}/job`,
            method: "get",
            headers: {
              "Circle-Token": circleCIAccessToken,
              "Content-Type": "application/json",
            },
          },
        );
        assertApiRequest(
          mockedAxiosInstance,
          {
            url: `https://circleci.com/api/v2/workflow/${newWorkflowId1}/job`,
            method: "get",
            headers: {
              "Circle-Token": circleCIAccessToken,
              "Content-Type": "application/json",
            },
          },
        );
        assertApiRequest(
          mockedAxiosInstance,
          {
            url: `https://circleci.com/api/v2/project/${projectSlug1}/job/${reRunJobNumber1}`,
            method: "get",
            headers: {
              "Circle-Token": circleCIAccessToken,
            },
          },
        );
      });
      await assertContentsInEncryptedReportFile(expectedContentToBeAddedInReportFile);
      await assertIfTemporaryReportFileIsRemoved();
      await decryptEncryptedReportFile(encryptedReportFileName);
      await assertContentsInDecryptedReportFile(expectedContentToBeAddedInReportFile);
    });
    it("should redeploy multiple applications when config file has redeploy field as an array of redeployment objects", async () => {
      const existingSecret = {
        apiPlatform: {
          apiToken: [oldApiServiceToken, currentApiServiceToken],
          serviceToken: currentApiServiceToken,
        },
      };
      const expectedSecretAfterUpdatingTheSecretManagerConsumer = {
        apiPlatform: {
          apiToken: [currentApiServiceToken, latestApiServiceToken],
          serviceToken: latestApiServiceToken,
        },
      };
      const secretManagerPath = `projects/${gcpProjectId}/secrets/${gcpSecretName}`;
      const expectedContentToBeAddedInReportFile = `New secret value for "${sourceName}": ${latestApiServiceToken}\n`;
      const mockedAxiosInstance = mockAxios();
      mockedAxiosInstance
        .onPost(oktaUrlToGenerateAccessTokenForApiGateway)
        .reply(
          200,
          {
            // eslint-disable-next-line camelcase
            access_token: oktaAccessTokenToApiGateway,
          },
        );
      mockedAxiosInstance
        .onGet(apiPlatformUrlToGetApiIdForPublishedApi)
        .reply(
          200,
          {
            result: [
              { name: "Test api", id: "5176" },
              { name: apiPlatformApiName, id: apiId },
              { name: "Demo app", id: "2349" },
            ],
          },
        );
      mockedAxiosInstance
        .onPut(apiPlatformUrlToUpdateApiToken)
        .reply(200, { data: {} });
      const { mockAccessSecretVersion, mockAddSecretVersion, mockDisableSecretVersion } = mockGCPSecretManager();
      mockAccessSecretVersion.mockResolvedValueOnce([{
        name: `${secretManagerPath}/48`,
        payload: {
          data: createBufferForSecretManager(existingSecret),
        },
      }]);
      mockAddSecretVersion.mockResolvedValueOnce([{
        name: `${secretManagerPath}/49`,
        payload: {
          data: createBufferForSecretManager(expectedSecretAfterUpdatingTheSecretManagerConsumer),
        },
      }]);
      mockDisableSecretVersion.mockResolvedValueOnce([{
        name: `${secretManagerPath}/48`,
      }]);
      jest.spyOn(global, "setTimeout");
      mockRerunCircleCiWorkflowApiCall(mockedAxiosInstance, workflowId1, jobId1, newWorkflowId1);
      mockGetWorkflowJobsApiCall({
        mockedAxiosInstance,
        workflowId: workflowId1,
        jobId: jobId1,
        projectSlug: projectSlug1,
        jobName: jobName1,
      });
      mockGetWorkflowJobsApiCall({
        mockedAxiosInstance,
        workflowId: newWorkflowId1,
        jobNumber: reRunJobNumber1,
        projectSlug: projectSlug1,
        jobName: jobName1,
      });
      mockGetJobDetailsWithJobNumber(mockedAxiosInstance, {
        status: JobStatus.success,
        jobNumber: reRunJobNumber1,
        workFlowId: newWorkflowId1,
        projectSlug: projectSlug1,
      });

      mockRerunCircleCiWorkflowApiCall(mockedAxiosInstance, workflowId2, jobId2, newWorkflowId2);
      mockGetWorkflowJobsApiCall({
        mockedAxiosInstance,
        workflowId: workflowId2,
        jobId: jobId2,
        projectSlug: projectSlug2,
        jobName: jobName2,
      });
      mockGetWorkflowJobsApiCall({
        mockedAxiosInstance,
        workflowId: newWorkflowId2,
        jobNumber: reRunJobNumber2,
        projectSlug: projectSlug2,
        jobName: jobName2,
      });
      mockGetJobDetailsWithJobNumber(mockedAxiosInstance, {
        status: JobStatus.success,
        jobNumber: reRunJobNumber2,
        workFlowId: newWorkflowId2,
        projectSlug: projectSlug2,
      });

      await runSecretRotation("./tests/integration/gcp/mock-configs/api-platform-api-token-rotation-config-for-secrets-with-redeploy-array-in-json-format.json");

      iif(function assertSecretsAreRotatedInSecretManager() {
        expect(mockAddSecretVersion).toBeCalledTimes(1);
        expect(mockAddSecretVersion.mock.calls).toEqual([
          [{
            parent: secretManagerPath,
            payload: {
              data: createBufferForSecretManager(expectedSecretAfterUpdatingTheSecretManagerConsumer),
            },
          }],
        ]);
        expect(mockDisableSecretVersion).toBeCalledTimes(1);
        expect(mockDisableSecretVersion.mock.calls).toEqual([
          [{
            name: `${secretManagerPath}/48`,
          }],
        ]);
      });
      expect(setTimeout).toHaveBeenCalledTimes(0);
      iif(function assertApiCallToGenerateAccessTokenForApiGateway() {
        assertApiRequest(
          mockedAxiosInstance,
          {
            url: oktaUrlToGenerateAccessTokenForApiGateway,
            data: QueryString.stringify({
              // eslint-disable-next-line camelcase
              grant_type: apiPlatformAccessTokenGrantType,
              scope: apiPlatformAccessTokenScope,
            }),
            headers: {
              Authorization: `Basic ${getCredentialsForBasicAuth({
                userName: apiPlatformConsumerClientId,
                password: apiPlatformConsumerClientSecret,
              })}`,
            },
            method: "post",
          },
        );
      });
      iif(function assertApiTokenIsUpdatedInApiPlatform() {
        assertApiRequest(
          mockedAxiosInstance,
          {
            url: apiPlatformUrlToGetApiIdForPublishedApi,
            headers: {
              Authorization: `Bearer ${oktaAccessTokenToApiGateway}`,
            },
            method: "get",
          },
        );
        assertApiRequest(
          mockedAxiosInstance,
          {
            url: apiPlatformUrlToUpdateApiToken,
            data: JSON.stringify({
              config: {
                append: {
                  headers: [`x-api-key:${latestApiServiceToken}`],
                },
              },
              type: "request-transformer",
            }),
            headers: {
              Authorization: `Bearer ${oktaAccessTokenToApiGateway}`,
            },
            method: "put",
          },
        );
      });
      iif(function assertCircleCiApiCalls() {
        assertApiRequest(
          mockedAxiosInstance,
          {
            url: `https://circleci.com/api/v2/workflow/${workflowId1}/rerun`,
            method: "post",
            data: JSON.stringify({
              jobs: [jobId1],
            }),
            headers: {
              "Circle-Token": circleCIAccessToken,
              "Content-Type": "application/json",
            },
          },
        );
        assertApiRequest(
          mockedAxiosInstance,
          {
            url: `https://circleci.com/api/v2/workflow/${workflowId1}/job`,
            method: "get",
            headers: {
              "Circle-Token": circleCIAccessToken,
              "Content-Type": "application/json",
            },
          },
        );
        assertApiRequest(
          mockedAxiosInstance,
          {
            url: `https://circleci.com/api/v2/workflow/${newWorkflowId1}/job`,
            method: "get",
            headers: {
              "Circle-Token": circleCIAccessToken,
              "Content-Type": "application/json",
            },
          },
        );
        assertApiRequest(
          mockedAxiosInstance,
          {
            url: `https://circleci.com/api/v2/project/${projectSlug1}/job/${reRunJobNumber1}`,
            method: "get",
            headers: {
              "Circle-Token": circleCIAccessToken,
            },
          },
        );
        assertApiRequest(
          mockedAxiosInstance,
          {
            url: `https://circleci.com/api/v2/workflow/${workflowId2}/rerun`,
            method: "post",
            data: JSON.stringify({
              jobs: [jobId2],
            }),
            headers: {
              "Circle-Token": circleCIAccessToken,
              "Content-Type": "application/json",
            },
          },
        );
        assertApiRequest(
          mockedAxiosInstance,
          {
            url: `https://circleci.com/api/v2/workflow/${workflowId2}/job`,
            method: "get",
            headers: {
              "Circle-Token": circleCIAccessToken,
              "Content-Type": "application/json",
            },
          },
        );
        assertApiRequest(
          mockedAxiosInstance,
          {
            url: `https://circleci.com/api/v2/workflow/${newWorkflowId2}/job`,
            method: "get",
            headers: {
              "Circle-Token": circleCIAccessToken,
              "Content-Type": "application/json",
            },
          },
        );
        assertApiRequest(
          mockedAxiosInstance,
          {
            url: `https://circleci.com/api/v2/project/${projectSlug2}/job/${reRunJobNumber2}`,
            method: "get",
            headers: {
              "Circle-Token": circleCIAccessToken,
            },
          },
        );
      });
      await assertContentsInEncryptedReportFile(expectedContentToBeAddedInReportFile);
      await assertIfTemporaryReportFileIsRemoved();
      await decryptEncryptedReportFile(encryptedReportFileName);
      await assertContentsInDecryptedReportFile(expectedContentToBeAddedInReportFile);
    });
  });
});
