import { initializeGoogleApis } from "./authorization";
import { GCPServiceAccountKeySourceAction } from "../types";
import { iam_v1 } from "googleapis";
import Schema$ServiceAccountKey = iam_v1.Schema$ServiceAccountKey;

async function createServiceAccountKey(iam: iam_v1.Iam, serviceAccountNameWithProjectId: string) {
  try {
    console.info("Generating new service account key.");
    const res = await iam.projects.serviceAccounts.keys.create({
      name: serviceAccountNameWithProjectId,
    });
    const newKey = res.data;
    console.info("Successfully generated new service account key.");
    return newKey;
  } catch (error) {
    console.info("Failed to generate new service account key.");
    throw error;
  }
}

async function getAllServiceAccountKeys(iam: iam_v1.Iam, serviceAccountNameWithProjectId: string) {
  try {
    console.info("Fetching all service account keys.");
    const res = await iam.projects.serviceAccounts.keys.list({
      keyTypes: ["USER_MANAGED"],
      name: serviceAccountNameWithProjectId,
    });
    const keys = res.data.keys;
    console.info("Successfully fetched all service account keys.");
    return keys;
  } catch (error) {
    console.info("Failed to fetch all service account keys.");
    throw error;
  }
}

async function deleteServiceAccountKeys(iam: iam_v1.Iam, serviceAccountKeys: Schema$ServiceAccountKey[]) {
  try {
    console.info("Deleting old service account keys.");
    await Promise.all(serviceAccountKeys.map((serviceAccountKey) => (
      iam.projects.serviceAccounts.keys.delete({
        name: serviceAccountKey.name,
      })
    )));
    console.info("Successfully deleted old service account keys.");
  } catch (error) {
    console.info("Failed to delete old service account keys.");
    throw error;
  }
}

export async function rotateServiceAccount(config: GCPServiceAccountKeySourceAction) {
  console.info("Start rotating service account keys.");
  const google = await initializeGoogleApis(config.authentication);
  const iam = google.iam("v1");
  const serviceAccountNameWithProjectId = `projects/${config.projectId}/serviceAccounts/${config.serviceAccountName}`;
  const newServiceAccountKey = await createServiceAccountKey(iam, serviceAccountNameWithProjectId);
  const serviceAccountKeyBase64Encoded = newServiceAccountKey.privateKeyData;
  const serviceAccountKeys = await getAllServiceAccountKeys(iam, serviceAccountNameWithProjectId);
  const oldServiceAccountKeys = serviceAccountKeys.filter((serviceAccountKey) =>
    serviceAccountKey.name !== newServiceAccountKey.name,
  );
  await deleteServiceAccountKeys(iam, oldServiceAccountKeys);
  console.info("Completed rotating service account keys.");
  return serviceAccountKeyBase64Encoded;
}
