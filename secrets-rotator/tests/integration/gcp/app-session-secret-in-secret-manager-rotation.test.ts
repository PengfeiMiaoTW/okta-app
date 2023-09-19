import { decryptEncryptedReportFile, runSecretRotation } from "../../../src/rotator";
import { iif } from "../../../src/utils/functions";
import { mockGCPSecretManager } from "../../test-helpers/mocks";
import { createBufferForSecretManager } from "../../../src/utils/secret-manager";
import {
  assertContentsInDecryptedReportFile,
  assertContentsInEncryptedReportFile,
  assertIfTemporaryReportFileIsRemoved,
} from "../../test-helpers/files";
import { encryptedReportFileName } from "../../../src/data";

const gcpProjectId = "12310283";
const gcpSecretName = "test-secret-1";
const gcloudKey = "ewogICJwcml2YXRlX2tleSI6ICIiLAogICJjbGllbnRfZW1haWwiOiAiIgp9Cg==";
const hashKey = "test-hash-key";
const sourceName = "Test Rotate App Session Secret";

beforeAll(() => {
  iif(function setupEnv() {
    process.env = {
      SOURCE_NAME: sourceName,
      HASH_KEY: hashKey,
      GCP_SECRET_NAME: gcpSecretName,
      GCP_PROJECT_ID: gcpProjectId,
      GCLOUD_KEY: gcloudKey,
    };
  });
});

afterAll(() => {
  jest.restoreAllMocks();
});

jest.mock("generate-password", () => ({
  generate: jest.fn().mockReturnValue("new-session-secret"),
}));

describe("Rotate secrets in secretManager", () => {
  it("should update secrets in secret manager", async () => {
    const existingSecret = {
      runtime: {
        session: {
          secret: "old-session-secret",
        },
      },
    };
    const newSessionSecret = "new-session-secret";
    const expectedSecretAfterUpdatingInSecretManager = {
      runtime: {
        session: {
          secret: newSessionSecret,
        },
      },
    };
    const secretManagerPath = `projects/${gcpProjectId}/secrets/${gcpSecretName}`;
    const expectedContentToBeAddedInReportFile = `New secret value for "${sourceName}": ${newSessionSecret}\n`;
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

    await runSecretRotation("./tests/integration/gcp/mock-configs/app-session-secret-rotation-config.json");

    iif(function assertSecretsAreRotatedInSecretManager() {
      expect(mockAddSecretVersion).toBeCalledTimes(1);
      expect(mockDisableSecretVersion).toBeCalledTimes(1);
      expect(mockAddSecretVersion.mock.calls).toEqual([
        [{
          parent: secretManagerPath,
          payload: {
            data: createBufferForSecretManager(expectedSecretAfterUpdatingInSecretManager),
          },
        }],
      ]);
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
