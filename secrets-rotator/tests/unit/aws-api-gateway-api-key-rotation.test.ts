import { iif } from "../../src/utils/functions";
import { runSecretRotation } from "../../src/rotator";

const usagePlanId = "sample-usage-plan";
const region = "sample-region";
const hashKey = "test-hash-key";
const sourceName = "Test API consumer client secret rotation";
const restApiId = "sample-rest-api-id";
const stageNameDev = "dev";
const stageNameQa = "qa";

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

jest.mock("@aws-sdk/client-api-gateway", () => ({
  APIGatewayClient: jest.fn(() => {
    throw new Error("mocked error");
  }),
}));

describe("AWS API gateway api key Rotation - error scenario", () => {
  it("should throw error while initializing the api gateway client", async () => {
    await expect(runSecretRotation("./tests/integration/aws/mock-configs/aws-api-gateway-api-key-rotation-config.json"))
      .rejects.toThrow();
  });
});


