import { decryptEncryptedReportFile, runSecretRotation } from "../../../src/rotator";
import { iif } from "../../../src/utils/functions";
import {
  mockAWSGetSecretValueCommand,
  mockAWSSecretManagerClient,
  mockAWSUpdateSecretCommand,
  mockGetJobDetailsWithJobNumber,
  mockGetWorkflowJobsApiCall,
  mockRejectsAWSUpdateSecretCommand,
  mockRerunCircleCiWorkflowApiCall,
} from "../../test-helpers/mocks";
import QueryString from "querystring";
import { assertApiRequest, assertSecretManagerClientSendRequests, mockAxios } from "../../test-helpers/request";
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
const currentApiPlatformClientSecret = "current-consumer-app-secret";
const newApiPlatformClientSecret = "new-consumer-app-client-secret";
const oktaUrlToGenerateAccessTokenForApiGateway = "http://okta.com/access-token-from-client-id-client-secret";
const apiPlatformBaseUrl = "http:/api-platform";
const apiPlatformConsumerClientId = "test-consumer-client-id";
const apiPlatformConsumerClientSecretUpdateUrl = `${apiPlatformBaseUrl}/clients/${apiPlatformConsumerClientId}/secrets/regenerate-oldest`;
const accessToken = "test-access-token";
const apiPlatformAccessTokenGrantType = "test-grant";
const apiPlatformAccessTokenScope = "test-scope";
const hashKey = "test-hash-key";
const sourceName = "Test API consumer client secret rotation";
const workflowId = "workflow-000001";
const jobId = "job-000001";
const circleCiAccessToken = "kgggggdgfhjhbbgghfghkt";
const newWorkflowId = "workflow-000002";
const projectSlug = "test-slug";
const reRunJobNumber = 5503;
const jobName = "deploy";
const secretName = "test-secret-name";

