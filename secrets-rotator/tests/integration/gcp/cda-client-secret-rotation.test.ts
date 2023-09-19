import { decryptEncryptedReportFile, runSecretRotation } from "../../../src/rotator";
import { iif } from "../../../src/utils/functions";
import {
  mockGCPSecretManager,
  mockGetJobDetailsWithJobNumber,
  mockGetWorkflowJobsApiCall,
  mockRerunCircleCiWorkflowApiCall,
} from "../../test-helpers/mocks";
import QueryString from "querystring";
import { createBufferForSecretManager } from "../../../src/utils/secret-manager";
import { assertApiRequest, mockAxios } from "../../test-helpers/request";
import { getCredentialsForBasicAuth } from "../../../src/utils/api";
import {
  assertContentsInDecryptedReportFile,
  assertContentsInEncryptedReportFile,
  assertIfTemporaryReportFileIsRemoved,
} from "../../test-helpers/files";
import { encryptedReportFileName } from "../../../src/data";
import { JobStatus } from "../../../src/circleci/types";

const clientId = "consumer-app-clientId1";
const oldApiPlatformClientSecret = "old-consumer-app-secret";
const newApiPlatformClientSecret = "new-consumer-app-client-secret";
const oktaUrlToGenerateAccessTokenForApiGateway = "http://okta.com/access-token-from-client-id-client-secret";
const apiPlatformBaseUrl = "http:/api-platform";
const apiPlatformConsumerClientId = "test-consumer-client-id";
const apiPlatformConsumerClientSecretUpdateUrl = `${apiPlatformBaseUrl}/clients/${apiPlatformConsumerClientId}/secrets/regenerate-oldest`;
const accessToken = "test-access-token";
const gcpProjectId = "12310283";
const gcpSecretName = "test-secret-name";
const apiPlatformAccessTokenGrantType = "test-grant";
const apiPlatformAccessTokenScope = "test-scope";
const gcloudKey = "ewogICJwcml2YXRlX2tleSI6ICIiLAogICJjbGllbnRfZW1haWwiOiAiIgp9Cg==";
const hashKey = "test-hash-key";
const sourceName = "Test API consumer client secret rotation";
const workflowId = "workflow-000001";
const jobId = "job-000001";
const circleCiAccessToken = "kgggggdgfhjhbbgghfghkt";
const newWorkflowId = "workflow-000002";
const projectSlug = "test-slug";
const reRunJobNumber = 5503;
const jobName = "deploy";

