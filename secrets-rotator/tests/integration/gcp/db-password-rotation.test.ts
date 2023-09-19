import { iif } from "../../../src/utils/functions";
import { mockGCPSecretManager, mockGcpSqlUserUpdate } from "../../test-helpers/mocks";
import { decryptEncryptedReportFile, runSecretRotation } from "../../../src/rotator";
import { createBufferForSecretManager } from "../../../src/utils/secret-manager";
import {
  assertContentsInDecryptedReportFile,
  assertContentsInEncryptedReportFile,
  assertIfTemporaryReportFileIsRemoved,
} from "../../test-helpers/files";
import { encryptedReportFileName } from "../../../src/data";

const dbUserName = "testuser";
const dbInstanceName = "test-db";
const gcpProjectId = "12310283";
const gcpSecretName = "test-secret-name";
const gcloudKey = "ewogICJwcml2YXRlX2tleSI6ICIiLAogICJjbGllbnRfZW1haWwiOiAiIgp9Cg==";
const hashKey = "test-hash-key";
const sourceName = "Test Db";

beforeAll(() => {
  iif(function setupEnv() {
    process.env = {
      SOURCE_NAME: sourceName,
      HASH_KEY: hashKey,
      DB_USERNAME: dbUserName,
      DB_INSTANCE_NAME_FOR_SECRET_ROTATION: dbInstanceName,
      GCP_PROJECT_ID: gcpProjectId,
      GCP_SECRET_NAME: gcpSecretName,
      GCLOUD_KEY: gcloudKey,
    };
  });
});

afterAll(() => {
  jest.restoreAllMocks();
});

jest.mock("generate-password", () => ({
  generate: jest.fn().mockReturnValue("new-password"),
}));

describe("DB password rotation", () => {
  describe("should rotate the db passwords successfully", () => {
    it("should update it in secret manager", async () => {
      const existingSecret = {
        deployment: {
          dbPassword: "old-password",
          databaseName: "db-name",
        },
        runtime: {
          dbPassword: "old-password",
          databaseName: "db-name",
        },
      };
      const newPassword = "new-password";
      const expectedSecretValueAfterFirstConsumerUpdate = {
        deployment: {
          dbPassword: newPassword,
          databaseName: "db-name",
        },
        runtime: {
          dbPassword: "old-password",
          databaseName: "db-name",
        },
      };
      const expectedSecretValueAfterSecondConsumerUpdate = {
        deployment: {
          dbPassword: newPassword,
          databaseName: "db-name",
        },
        runtime: {
          dbPassword: newPassword,
          databaseName: "db-name",
        },
      };
      const secretManagerPath = `projects/${gcpProjectId}/secrets/${gcpSecretName}`;
      const expectedContentToBeAddedInReportFile = `New secret value for "${sourceName}": ${newPassword}\n`;
      const mockSqlUserUpdate = mockGcpSqlUserUpdate({ data: "" });
      const { mockAccessSecretVersion, mockDisableSecretVersion, mockAddSecretVersion } = mockGCPSecretManager();
      mockAccessSecretVersion
        .mockResolvedValueOnce([{
          name: `${secretManagerPath}/48`,
          payload: {
            data: createBufferForSecretManager(existingSecret),
          },
        }])
        .mockResolvedValueOnce([{
          name: `${secretManagerPath}/49`,
          payload: {
            data: createBufferForSecretManager(expectedSecretValueAfterFirstConsumerUpdate),
          },
        }]);
      mockAddSecretVersion
        .mockResolvedValueOnce([{
          name: secretManagerPath,
          payload: {
            data: createBufferForSecretManager(expectedSecretValueAfterFirstConsumerUpdate),
          },
        }])
        .mockResolvedValueOnce([{
          name: secretManagerPath,
          payload: {
            data: createBufferForSecretManager(expectedSecretValueAfterSecondConsumerUpdate),
          },
        }]);
      mockDisableSecretVersion
        .mockResolvedValueOnce([{
          name: `${secretManagerPath}/48`,
        }])
        .mockResolvedValueOnce([{
          name: `${secretManagerPath}/49`,
        }]);
      await runSecretRotation("./tests/integration/gcp/mock-configs/db-rotation-config.json");

      iif(function assertDatabasePasswordIsUpdated() {
        expect(mockSqlUserUpdate).toBeCalledTimes(1);
        expect(mockSqlUserUpdate).toBeCalledWith({
          name: dbUserName,
          instance: dbInstanceName,
          project: gcpProjectId,
          requestBody: {
            password: newPassword,
          },
        });
      });
      iif(function assertSecretsAreRotatedInSecretManager() {
        expect(mockAddSecretVersion).toBeCalledTimes(2);
        expect(mockAddSecretVersion.mock.calls).toEqual([
          [{
            parent: secretManagerPath,
            payload: {
              data: createBufferForSecretManager(expectedSecretValueAfterFirstConsumerUpdate),
            },
          }],
          [{
            parent: secretManagerPath,
            payload: {
              data: createBufferForSecretManager(expectedSecretValueAfterSecondConsumerUpdate),
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
      await assertContentsInEncryptedReportFile(expectedContentToBeAddedInReportFile);
      await assertIfTemporaryReportFileIsRemoved();
      await decryptEncryptedReportFile(encryptedReportFileName);
      await assertContentsInDecryptedReportFile(expectedContentToBeAddedInReportFile);
    });
  });
});
