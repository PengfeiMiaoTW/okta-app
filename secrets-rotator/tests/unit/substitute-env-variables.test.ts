import { iif } from "../../src/utils/functions";
import { substituteEnvironmentVariables } from "../../src/rotator";

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

const config = {
  source: {
    name: "Test API key rotation",
    action: {
      type: "API_PLATFORM_API_SERVICE_TOKEN_SOURCE",
      apiName: "${API_PLATFORM_API_NAME}",
      apiKeyHeaderName: "x-api-key",
      apiPlatformUrl: "${API_PLATFORM_URL}",
      authentication: {
        type: "OAUTH_2",
        clientId: "${API_PLATFORM_CLIENT_ID}",
        clientSecret: "${API_PLATFORM_CLIENT_SECRET}",
        tokenUrl: "${API_PLATFORM_TOKEN_URL}",
        grantType: "${API-PLATFORM-ACCESS-TOKEN-GRANT-TYPE}",
        scope: "${API-PLATFORM-ACCESS-TOKEN-SCOPE}",
        testFieldToCheckSameEnvVarName: "${API-PLATFORM-ACCESS-TOKEN-SCOPE}",
      },
    },
  },
};


it("should replace the text having $ symbol with corresponding environment variables", () => {
  iif(function setupEnvironment() {
    process.env = {
      API_PLATFORM_API_NAME: apiPlatformApiName,
      API_PLATFORM_TOKEN_URL: oktaUrlToGenerateAccessTokenForApiGateway,
      API_PLATFORM_URL: apiPlatformBaseUrl,
      API_PLATFORM_CLIENT_ID: apiPlatformConsumerClientId,
      API_PLATFORM_CLIENT_SECRET: apiPlatformConsumerClientSecret,
      "API-PLATFORM-ACCESS-TOKEN-GRANT-TYPE": apiPlatformAccessTokenGrantType,
      "API-PLATFORM-ACCESS-TOKEN-SCOPE": apiPlatformAccessTokenScope,
      GCP_PROJECT_ID: gcpProjectId,
      GCP_SECRET_NAME: gcpSecretName,
      GCLOUD_KEY: gcloudKey,
    };
  });

  expect(JSON.parse(substituteEnvironmentVariables(JSON.stringify(config)))).toEqual({
    source: {
      name: "Test API key rotation",
      action: {
        type: "API_PLATFORM_API_SERVICE_TOKEN_SOURCE",
        apiName: apiPlatformApiName,
        apiKeyHeaderName: "x-api-key",
        apiPlatformUrl: apiPlatformBaseUrl,
        authentication: {
          type: "OAUTH_2",
          clientId: apiPlatformConsumerClientId,
          clientSecret: apiPlatformConsumerClientSecret,
          tokenUrl: oktaUrlToGenerateAccessTokenForApiGateway,
          grantType: apiPlatformAccessTokenGrantType,
          scope: apiPlatformAccessTokenScope,
          testFieldToCheckSameEnvVarName: apiPlatformAccessTokenScope,
        },
      },
    },
  });
});
