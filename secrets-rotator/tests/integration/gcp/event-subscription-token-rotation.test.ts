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

const eventSubscriptionName = "application-event-subscription";
const eventSubscriptionAuthHeaderName = "test-subscription-auth-header";
const oktaUrlToGenerateAccessTokenForApiGateway = "http://okta.com/access-token-from-client-id-client-secret";
const apiPlatformBaseUrl = "http://api-platform-base-url";
const apiPlatformUrlToUpdateEventSubscription = `${apiPlatformBaseUrl}/event-subscribers/v2/subscriptions/${eventSubscriptionName}`;
const apiPlatformConsumerClientId = "test-consumer-client-id";
const apiPlatformConsumerClientSecret = "test-consumer-client-secret";
const latestEventSubscriptionToken = "latest-event-subscription-token";
const gcpProjectId = "12310283";
const gcpSecretName = "test-secret-name";
const oktaAccessTokenToApiGateway = "test-access-token";
const apiPlatformAccessTokenGrantType = "test-grant";
const apiPlatformAccessTokenScope = `events.${eventSubscriptionName}`;
const gcloudKey = "ewogICJwcml2YXRlX2tleSI6ICIiLAogICJjbGllbnRfZW1haWwiOiAiIgp9Cg==";
const hashKey = "test-hash-key";
const sourceName = "Generate Password";
const oldEventSubscriptionToken = "old-event-subscription-token";
const currentEventSubscriptionToken = "current-event-subscription-token";
const workflowId = "workflow-000001";
const jobId = "job-000001";
const newWorkflowId = "workflow-000002";
const projectSlug = "test-slug";
const reRunJobNumber = 5503;
const circleCIAccessToken = "test-token";
const jobName = "deploy";


jest.mock("generate-password", () => ({
  generate: jest.fn().mockReturnValue("latest-event-subscription-token"),
}));

