import { decryptEncryptedReportFile, runSecretRotation } from "../../../src/rotator";
import { iif } from "../../../src/utils/functions";
import { mockGCPSecretManager } from "../../test-helpers/mocks";
import client from "@sendgrid/client";
import { when } from "jest-when";
import { createBufferForSecretManager } from "../../../src/utils/secret-manager";
import {
  assertContentsInDecryptedReportFile,
  assertContentsInEncryptedReportFile,
  assertIfTemporaryReportFileIsRemoved,
} from "../../test-helpers/files";
import { encryptedReportFileName } from "../../../src/data";

const oldSendGridApiKey = "old-sendgrid-api-key";
const newSendGridApiKey = "new-sendgrid-api-key";
const sendgridApiKeyName = "sendgrid-api-key-name";
const gcpProjectId = "12310283";
const gcpSecretName = "test-secret-name";
const gcloudKey = "ewogICJwcml2YXRlX2tleSI6ICIiLAogICJjbGllbnRfZW1haWwiOiAiIgp9Cg==";
const hashKey = "test-hash-key";
const sourceName = "Test SendGrid API key rotation";

beforeAll(() => {
  iif(function setupEnv() {
    process.env = {
      SOURCE_NAME: sourceName,
      HASH_KEY: hashKey,
      SENDGRID_API_KEY: oldSendGridApiKey,
      GCP_PROJECT_ID: gcpProjectId,
      GCP_SECRET_NAME: gcpSecretName,
      SENDGRID_API_KEY_NAME: sendgridApiKeyName,
      GCLOUD_KEY: gcloudKey,
    };
  });
});

afterAll(() => {
  jest.restoreAllMocks();
});

describe("Sendgrid API key rotation", () => {
  describe("should rotate the api key in send grid sucessfully", () => {
    it("should update it in secret manager", async () => {
      const existingSecret = {
        mailNotification: {
          apiKey: oldSendGridApiKey,
        },
      };
      const expectedSecretAfterUpdatingInSecretManager = {
        mailNotification: {
          apiKey: newSendGridApiKey,
        },
      };
      const secretManagerPath = `projects/${gcpProjectId}/secrets/${gcpSecretName}`;
      const oldApiKeyId = "old-api-key-id";
      const expectedContentToBeAddedInReportFile = `New secret value for "${sourceName}": ${newSendGridApiKey}\n`;
      const existingSecretPath = `${secretManagerPath}/48`;
      const mockSendGridClientRequest = jest.fn();
      client.request = mockSendGridClientRequest;
      client.setApiKey = jest.fn();
      when(mockSendGridClientRequest)
        .calledWith({
          method: "GET",
          url: "/v3/api_keys",
        })
        .mockResolvedValue([{
          body: {
            result: [{
              name: sendgridApiKeyName,
              // eslint-disable-next-line camelcase
              api_key_id: oldApiKeyId,
            }],
          },
        }]);

      when(mockSendGridClientRequest)
        .calledWith({
          method: "POST",
          url: "/v3/api_keys",
          body: {
            name: sendgridApiKeyName,
          },
        })
        .mockResolvedValue([{
          body: {
            name: sendgridApiKeyName,
            // eslint-disable-next-line camelcase
            api_key_id: "new-api-key-id",   // remove if not needed.
            // eslint-disable-next-line camelcase
            api_key: newSendGridApiKey,
          },
        }]);
      when(mockSendGridClientRequest)
        .calledWith({
          method: "DELETE",
          url: `/v3/api_keys/${oldApiKeyId}`,
        })
        .mockResolvedValue([] as string[]);

      const { mockAccessSecretVersion, mockDisableSecretVersion, mockAddSecretVersion } = mockGCPSecretManager();
      mockAccessSecretVersion.mockResolvedValue([{
        name: existingSecretPath,
        payload: {
          data: createBufferForSecretManager(existingSecret),
        },
      }]);
      mockAddSecretVersion.mockResolvedValue([{
        name: secretManagerPath,
        payload: {
          data: createBufferForSecretManager(expectedSecretAfterUpdatingInSecretManager),
        },
      }]);
      mockDisableSecretVersion.mockResolvedValue([{
        name: existingSecretPath,
      }]);

      await runSecretRotation("./tests/integration/gcp/mock-configs/sendgrid-key-rotation-config.json");

      iif(function assertSendGridApiKeyIsRotated() {
        expect(mockSendGridClientRequest.mock.calls).toEqual([
          [{
            method: "GET",
            url: "/v3/api_keys",
          }],
          [{
            method: "POST",
            url: "/v3/api_keys",
            body: {
              name: sendgridApiKeyName,
            },
          }],
          [{
            method: "DELETE",
            url: `/v3/api_keys/${oldApiKeyId}`,
          }],
        ]);
      });
      iif(function assertSecretsAreRotatedInSecretManager() {
        expect(mockAccessSecretVersion).toBeCalledTimes(1);
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
            name: existingSecretPath,
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
