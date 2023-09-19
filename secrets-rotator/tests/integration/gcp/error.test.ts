import { decryptEncryptedReportFile, runSecretRotation } from "../../../src/rotator";
import { iif } from "../../../src/utils/functions";
import {
  mockGCPSecretManager,
  mockGetJobDetailsWithJobNumber,
  mockGetWorkflowJobsApiCall,
  mockRerunCircleCiWorkflowApiCall,
} from "../../test-helpers/mocks";
import { createBufferForSecretManager } from "../../../src/utils/secret-manager";
import {
  assertContentsInDecryptedReportFile,
  assertContentsInEncryptedReportFile,
  assertIfTemporaryReportFileIsRemoved,
} from "../../test-helpers/files";
import { encryptedReportFileName } from "../../../src/data";
import * as apiToken from "../../../src/api-platform/api-service-token";
import { assertApiRequest, mockAxios } from "../../test-helpers/request";
import { JobStatus } from "../../../src/circleci/types";

const apiPlatformApiName = "application-service";
const apiId = "8982";
const oktaUrlToGenerateAccessTokenForApiGateway = "http://okta.com/access-token-from-client-id-client-secret";
const apiPlatformUrl = "http://api-platform.com";
const gcpProjectId = "12310283";
const gcpSecretName = "test-secret-name";
const apiPlatformConsumerClientId = "test-consumer-client-id";
const apiPlatformConsumerClientSecret = "test-consumer-client-secret";
const secretManagerPath = `projects/${gcpProjectId}/secrets/${gcpSecretName}`;
const latestApiServiceToken = "latest-api-token";
const apiPlatformAccessTokenGrantType = "test-grant";
const apiPlatformAccessTokenScope = "test-scope";
const gcloudKey = "ewogICJwcml2YXRlX2tleSI6ICIiLAogICJjbGllbnRfZW1haWwiOiAiIgp9Cg==";
const hashKey = "test-hash-key";
const sourceName = "Generate Password";
const oldApiServiceToken = "old-api-token";
const currentApiServiceToken = "current-api-token";
const circleCIAccessToken = "test-token";
const workflowId = "workflow-000001";
const jobId = "job-000001";
const newWorkflowId = "workflow-000002";
const projectSlug = "test-slug";
const reRunJobNumber = 5503;
const oktaAccessTokenToApiGateway = "test-access-token";
const jobName = "deploy";

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
      API_PLATFORM_URL: apiPlatformUrl,
      API_PLATFORM_CLIENT_ID: apiPlatformConsumerClientId,
      API_PLATFORM_CLIENT_SECRET: apiPlatformConsumerClientSecret,
      API_PLATFORM_ACCESS_TOKEN_GRANT_TYPE: apiPlatformAccessTokenGrantType,
      API_PLATFORM_ACCESS_TOKEN_SCOPE: apiPlatformAccessTokenScope,
      GCP_PROJECT_ID: gcpProjectId,
      GCP_SECRET_NAME: gcpSecretName,
      GCLOUD_KEY: gcloudKey,
      WORKFLOW_ID: workflowId,
      JOB_ID: jobId,
      CIRCLE_CI_ACCESS_TOKEN: circleCIAccessToken,
    };
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

