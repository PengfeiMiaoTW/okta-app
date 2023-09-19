import castTo from "../../../src/utils/cast-to";
import { decryptEncryptedReportFile, runSecretRotation } from "../../../src/rotator";
import { iif } from "../../../src/utils/functions";
import * as gcpAuthentication from "../../../src/gcp/authorization";
import { GoogleApis } from "googleapis/build/src/googleapis";
import { assertApiRequest, mockAxios } from "../../test-helpers/request";
import { getCredentialsForBasicAuth } from "../../../src/utils/api";
import {
  assertContentsInDecryptedReportFile,
  assertContentsInEncryptedReportFile,
  assertIfTemporaryReportFileIsRemoved,
} from "../../test-helpers/files";
import { encryptedReportFileName } from "../../../src/data";

const gcpServiceAccountName = "svc-some-account@some-gcp-project.iam.gserviceaccount.com";
const circleCIUpdateEnvironmentVariableUrl = "https://circleci.com/api/v2/context/context-id/environment-variable/GCLOUD_KEY";
const circleCiApiToken = "test-circleci-api-token";
const gcpProjectId = "12310283";
const gcloudKey = "ewogICJwcml2YXRlX2tleSI6ICIiLAogICJjbGllbnRfZW1haWwiOiAiIgp9Cg==";
const hashKey = "test-hash-key";
const sourceName = "Service Account Key Rotation";

beforeAll(() => {
  iif(function setupEnv() {
    process.env = {
      SOURCE_NAME: sourceName,
      HASH_KEY: hashKey,
      GCP_SERVICE_ACCOUNT_NAME: gcpServiceAccountName,
      CIRCLECI_CONTEXT_ENV_VARIABLE_UPDATE_URL: circleCIUpdateEnvironmentVariableUrl,
      CIRCLECI_API_TOKEN: circleCiApiToken,
      GCP_PROJECT_ID: gcpProjectId,
      GCLOUD_KEY: gcloudKey,
    };
  });
});

afterAll(() => {
  jest.restoreAllMocks();
});


describe("GCP Service Account Key Rotation", () => {
  describe("should rotate the service account key", () => {
    it("should update the environment variable in circleCI context", async () => {
      const newServiceAccountKeyResponse = {
        name: `projects/${gcpProjectId}/serviceAccounts/${gcpServiceAccountName}/keys/4df532f98c7445508d8af41b1ff3a9955c7d5ca5`,
        privateKeyData: "eyBzb21lS2V5OnNmc2Zkc2ZkZnN9Cg==",
        privateKeyType: "TYPE_GOOGLE_CREDENTIALS_FILE",
        validAfterTime: "2021-11-22T06:42:18Z",
        validBeforeTime: "9999-12-31T23:59:59Z",
        keyAlgorithm: "KEY_ALG_RSA_2048",
        keyOrigin: "GOOGLE_PROVIDED",
        keyType: "USER_MANAGED",
      };
      const oldServiceAccountKeysResponse = [
        {
          name: `projects/${gcpProjectId}/serviceAccounts/${gcpServiceAccountName}/keys/5df532f98c7445508d8af41b1ff3a9955c7d5ca5`,
          validAfterTime: "2021-11-22T05:34:17Z",
          validBeforeTime: "9999-12-31T23:59:59Z",
          keyAlgorithm: "KEY_ALG_RSA_2048",
          keyOrigin: "GOOGLE_PROVIDED",
          keyType: "USER_MANAGED",
        },
        {
          name: `projects/${gcpProjectId}/serviceAccounts/${gcpServiceAccountName}/keys/6df532f98c7445508d8af41b1ff3a9955c7d5ca5`,
          validAfterTime: "2021-11-22T05:34:17Z",
          validBeforeTime: "9999-12-31T23:59:59Z",
          keyAlgorithm: "KEY_ALG_RSA_2048",
          keyOrigin: "GOOGLE_PROVIDED",
          keyType: "USER_MANAGED",
        },
      ];
      const mockServiceAccountKeyCreate = jest.fn().mockResolvedValue({
        data: newServiceAccountKeyResponse,
      });
      const expectedContentToBeAddedInReportFile = `New secret value for "${sourceName}": ${newServiceAccountKeyResponse.privateKeyData}\n`;
      const mockServiceAccountKeyDelete = jest.fn();
      jest
        .spyOn(gcpAuthentication, "initializeGoogleApis")
        .mockResolvedValueOnce(castTo<GoogleApis>({
          iam: jest.fn().mockReturnValue({
            projects: {
              serviceAccounts: {
                keys: {
                  create: mockServiceAccountKeyCreate,
                  list: jest.fn().mockResolvedValue({
                    data: {
                      keys: [
                        ...oldServiceAccountKeysResponse,
                        newServiceAccountKeyResponse,
                      ],
                    },
                  }),
                  delete: mockServiceAccountKeyDelete,
                },
              },
            },
          }),
        }));
      const mockedAxiosInstance = mockAxios();
      mockedAxiosInstance
        .onPut(circleCIUpdateEnvironmentVariableUrl)
        .reply(
          200,
          {},
        );

      await runSecretRotation("./tests/integration/gcp/mock-configs/service-account-rotation-config.json");

      iif(function assertServiceAccountKeyIsRotated() {
        expect(mockServiceAccountKeyCreate).toBeCalledTimes(1);
        expect(mockServiceAccountKeyCreate).toBeCalledWith({
          name: `projects/${gcpProjectId}/serviceAccounts/${gcpServiceAccountName}`,
        });
      });
      iif(function assertOldServiceAccountKeyIsDeleted() {
        expect(mockServiceAccountKeyDelete).toBeCalledTimes(2);
        expect(mockServiceAccountKeyDelete.mock.calls).toEqual([
          [{
            name: oldServiceAccountKeysResponse[0].name,
          }],
          [{
            name: oldServiceAccountKeysResponse[1].name,
          }],
        ]);
      });
      iif(function assertCircleCIContextEnvironmentVariableIsRotated() {
        assertApiRequest(
          mockedAxiosInstance,
          {
            url: circleCIUpdateEnvironmentVariableUrl,
            data: JSON.stringify({ value: newServiceAccountKeyResponse.privateKeyData }),
            headers: {
              Authorization: `Basic ${getCredentialsForBasicAuth({
                userName: circleCiApiToken,
                password: "",
              })}`,
            },
            method: "put",
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
