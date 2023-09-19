import { promises as fs } from "fs";
import { decryptedReportFileName, encryptedReportFileName, outputFileName } from "../../src/data";
import { decrypt } from "../../src/utils/encrypt";

export async function assertContentsInEncryptedReportFile(expectedContentToBeEncrypted: string) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const fileContents = await fs.readFile(encryptedReportFileName);
  expect(decrypt(fileContents).toString()).toEqual(expectedContentToBeEncrypted);
}

export async function assertIfTemporaryReportFileIsRemoved() {
  await expect(fs.access(outputFileName)).rejects.toThrowError();
}

export async function assertContentsInDecryptedReportFile(expectedContent: string) {
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const fileContents = await fs.readFile(decryptedReportFileName);
  expect(fileContents.toString()).toEqual(expectedContent);
}