it("Should throw error when Hash key environment variable is not provided", async () => {
  delete process.env.HASH_KEY;

  try {
    await runSecretRotation("./tests/integration/gcp/mock-configs/api-platform-api-token-rotation-config-for-secrets-in-json-format.json");
  } catch (error) {
    const expectedContentToBeAddedInReportFile = `${JSON.stringify({
      message: "Failed to rotate secrets",
      stackTrace: error.stack,
      causedByError: error.message,
      causedByErrorName: error.name,
    })}\n`;
    await assertContentsInEncryptedReportFile(expectedContentToBeAddedInReportFile);
    await assertIfTemporaryReportFileIsRemoved();
    await decryptEncryptedReportFile(encryptedReportFileName);
    await assertContentsInDecryptedReportFile(expectedContentToBeAddedInReportFile);
  }
});
describe("API platform x-api-key rotation", () => {
  describe("should throw error when x-api-key rotation in secret manager fails", () => {
    it("should not update the secret in api platform", async () => {
      const existingSecret = {
        apiPlatform: {
          apiToken: [oldApiServiceToken, currentApiServiceToken],
          serviceToken: currentApiServiceToken,
        },
      };
      const { mockAccessSecretVersion, mockDisableSecretVersion, mockAddSecretVersion } = mockGCPSecretManager();
      mockAccessSecretVersion.mockResolvedValue([{
        name: `${secretManagerPath}/48`,
        payload: {
          data: createBufferForSecretManager(existingSecret),
        },
      }]);
      mockAddSecretVersion.mockRejectedValue(new Error("Unable to add secret"));
      const rotateApiPlatformApiServiceTokenSpy = jest.spyOn(apiToken, "rotateApiPlatformApiServiceToken");

      try {
        await runSecretRotation("./tests/integration/gcp/mock-configs/api-platform-api-token-rotation-config-for-secrets-in-json-format.json");
      } catch (error) {
        const expectedContentToBeAddedInReportFile = `New secret value for "${sourceName}": ${latestApiServiceToken}\n${JSON.stringify({
          message: "Failed to rotate secrets",
          stackTrace: error.stack,
          causedByError: error.message,
          causedByErrorName: error.name,
        })}\n`;
        await assertContentsInEncryptedReportFile(expectedContentToBeAddedInReportFile);
        await assertIfTemporaryReportFileIsRemoved();
        await decryptEncryptedReportFile(encryptedReportFileName);
        await assertContentsInDecryptedReportFile(expectedContentToBeAddedInReportFile);
      }
      iif(function assertSecretsAreNotRotatedInSecretManager() {
        expect(mockAccessSecretVersion).toBeCalledTimes(1);
        expect(mockAddSecretVersion).toBeCalledTimes(1);
        expect(mockDisableSecretVersion).toBeCalledTimes(0);
      });
      expect(rotateApiPlatformApiServiceTokenSpy).toHaveBeenCalledTimes(0);
    });
  });

  describe("should throw error when something fails during redeployment", () => {
    it("should not update the secret in api platform", async () => {
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
      const { mockAccessSecretVersion, mockDisableSecretVersion, mockAddSecretVersion } = mockGCPSecretManager();
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
      const mockedAxiosInstance = mockAxios();
      mockRerunCircleCiWorkflowApiCall(mockedAxiosInstance, workflowId, jobId, newWorkflowId);
      mockGetWorkflowJobsApiCall({ mockedAxiosInstance, workflowId, jobId, projectSlug, jobName });
      mockGetWorkflowJobsApiCall({
        mockedAxiosInstance,
        workflowId: newWorkflowId,
        jobNumber: reRunJobNumber,
        projectSlug,
        jobName,
      });
      mockGetJobDetailsWithJobNumber(mockedAxiosInstance, {
        status: JobStatus.failed,
        jobNumber: reRunJobNumber,
        workFlowId: newWorkflowId,
        projectSlug,
      });
      const rotateApiPlatformApiServiceTokenSpy = jest.spyOn(apiToken, "rotateApiPlatformApiServiceToken");

      try {
        await runSecretRotation("./tests/integration/gcp/mock-configs/api-platform-api-token-rotation-config-for-secrets-in-json-format.json");
      } catch (error) {
        const expectedContentToBeAddedInReportFile = `New secret value for "${sourceName}": ${latestApiServiceToken}\n${JSON.stringify({
          message: "Failed to rotate secrets",
          stackTrace: error.stack,
          causedByError: error.message,
          causedByErrorName: error.name,
        })}\n`;
        await assertContentsInEncryptedReportFile(expectedContentToBeAddedInReportFile);
        await assertIfTemporaryReportFileIsRemoved();
        await decryptEncryptedReportFile(encryptedReportFileName);
        await assertContentsInDecryptedReportFile(expectedContentToBeAddedInReportFile);
      }
      iif(function assertSecretsAreNotRotatedInSecretManager() {
        expect(mockAccessSecretVersion).toBeCalledTimes(2);
        expect(mockAddSecretVersion).toBeCalledTimes(2);
        expect(mockDisableSecretVersion).toBeCalledTimes(2);
      });
      iif(function assertCircleCiApiCalls() {
        assertApiRequest(
          mockedAxiosInstance,
          {
            url: `https://circleci.com/api/v2/workflow/${workflowId}/rerun`,
            method: "post",
            data: JSON.stringify({
              jobs: [jobId],
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
            url: `https://circleci.com/api/v2/workflow/${workflowId}/job`,
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
            url: `https://circleci.com/api/v2/workflow/${newWorkflowId}/job`,
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
            url: `https://circleci.com/api/v2/project/${projectSlug}/job/${reRunJobNumber}`,
            method: "get",
            headers: {
              "Circle-Token": circleCIAccessToken,
            },
          },
        );
      });
      expect(rotateApiPlatformApiServiceTokenSpy).toHaveBeenCalledTimes(0);
    });
  });

  it("should throw error when secret rotation fails in api platform", async () => {
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
    const { mockAccessSecretVersion, mockDisableSecretVersion, mockAddSecretVersion } = mockGCPSecretManager();
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
    const mockedAxiosInstance = mockAxios();
    mockRerunCircleCiWorkflowApiCall(mockedAxiosInstance, workflowId, jobId, newWorkflowId);
    mockGetWorkflowJobsApiCall({ mockedAxiosInstance, workflowId, jobId, projectSlug, jobName });
    mockGetWorkflowJobsApiCall({
      mockedAxiosInstance,
      workflowId: newWorkflowId,
      jobNumber: reRunJobNumber,
      projectSlug,
      jobName,
    });
    mockGetJobDetailsWithJobNumber(mockedAxiosInstance, {
      status: JobStatus.success,
      jobNumber: reRunJobNumber,
      workFlowId: newWorkflowId,
      projectSlug,
    });
    const rotateApiPlatformApiServiceTokenSpy = jest.spyOn(apiToken, "rotateApiPlatformApiServiceToken");
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
      .onGet(`${apiPlatformUrl}/publisher/apis/`)
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
      .onPut(`${apiPlatformUrl}/publisher/apis/${apiId}/plugins/request-transformer`)
      .reply(500, { data: {} });

    try {
      await runSecretRotation("./tests/integration/gcp/mock-configs/api-platform-api-token-rotation-config-for-secrets-in-json-format.json");
    } catch (error) {
      const expectedContentToBeAddedInReportFile = `New secret value for "${sourceName}": ${latestApiServiceToken}\n${JSON.stringify({
        message: "Failed to rotate secrets",
        stackTrace: error.stack,
        causedByError: error.message,
        causedByErrorName: error.name,
      })}\n`;
      await assertContentsInEncryptedReportFile(expectedContentToBeAddedInReportFile);
      await assertIfTemporaryReportFileIsRemoved();
      await decryptEncryptedReportFile(encryptedReportFileName);
      await assertContentsInDecryptedReportFile(expectedContentToBeAddedInReportFile);
    }
    iif(function assertSecretsAreNotRotatedInSecretManager() {
      expect(mockAccessSecretVersion).toBeCalledTimes(2);
      expect(mockAddSecretVersion).toBeCalledTimes(2);
      expect(mockDisableSecretVersion).toBeCalledTimes(2);
    });
    iif(function assertCircleCiApiCalls() {
      assertApiRequest(
        mockedAxiosInstance,
        {
          url: `https://circleci.com/api/v2/workflow/${workflowId}/rerun`,
          method: "post",
          data: JSON.stringify({
            jobs: [jobId],
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
          url: `https://circleci.com/api/v2/workflow/${workflowId}/job`,
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
          url: `https://circleci.com/api/v2/workflow/${newWorkflowId}/job`,
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
          url: `https://circleci.com/api/v2/project/${projectSlug}/job/${reRunJobNumber}`,
          method: "get",
          headers: {
            "Circle-Token": circleCIAccessToken,
          },
        },
      );
    });
    expect(rotateApiPlatformApiServiceTokenSpy).toHaveBeenCalledTimes(1);
  });

});
