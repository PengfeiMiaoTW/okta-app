import { decryptEncryptedReportFile, runSecretRotation } from "../../../src/rotator";
import { iif } from "../../../src/utils/functions";
import {
  mockAWSGetSecretValueCommand,
  mockAWSSecretManagerClient,
  mockAWSUpdateSecretCommand,
} from "../../test-helpers/mocks";
import { assertSecretManagerClientSendRequests } from "../../test-helpers/request";
import {
  assertContentsInDecryptedReportFile,
  assertContentsInEncryptedReportFile,
  assertIfTemporaryReportFileIsRemoved,
} from "../../test-helpers/files";
import { encryptedReportFileName } from "../../../src/data";


const oldToken = "old-token";
const hashKey = "test-hash-key";
const sourceName = "Test API consumer client secret rotation";
const secretName = "test-secret-name";

beforeEach(() => {
  iif(function setupEnv() {
    process.env = {
      ...process.env,
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

const newToken = "wgfdhgdjgfs345637EFSRETVNSBDJWBMFMD32t4ydfshfeydjghfdg";
jest.mock("generate-password", () => ({
  generate: jest.fn(() => newToken),
}));

describe("Static token Rotation", () => {
  describe("should generate the new token using the password config", () => {
    it("should update the secret in secret manager in JSON format", async () => {
      const existingSecret = {
        runtime: {
          session: {
            secret: oldToken,
          },
        },
      };
      const expectedSecret = {
        runtime: {
          session: {
            secret: newToken,
          },
        },
      };
      const expectedContentToBeAddedInReportFile = `New secret value for "${sourceName}": ${newToken}\n`;
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

      await runSecretRotation("./tests/integration/aws/mock-configs/static-token-rotation.json");

      // noinspection DuplicatedCode
      assertSecretManagerClientSendRequests({
        mockSecretManagerClient,
        sendRequestsInputFields: [
          {
            SecretId: secretName,
          },
          {
            SecretId: secretName,
            SecretString: JSON.stringify(expectedSecret),
          },
        ],
      });
      await assertContentsInEncryptedReportFile(expectedContentToBeAddedInReportFile);
      await assertIfTemporaryReportFileIsRemoved();
      await decryptEncryptedReportFile(encryptedReportFileName);
      await assertContentsInDecryptedReportFile(expectedContentToBeAddedInReportFile);
    });
  });
});


