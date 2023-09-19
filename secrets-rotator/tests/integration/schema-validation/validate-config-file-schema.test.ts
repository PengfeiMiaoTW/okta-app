import { iif } from "../../../src/utils/functions";
import "jest-extended";
import { validateJsonSchema } from "../../../src/utils/validate-schema";
import { getConfigData } from "../../../src/rotator";


const sendgridApiKeyName = "sendgrid-api-key-name";
const eventSubscriptionName = "application-event-subscription";
const eventSubscriptionAuthHeaderName = "test-subscription-auth-header";
const apiPlatformApiName = "application-service";
const oktaUrlToGenerateAccessTokenForApiGateway = "http://okta.com/access-token-from-client-id-client-secret";
const apiPlatformBaseUrl = "http://api-platform-base-url";
const apiPlatformConsumerClientId = "test-consumer-client-id";
const apiPlatformConsumerClientSecret = "test-consumer-client-secret";
const gcpProjectId = "12310283";
const gcpSecretName = "test-secret-name";
const apiPlatformAccessTokenGrantType = "test-grant";
const apiPlatformAccessTokenScope = "test-scope";
const gcloudKey = "ewogICJwcml2YXRlX2tleSI6ICIiLAogICJjbGllbnRfZW1haWwiOiAiIgp9Cg==";
const hashKey = "test-hash-key";
const sourceName = "Generate Password";
const dbUserName = "testuser";
const dbInstanceName = "test-db";
const gcpServiceAccountName = "svc-some-account@some-gcp-project.iam.gserviceaccount.com";
const circleCIUpdateEnvironmentVariableUrl = "https://circleci.com/api/v2/context/context-id/environment-variable/GCLOUD_KEY";
const circleCiApiToken = "test-circleci-api-token";
const oldSendGridApiKey = "old-sendgrid-api-key";
const workflowId1 = "workflow-000001";
const jobId1 = "job-000001";
const circleCIAccessToken = "test-token";
const secretName = "test-secret-name";
const usagePlanId = "test-usage-plan-id";
const region = "sample-region";


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
      DB_USERNAME: dbUserName,
      DB_INSTANCE_NAME_FOR_SECRET_ROTATION: dbInstanceName,
      EVENT_SUBSCRIPTION_NAME: eventSubscriptionName,
      EVENT_SUBSCRIPTION_AUTH_HEADER_NAME: eventSubscriptionAuthHeaderName,
      SENDGRID_API_KEY_NAME: sendgridApiKeyName,
      GCP_SERVICE_ACCOUNT_NAME: gcpServiceAccountName,
      CIRCLECI_CONTEXT_ENV_VARIABLE_UPDATE_URL: circleCIUpdateEnvironmentVariableUrl,
      CIRCLECI_API_TOKEN: circleCiApiToken,
      SENDGRID_API_KEY: oldSendGridApiKey,
      AWS_SECRET_NAME: secretName,
      USAGE_PLAN_ID: usagePlanId,
      REGION: region,
    };
  });
  jest.useFakeTimers();
});


describe("configuration files schema validation", () => {
  describe("schema validation successful scenarios", () => {

    it.each([
      "./tests/integration/gcp/mock-configs/api-platform-api-token-rotation-config-for-secrets-in-json-format.json",
      "./tests/integration/gcp/mock-configs/api-platform-api-token-rotation-config-for-secrets-with-redeploy-array-in-json-format.json",
      "./tests/integration/gcp/mock-configs/api-platform-api-token-rotation-config-for-secrets-in-plain-text-format.json",
      "./tests/integration/gcp/mock-configs/api-platform-api-token-rotation-config-for-secrets-with-keyFieldNames-in-json-format.json",
      "./tests/integration/gcp/mock-configs/app-session-secret-rotation-config.json",
      "./tests/integration/gcp/mock-configs/cda-client-secret-rotation-config-when-secret-is-stored-in-json-format.json",
      "./tests/integration/gcp/mock-configs/cda-client-secret-rotation-when-secret-is-stored-in-plain-text-in-format.json",
      "./tests/integration/gcp/mock-configs/cda-client-secret-rotation-config-with-keyFieldNames-when-secret-is-stored-in-json-format.json",
      "./tests/integration/gcp/mock-configs/db-rotation-config.json",
      "./tests/integration/gcp/mock-configs/event-subscription-token-rotation-config-for-secrets-in-json-format.json",
      "./tests/integration/gcp/mock-configs/event-subscription-token-rotation-config-for-secrets-in-plain-text-format.json",
      "./tests/integration/gcp/mock-configs/event-subscription-token-rotation-config-for-secrets-with-keyFieldNames-in-json-format.json",
      "./tests/integration/gcp/mock-configs/sendgrid-key-rotation-config.json",
      "./tests/integration/gcp/mock-configs/service-account-rotation-config.json",
      "./tests/integration/aws/mock-configs/static-token-rotation.json",
      "./tests/integration/aws/mock-configs/cda-client-secret-rotation-config-when-secret-is-stored-as-array-in-json-format.json",
      "./tests/integration/aws/mock-configs/cda-client-secret-rotation-config-with-keyFieldNames-when-secret-is-stored-in-json-format.json",
      "./tests/integration/aws/mock-configs/valid-aws-api-gateway-api-key-rotation-config.json",
      "./tests/integration/aws/mock-configs/aws-api-gateway-api-key-rotation-config-as-source-action.json",
    ])("should not throw error given valid config file", async (configFilePath) => {
      const configFileData = await getConfigData(configFilePath);
      expect(
        () => validateJsonSchema(configFileData),
      ).not.toThrow();
    });
  });

  describe("schema validation failure scenarios", () => {
    it("should throw error for invalid gcp config file", async () => {
      const configFileData = await getConfigData("./tests/integration/gcp/mock-configs/app-session-secret-rotation-invalid-config.json");
      expect(
        () => validateJsonSchema(configFileData),
      ).toThrowErrorMatchingSnapshot();
    });

    it.each([
      "./tests/integration/aws/mock-configs/invalid-aws-secret-manager-secret-rotation-config.json",
      "./tests/integration/aws/mock-configs/invalid-aws-api-gateway-api-key-rotation-config.json",
    ])("should throw error for invalid aws config files", async (configFilePath) => {
      const configFileData = await getConfigData(configFilePath);
      expect(
        () => validateJsonSchema(configFileData),
      ).toThrowErrorMatchingSnapshot();
    });
  });
});
