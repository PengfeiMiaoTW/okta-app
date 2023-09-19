import { iif } from "../../src/utils/functions";
import { runSecretRotation } from "../../src/rotator";

const region = "sample-region";
const hashKey = "test-hash-key";
const sourceName = "Test API consumer client secret rotation";
const secretName = "test-secret-name";

beforeEach(() => {
  iif(function setupEnv() {
    process.env = {
      ...process.env,
      REGION: region,
      SOURCE_NAME: sourceName,
      HASH_KEY: hashKey,
      AWS_SECRET_NAME: secretName,
    };
  });
  jest.useFakeTimers();
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

jest.mock("@aws-sdk/client-secrets-manager", () => ({
  SecretsManagerClient: jest.fn(() => {
    throw new Error("mocked error");
  }),
}));

describe("Secret rotation in AWS secret manager - error scenario", () => {
  it("should throw error while initializing the aws secret manager client", async () => {
    await expect(runSecretRotation("./tests/integration/aws/mock-configs/static-token-rotation.json"))
      .rejects.toThrow();
  });
});