describe("Event subscription token rotation", () => {
  beforeEach(() => {
    iif(function setupEnv() {
      process.env = {
        ...process.env,
        SOURCE_NAME: sourceName,
        HASH_KEY: hashKey,
        EVENT_SUBSCRIPTION_NAME: eventSubscriptionName,
        API_PLATFORM_TOKEN_URL: oktaUrlToGenerateAccessTokenForApiGateway,
        API_PLATFORM_URL: apiPlatformBaseUrl,
        API_PLATFORM_CLIENT_ID: apiPlatformConsumerClientId,
        API_PLATFORM_CLIENT_SECRET: apiPlatformConsumerClientSecret,
        API_PLATFORM_ACCESS_TOKEN_GRANT_TYPE: apiPlatformAccessTokenGrantType,
        GCP_PROJECT_ID: gcpProjectId,
        GCP_SECRET_NAME: gcpSecretName,
        GCLOUD_KEY: gcloudKey,
        WORKFLOW_ID: workflowId,
        JOB_ID: jobId,
        CIRCLE_CI_ACCESS_TOKEN: circleCIAccessToken,
        EVENT_SUBSCRIPTION_AUTH_HEADER_NAME: eventSubscriptionAuthHeaderName,
      };
    });
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  describe("should generate the new token using the password config", () => {
    it("should update it in secret manager consumers with Json format and in api platform", async () => {
      const existingSecret = {
        eventSubscription: {
          apiToken: [oldEventSubscriptionToken, currentEventSubscriptionToken],
          serviceToken: currentEventSubscriptionToken,
        },
      };
      const expectedSecretAfterUpdatingTheFirstSecretManagerConsumer = {
        eventSubscription: {
          apiToken: [currentEventSubscriptionToken, latestEventSubscriptionToken],
          serviceToken: currentEventSubscriptionToken,
        },
      };
      const expectedSecretAfterUpdatingTheSecondSecretManagerConsumer = {
        eventSubscription: {
          apiToken: [currentEventSubscriptionToken, latestEventSubscriptionToken],
          serviceToken: latestEventSubscriptionToken,
        },
      };
      const secretManagerPath = `projects/${gcpProjectId}/secrets/${gcpSecretName}`;
      const expectedContentToBeAddedInReportFile = `New secret value for "${sourceName}": ${latestEventSubscriptionToken}\n`;
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
        .onPut(apiPlatformUrlToUpdateEventSubscription)
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

      await runSecretRotation("./tests/integration/gcp/mock-configs/event-subscription-token-rotation-config-for-secrets-in-json-format.json");

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
      iif(function assertEventSubscriptionTokenIsUpdatedInEventPlatform() {
        assertApiRequest(
          mockedAxiosInstance,
          {
            url: apiPlatformUrlToUpdateEventSubscription,
            data: JSON.stringify({
              notification: {
                auth: {
                  header: eventSubscriptionAuthHeaderName,
                  value: latestEventSubscriptionToken,
                },
              },
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
      await assertContentsInEncryptedReportFile(expectedContentToBeAddedInReportFile);
      await assertIfTemporaryReportFileIsRemoved();
      await decryptEncryptedReportFile(encryptedReportFileName);
      await assertContentsInDecryptedReportFile(expectedContentToBeAddedInReportFile);
    });
    it("should update it in secret manager consumers with Json format and in api platform when config file has keyFieldNames array", async () => {
      const existingSecret = {
        eventSubscription: {
          apiToken: [oldEventSubscriptionToken, currentEventSubscriptionToken],
          serviceToken: currentEventSubscriptionToken,
        },
      };
      const expectedSecretAfterUpdatingTheFirstSecretManagerConsumer = {
        eventSubscription: {
          apiToken: [currentEventSubscriptionToken, latestEventSubscriptionToken],
          serviceToken: latestEventSubscriptionToken,
        },
      };
      const secretManagerPath = `projects/${gcpProjectId}/secrets/${gcpSecretName}`;
      const expectedContentToBeAddedInReportFile = `New secret value for "${sourceName}": ${latestEventSubscriptionToken}\n`;
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
        .onPut(apiPlatformUrlToUpdateEventSubscription)
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
      jest.spyOn(global, "setTimeout");
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

      await runSecretRotation("./tests/integration/gcp/mock-configs/event-subscription-token-rotation-config-for-secrets-with-keyFieldNames-in-json-format.json");

      iif(function assertSecretsAreRotatedInSecretManager() {
        expect(mockAddSecretVersion).toBeCalledTimes(1);
        expect(mockAddSecretVersion.mock.calls).toEqual([
          [{
            parent: secretManagerPath,
            payload: {
              data: createBufferForSecretManager(expectedSecretAfterUpdatingTheFirstSecretManagerConsumer),
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
      iif(function assertEventSubscriptionTokenIsUpdatedInEventPlatform() {
        assertApiRequest(
          mockedAxiosInstance,
          {
            url: apiPlatformUrlToUpdateEventSubscription,
            data: JSON.stringify({
              notification: {
                auth: {
                  header: eventSubscriptionAuthHeaderName,
                  value: latestEventSubscriptionToken,
                },
              },
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
      await assertContentsInEncryptedReportFile(expectedContentToBeAddedInReportFile);
      await assertIfTemporaryReportFileIsRemoved();
      await decryptEncryptedReportFile(encryptedReportFileName);
      await assertContentsInDecryptedReportFile(expectedContentToBeAddedInReportFile);
    });

    it("should update it in secret manager consumers with text format and in api platform", async () => {
      const existingSecret = [oldEventSubscriptionToken, currentEventSubscriptionToken];
      const expectedSecretAfterUpdatingTheSecretManager = [currentEventSubscriptionToken, latestEventSubscriptionToken];
      const secretManagerPath = `projects/${gcpProjectId}/secrets/${gcpSecretName}`;
      const expectedContentToBeAddedInReportFile = `New secret value for "${sourceName}": ${latestEventSubscriptionToken}\n`;
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
        .onPut(apiPlatformUrlToUpdateEventSubscription)
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

      await runSecretRotation("./tests/integration/gcp/mock-configs/event-subscription-token-rotation-config-for-secrets-in-plain-text-format.json");

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
            url: apiPlatformUrlToUpdateEventSubscription,
            data: JSON.stringify({
              notification: {
                auth: {
                  header: eventSubscriptionAuthHeaderName,
                  value: latestEventSubscriptionToken,
                },
              },
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
      await assertContentsInEncryptedReportFile(expectedContentToBeAddedInReportFile);
      await assertIfTemporaryReportFileIsRemoved();
      await decryptEncryptedReportFile(encryptedReportFileName);
      await assertContentsInDecryptedReportFile(expectedContentToBeAddedInReportFile);
    });
  });
});