beforeEach(() => {
  iif(function setupEnv() {
    process.env = {
      ...process.env,
      SOURCE_NAME: sourceName,
      HASH_KEY: hashKey,
      API_PLATFORM_CLIENT_ID: apiPlatformConsumerClientId,
      API_PLATFORM_CLIENT_SECRET: oldApiPlatformClientSecret,
      API_PLATFORM_TOKEN_URL: oktaUrlToGenerateAccessTokenForApiGateway,
      API_PLATFORM_URL: apiPlatformBaseUrl,
      API_PLATFORM_ACCESS_TOKEN_GRANT_TYPE: apiPlatformAccessTokenGrantType,
      API_PLATFORM_ACCESS_TOKEN_SCOPE: apiPlatformAccessTokenScope,
      GCP_PROJECT_ID: gcpProjectId,
      GCP_SECRET_NAME: gcpSecretName,
      GCLOUD_KEY: gcloudKey,
      WORKFLOW_ID: workflowId,
      JOB_ID: jobId,
      CIRCLE_CI_ACCESS_TOKEN: circleCiAccessToken,
    };
  });
  jest.useFakeTimers();
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe("CDA Client Secret Rotation", () => {
  describe("should rotate the client-secret in api platform successfully", () => {
    describe("should update the secret in secret manager in JSON format", () => {
      it("should rerun CircleCi job", async () => {
        const existingSecret = {
          apiPlatform: {
            clientId,
            clientSecret: oldApiPlatformClientSecret,
          },
        };
        const expectedSecretAfterUpdatingInSecretManager = {
          apiPlatform: {
            clientId,
            clientSecret: newApiPlatformClientSecret,
          },
        };
        // noinspection DuplicatedCode
        const expectedContentToBeAddedInReportFile = `New secret value for "${sourceName}": ${newApiPlatformClientSecret}\n`;
        const secretManagerPath = `projects/${gcpProjectId}/secrets/${gcpSecretName}`;
        const mockedAxiosInstance = mockAxios();
        mockedAxiosInstance.onPost(oktaUrlToGenerateAccessTokenForApiGateway).reply(
          200,
          {
            // eslint-disable-next-line camelcase
            access_token: accessToken,
          },
        );
        mockedAxiosInstance
          .onPost(apiPlatformConsumerClientSecretUpdateUrl)
          .reply(
            200,
            {
              removedSecretId: "old-secret-id",
              newSecret: {
                id: "new-secret-id",
                secret: newApiPlatformClientSecret,
              },
            },
          );
        const { mockAccessSecretVersion, mockDisableSecretVersion, mockAddSecretVersion } = mockGCPSecretManager();
        mockAccessSecretVersion.mockResolvedValue([{
          name: `${secretManagerPath}/48`,
          payload: {
            data: createBufferForSecretManager(existingSecret),
          },
        }]);
        mockAddSecretVersion.mockResolvedValue([{
          name: `${secretManagerPath}/49`,
          payload: {
            data: createBufferForSecretManager(expectedSecretAfterUpdatingInSecretManager),
          },
        }]);
        mockDisableSecretVersion.mockResolvedValue([{
          name: `${secretManagerPath}/48`,
          payload: {
            data: createBufferForSecretManager(existingSecret),
          },
        }]);
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

        await runSecretRotation("./tests/integration/gcp/mock-configs/cda-client-secret-rotation-config-when-secret-is-stored-in-json-format.json");

        // noinspection DuplicatedCode
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
                  password: oldApiPlatformClientSecret,
                })}`,
              },
              method: "post",
            },
          );
        });
        iif(function assertConsumerAppClientSecretIsUpdatedInApiPlatform() {
          assertApiRequest(
            mockedAxiosInstance,
            {
              url: apiPlatformConsumerClientSecretUpdateUrl,
              data: JSON.stringify({}),
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
              method: "post",
            },
          );
        });
        iif(function assertSecretsAreRotatedInSecretManager() {
          expect(mockAddSecretVersion).toBeCalledTimes(1);
          expect(mockAddSecretVersion.mock.calls).toEqual([
            [{
              parent: secretManagerPath,
              payload: {
                data: createBufferForSecretManager(expectedSecretAfterUpdatingInSecretManager),
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
                "Circle-Token": circleCiAccessToken,
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
                "Circle-Token": circleCiAccessToken,
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
                "Circle-Token": circleCiAccessToken,
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
                "Circle-Token": circleCiAccessToken,
              },
            },
          );
        });
        await assertContentsInEncryptedReportFile(expectedContentToBeAddedInReportFile);
        await assertIfTemporaryReportFileIsRemoved();
        await decryptEncryptedReportFile(encryptedReportFileName);
        await assertContentsInDecryptedReportFile(expectedContentToBeAddedInReportFile);
      });
      it("should rerun CircleCi job when config file has keyFieldNames array", async () => {
        const existingSecret = {
          apiPlatform: {
            clientId,
            clientSecret: oldApiPlatformClientSecret,
          },
        };
        const expectedSecretAfterUpdatingInSecretManager = {
          apiPlatform: {
            clientId,
            clientSecret: newApiPlatformClientSecret,
          },
          eventsPublisherClientSecret: newApiPlatformClientSecret,
        };
        // noinspection DuplicatedCode
        const expectedContentToBeAddedInReportFile = `New secret value for "${sourceName}": ${newApiPlatformClientSecret}\n`;
        const secretManagerPath = `projects/${gcpProjectId}/secrets/${gcpSecretName}`;
        const mockedAxiosInstance = mockAxios();
        mockedAxiosInstance.onPost(oktaUrlToGenerateAccessTokenForApiGateway).reply(
          200,
          {
            // eslint-disable-next-line camelcase
            access_token: accessToken,
          },
        );
        mockedAxiosInstance
          .onPost(apiPlatformConsumerClientSecretUpdateUrl)
          .reply(
            200,
            {
              removedSecretId: "old-secret-id",
              newSecret: {
                id: "new-secret-id",
                secret: newApiPlatformClientSecret,
              },
            },
          );
        const { mockAccessSecretVersion, mockDisableSecretVersion, mockAddSecretVersion } = mockGCPSecretManager();
        mockAccessSecretVersion.mockResolvedValue([{
          name: `${secretManagerPath}/48`,
          payload: {
            data: createBufferForSecretManager(existingSecret),
          },
        }]);
        mockAddSecretVersion.mockResolvedValue([{
          name: `${secretManagerPath}/49`,
          payload: {
            data: createBufferForSecretManager(expectedSecretAfterUpdatingInSecretManager),
          },
        }]);
        mockDisableSecretVersion.mockResolvedValue([{
          name: `${secretManagerPath}/48`,
          payload: {
            data: createBufferForSecretManager(existingSecret),
          },
        }]);
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

        await runSecretRotation("./tests/integration/gcp/mock-configs/cda-client-secret-rotation-config-with-keyFieldNames-when-secret-is-stored-in-json-format.json");

        // noinspection DuplicatedCode
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
                  password: oldApiPlatformClientSecret,
                })}`,
              },
              method: "post",
            },
          );
        });
        iif(function assertConsumerAppClientSecretIsUpdatedInApiPlatform() {
          assertApiRequest(
            mockedAxiosInstance,
            {
              url: apiPlatformConsumerClientSecretUpdateUrl,
              data: JSON.stringify({}),
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
              method: "post",
            },
          );
        });
        iif(function assertSecretsAreRotatedInSecretManager() {
          expect(mockAddSecretVersion).toBeCalledTimes(1);
          expect(mockAddSecretVersion.mock.calls).toEqual([
            [{
              parent: secretManagerPath,
              payload: {
                data: createBufferForSecretManager(expectedSecretAfterUpdatingInSecretManager),
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
                "Circle-Token": circleCiAccessToken,
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
                "Circle-Token": circleCiAccessToken,
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
                "Circle-Token": circleCiAccessToken,
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
                "Circle-Token": circleCiAccessToken,
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
    it("should update the secret in secret manager as plain text", async () => {
      const existingSecret = "old-consumer-secret";
      const expectedSecretAfterUpdatingInSecretManager = newApiPlatformClientSecret;
      const expectedContentToBeAddedInReportFile = `New secret value for "${sourceName}": ${newApiPlatformClientSecret}\n`;
      const secretManagerPath = `projects/${gcpProjectId}/secrets/${gcpSecretName}`;
      const mockedAxiosInstance = mockAxios();
      mockedAxiosInstance.onPost(oktaUrlToGenerateAccessTokenForApiGateway).reply(
        200,
        {
          // eslint-disable-next-line camelcase
          access_token: accessToken,
        },
      );
      mockedAxiosInstance
        .onPost(apiPlatformConsumerClientSecretUpdateUrl)
        .reply(
          200,
          {
            removedSecretId: "old-secret-id",
            newSecret: {
              id: "new-secret-id",
              secret: newApiPlatformClientSecret,
            },
          },
        );
      const { mockAccessSecretVersion, mockDisableSecretVersion, mockAddSecretVersion } = mockGCPSecretManager();
      mockAccessSecretVersion.mockResolvedValue([{
        name: `${secretManagerPath}/48`,
        payload: {
          data: createBufferForSecretManager(existingSecret),
        },
      }]);
      mockAddSecretVersion.mockResolvedValue([{
        name: `${secretManagerPath}/49`,
        payload: {
          data: createBufferForSecretManager(expectedSecretAfterUpdatingInSecretManager),
        },
      }]);
      mockDisableSecretVersion.mockResolvedValue([{
        name: `${secretManagerPath}/48`,
        payload: {
          data: createBufferForSecretManager(existingSecret),
        },
      }]);

      await runSecretRotation("./tests/integration/gcp/mock-configs/cda-client-secret-rotation-when-secret-is-stored-in-plain-text-in-format.json");

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
                password: oldApiPlatformClientSecret,
              })}`,
            },
            method: "post",
          },
        );
      });
      iif(function assertConsumerAppClientSecretIsUpdatedInApiPlatform() {
        assertApiRequest(
          mockedAxiosInstance,
          {
            url: apiPlatformConsumerClientSecretUpdateUrl,
            data: JSON.stringify({}),
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            method: "post",
          },
        );
      });
      iif(function assertSecretsAreRotatedInSecretManager() {
        expect(mockAddSecretVersion).toBeCalledTimes(1);
        expect(mockAddSecretVersion.mock.calls).toEqual([
          [{
            parent: secretManagerPath,
            payload: {
              data: createBufferForSecretManager(expectedSecretAfterUpdatingInSecretManager),
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
      await assertContentsInEncryptedReportFile(expectedContentToBeAddedInReportFile);
      await assertIfTemporaryReportFileIsRemoved();
      await decryptEncryptedReportFile(encryptedReportFileName);
      await assertContentsInDecryptedReportFile(expectedContentToBeAddedInReportFile);
    });
  });
  describe("Error scenarios", () => {
    it("should throw error when something fails during auth token generation", async () => {
      const mockedAxiosInstance = mockAxios();
      mockedAxiosInstance.onPost(oktaUrlToGenerateAccessTokenForApiGateway).reply(
        500,
        null,
      );

      try {
        await runSecretRotation("./tests/integration/gcp/mock-configs/cda-client-secret-rotation-config-when-secret-is-stored-in-json-format.json");
      } catch (error) {   // TODO Not a correct way to assert errors
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

    it("should throw error when something fails during the api call to rotate secrets", async () => {
      const mockedAxiosInstance = mockAxios();
      mockedAxiosInstance.onPost(oktaUrlToGenerateAccessTokenForApiGateway).reply(
        200,
        {
          // eslint-disable-next-line camelcase
          access_token: accessToken,
        },
      );
      mockedAxiosInstance
        .onPost(apiPlatformConsumerClientSecretUpdateUrl)
        .reply(
          500,
          null,
        );

      try {
        await runSecretRotation("./tests/integration/gcp/mock-configs/cda-client-secret-rotation-config-when-secret-is-stored-in-json-format.json");
      } catch (error) {   // TODO Not a correct way to assert errors
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

    it("should throw error when updating the secrets in secret manager", async () => {
      const existingSecret = {
        apiPlatform: {
          clientId,
          clientSecret: oldApiPlatformClientSecret,
        },
      };
      const secretManagerPath = `projects/${gcpProjectId}/secrets/${gcpSecretName}`;
      const mockedAxiosInstance = mockAxios();
      mockedAxiosInstance.onPost(oktaUrlToGenerateAccessTokenForApiGateway).reply(
        200,
        {
          // eslint-disable-next-line camelcase
          access_token: accessToken,
        },
      );
      mockedAxiosInstance
        .onPost(apiPlatformConsumerClientSecretUpdateUrl)
        .reply(
          200,
          {
            removedSecretId: "old-secret-id",
            newSecret: {
              id: "new-secret-id",
              secret: newApiPlatformClientSecret,
            },
          },
        );
      const { mockAccessSecretVersion, mockAddSecretVersion, mockDisableSecretVersion } = mockGCPSecretManager();
      mockAccessSecretVersion.mockResolvedValue([{
        name: `${secretManagerPath}/48`,
        payload: {
          data: createBufferForSecretManager(existingSecret),
        },
      }]);
      mockAddSecretVersion.mockRejectedValue(new Error("Mocked error"));
      mockDisableSecretVersion.mockResolvedValue([{
        name: `${secretManagerPath}/48`,
        payload: {
          data: createBufferForSecretManager(existingSecret),
        },
      }]);

      try {
        await runSecretRotation("./tests/integration/gcp/mock-configs/cda-client-secret-rotation-config-when-secret-is-stored-in-json-format.json");
      } catch (error) {   // TODO Not a correct way to assert errors   // TODO Not a correct way to assert errors
        const expectedContentToBeAddedInReportFile = `New secret value for "${sourceName}": ${newApiPlatformClientSecret}\n${JSON.stringify({
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
      expect(mockDisableSecretVersion).not.toBeCalled();
    });

    it("should throw error when rerunning the CircleCi job fails", async () => {
      const existingSecret = {
        apiPlatform: {
          clientId,
          clientSecret: oldApiPlatformClientSecret,
        },
      };
      const expectedSecretAfterUpdatingInSecretManager = {
        apiPlatform: {
          clientId,
          clientSecret: newApiPlatformClientSecret,
        },
      };
      // noinspection DuplicatedCode
      const expectedContentToBeAddedInReportFile = `New secret value for "${sourceName}": ${newApiPlatformClientSecret}\n`;
      const secretManagerPath = `projects/${gcpProjectId}/secrets/${gcpSecretName}`;
      const mockedAxiosInstance = mockAxios();
      mockedAxiosInstance.onPost(oktaUrlToGenerateAccessTokenForApiGateway).reply(
        200,
        {
          // eslint-disable-next-line camelcase
          access_token: accessToken,
        },
      );
      mockedAxiosInstance
        .onPost(apiPlatformConsumerClientSecretUpdateUrl)
        .reply(
          200,
          {
            removedSecretId: "old-secret-id",
            newSecret: {
              id: "new-secret-id",
              secret: newApiPlatformClientSecret,
            },
          },
        );
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
      const { mockAccessSecretVersion, mockDisableSecretVersion, mockAddSecretVersion } = mockGCPSecretManager();
      mockAccessSecretVersion.mockResolvedValue([{
        name: `${secretManagerPath}/48`,
        payload: {
          data: createBufferForSecretManager(existingSecret),
        },
      }]);
      mockAddSecretVersion.mockResolvedValue([{
        name: `${secretManagerPath}/49`,
        payload: {
          data: createBufferForSecretManager(expectedSecretAfterUpdatingInSecretManager),
        },
      }]);
      mockDisableSecretVersion.mockResolvedValue([{
        name: `${secretManagerPath}/48`,
        payload: {
          data: createBufferForSecretManager(existingSecret),
        },
      }]);

      try {
        await runSecretRotation("./tests/integration/gcp/mock-configs/cda-client-secret-rotation-config-when-secret-is-stored-in-json-format.json");
      } catch (error) {   // TODO Not a correct way to assert errors
        const expectedContentToBeAddedInReportFile = `New secret value for "${sourceName}": ${newApiPlatformClientSecret}\n${JSON.stringify({
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
                password: oldApiPlatformClientSecret,
              })}`,
            },
            method: "post",
          },
        );
      });
      iif(function assertConsumerAppClientSecretIsUpdatedInApiPlatform() {
        assertApiRequest(
          mockedAxiosInstance,
          {
            url: apiPlatformConsumerClientSecretUpdateUrl,
            data: JSON.stringify({}),
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
            method: "post",
          },
        );
      });
      iif(function assertSecretsAreRotatedInSecretManager() {
        expect(mockAddSecretVersion).toBeCalledTimes(1);
        expect(mockAddSecretVersion.mock.calls).toEqual([
          [{
            parent: secretManagerPath,
            payload: {
              data: createBufferForSecretManager(expectedSecretAfterUpdatingInSecretManager),
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
              "Circle-Token": circleCiAccessToken,
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
              "Circle-Token": circleCiAccessToken,
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
              "Circle-Token": circleCiAccessToken,
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
              "Circle-Token": circleCiAccessToken,
            },
          },
        );
      });
    });
  });
});