beforeEach(() => {
  iif(function setupEnv() {
    process.env = {
      ...process.env,
      SOURCE_NAME: sourceName,
      HASH_KEY: hashKey,
      API_PLATFORM_CLIENT_ID: apiPlatformConsumerClientId,
      AWS_SECRET_NAME: secretName,
      API_PLATFORM_CLIENT_SECRET: oldApiPlatformClientSecret,
      API_PLATFORM_TOKEN_URL: oktaUrlToGenerateAccessTokenForApiGateway,
      API_PLATFORM_URL: apiPlatformBaseUrl,
      API_PLATFORM_ACCESS_TOKEN_GRANT_TYPE: apiPlatformAccessTokenGrantType,
      API_PLATFORM_ACCESS_TOKEN_SCOPE: apiPlatformAccessTokenScope,
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
      it("should update a single field and rerun CircleCi job", async () => {
        const existingSecret = {
          apiPlatform: {
            clientId,
            clientSecret: oldApiPlatformClientSecret,
          },
        };
        const newSecret = {
          apiPlatform: {
            clientId,
            clientSecret: newApiPlatformClientSecret,
          },
        };
        // noinspection DuplicatedCode
        const expectedContentToBeAddedInReportFile = `New secret value for "${sourceName}": ${newApiPlatformClientSecret}\n`;
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
        const { mockSecretManagerClient } = mockAWSSecretManagerClient();
        mockAWSGetSecretValueCommand({
          mockSecretManagerClient,
          mockResponse: existingSecret,
        });
        mockAWSUpdateSecretCommand({
          mockSecretManagerClient,
          mockResponse: {
            ARN: "test-arn",
            Name: secretName,
            VersionId: "7efd38fd-6c8a-4a51-80d1-4cd07df22df1",
          },
        });
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

        await runSecretRotation("./tests/integration/aws/mock-configs/cda-client-secret-rotation-config-when-secret-is-stored-in-json-format.json");

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
        assertSecretManagerClientSendRequests({
          mockSecretManagerClient,
          sendRequestsInputFields: [
            {
              SecretId: secretName,
            },
            {
              SecretId: secretName,
              SecretString: JSON.stringify(newSecret),
            },
          ],
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

      it("should update a single array field and rerun CircleCi job", async () => {
        const existingSecret = {
          apiPlatform: {
            clientId,
            clientSecret: [oldApiPlatformClientSecret, currentApiPlatformClientSecret],
          },
        };
        const newSecret = {
          apiPlatform: {
            clientId,
            clientSecret: [currentApiPlatformClientSecret, newApiPlatformClientSecret],
          },
        };
        // noinspection DuplicatedCode
        const expectedContentToBeAddedInReportFile = `New secret value for "${sourceName}": ${newApiPlatformClientSecret}\n`;
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
        const { mockSecretManagerClient } = mockAWSSecretManagerClient();
        mockAWSGetSecretValueCommand({
          mockSecretManagerClient,
          mockResponse: existingSecret,
        });
        mockAWSUpdateSecretCommand({
          mockSecretManagerClient,
          mockResponse: {
            ARN: "test-arn",
            Name: secretName,
            VersionId: "7efd38fd-6c8a-4a51-80d1-4cd07df22df1",
          },
        });
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

        await runSecretRotation(
          "./tests/integration/aws/mock-configs/cda-client-secret-rotation-config-when-secret-is-stored-as-array-in-json-format.json",
        );

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
        assertSecretManagerClientSendRequests({
          mockSecretManagerClient,
          sendRequestsInputFields: [
            {
              SecretId: secretName,
            },
            {
              SecretId: secretName,
              SecretString: JSON.stringify(newSecret),
            },
          ],
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

      it("should update a multiple fields and rerun CircleCi job", async () => {
        const existingSecret = {
          apiPlatform: {
            clientId,
            clientSecret: [oldApiPlatformClientSecret, currentApiPlatformClientSecret],
          },
          eventsPublisherClientSecret: oldApiPlatformClientSecret,
        };
        const newSecret = {
          apiPlatform: {
            clientId,
            clientSecret: [currentApiPlatformClientSecret, newApiPlatformClientSecret],
          },
          eventsPublisherClientSecret: newApiPlatformClientSecret,
        };
        // noinspection DuplicatedCode
        const expectedContentToBeAddedInReportFile = `New secret value for "${sourceName}": ${newApiPlatformClientSecret}\n`;
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
        const { mockSecretManagerClient } = mockAWSSecretManagerClient();
        mockAWSGetSecretValueCommand({
          mockSecretManagerClient,
          mockResponse: existingSecret,
        });
        mockAWSUpdateSecretCommand({
          mockSecretManagerClient,
          mockResponse: {
            ARN: "test-arn",
            Name: secretName,
            VersionId: "7efd38fd-6c8a-4a51-80d1-4cd07df22df1",
          },
        });
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

        // eslint-disable-next-line max-len
        await runSecretRotation("./tests/integration/aws/mock-configs/cda-client-secret-rotation-config-with-keyFieldNames-when-secret-is-stored-in-json-format.json");

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
        assertSecretManagerClientSendRequests({
          mockSecretManagerClient,
          sendRequestsInputFields: [
            {
              SecretId: secretName,
            },
            {
              SecretId: secretName,
              SecretString: JSON.stringify(newSecret),
            },
          ],
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
      const newSecret = newApiPlatformClientSecret;
      const expectedContentToBeAddedInReportFile = `New secret value for "${sourceName}": ${newApiPlatformClientSecret}\n`;
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
      const { mockSecretManagerClient } = mockAWSSecretManagerClient();
      mockAWSGetSecretValueCommand({
        mockSecretManagerClient,
        mockResponse: existingSecret,
      });
      mockAWSUpdateSecretCommand({
        mockSecretManagerClient,
        mockResponse: {
          ARN: "test-arn",
          Name: secretName,
          VersionId: "7efd38fd-6c8a-4a51-80d1-4cd07df22df1",
        },
      });

      await runSecretRotation("./tests/integration/aws/mock-configs/cda-client-secret-rotation-when-secret-is-stored-in-plain-text-in-format.json");

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
      assertSecretManagerClientSendRequests({
        mockSecretManagerClient,
        sendRequestsInputFields: [
          {
            SecretId: secretName,
          },
          {
            SecretId: secretName,
            SecretString: newSecret,
          },
        ],
      });
      await assertContentsInEncryptedReportFile(expectedContentToBeAddedInReportFile);
      await assertIfTemporaryReportFileIsRemoved();
      await decryptEncryptedReportFile(encryptedReportFileName);
      await assertContentsInDecryptedReportFile(expectedContentToBeAddedInReportFile);
    });

    it("should update the secret stored in secret manager as array in plain text format", async () => {
      const existingSecret = [oldApiPlatformClientSecret, currentApiPlatformClientSecret];
      const newSecret = [currentApiPlatformClientSecret, newApiPlatformClientSecret];
      const expectedContentToBeAddedInReportFile = `New secret value for "${sourceName}": ${newApiPlatformClientSecret}\n`;
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
      const { mockSecretManagerClient } = mockAWSSecretManagerClient();
      mockAWSGetSecretValueCommand({
        mockSecretManagerClient,
        mockResponse: existingSecret,
      });
      mockAWSUpdateSecretCommand({
        mockSecretManagerClient,
        mockResponse: {
          ARN: "test-arn",
          Name: secretName,
          VersionId: "7efd38fd-6c8a-4a51-80d1-4cd07df22df1",
        },
      });

      await runSecretRotation(
        "./tests/integration/aws/mock-configs/cda-client-secret-rotation-when-secret-is-stored-as-array-in-plain-text-in-format.json",
      );

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
      assertSecretManagerClientSendRequests({
        mockSecretManagerClient,
        sendRequestsInputFields: [
          {
            SecretId: secretName,
          },
          {
            SecretId: secretName,
            SecretString: JSON.stringify(newSecret),
          },
        ],
      });
      await assertContentsInEncryptedReportFile(expectedContentToBeAddedInReportFile);
      await assertIfTemporaryReportFileIsRemoved();
      await decryptEncryptedReportFile(encryptedReportFileName);
      await assertContentsInDecryptedReportFile(expectedContentToBeAddedInReportFile);
    });
  });

  describe("Error scenarios", () => {

    it("should throw error when updating the secrets in secret manager", async () => {
      const existingSecret = {
        apiPlatform: {
          clientId,
          clientSecret: oldApiPlatformClientSecret,
        },
      };
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
      const { mockSecretManagerClient } = mockAWSSecretManagerClient();
      mockAWSGetSecretValueCommand({
        mockSecretManagerClient,
        mockResponse: existingSecret,
      });
      mockRejectsAWSUpdateSecretCommand({
        mockSecretManagerClient,
      });
      await expect(
        runSecretRotation("./tests/integration/aws/mock-configs/cda-client-secret-rotation-config-when-secret-is-stored-in-json-format.json"),
      ).rejects.toThrow();
    });

    it("should throw error when existing secret is not an array and isValueArray is set to true", async () => {
      const existingSecret = "old-consumer-secret";
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
      const { mockSecretManagerClient } = mockAWSSecretManagerClient();
      mockAWSGetSecretValueCommand({
        mockSecretManagerClient,
        mockResponse: existingSecret,
      });
      mockAWSUpdateSecretCommand({
        mockSecretManagerClient,
        mockResponse: {
          ARN: "test-arn",
          Name: secretName,
          VersionId: "7efd38fd-6c8a-4a51-80d1-4cd07df22df1",
        },
      });

      await expect(
        runSecretRotation(
          "./tests/integration/aws/mock-configs/cda-client-secret-rotation-when-secret-is-stored-as-array-in-plain-text-in-format.json",
        ),
      ).rejects.toThrow();
    });
  });
});
