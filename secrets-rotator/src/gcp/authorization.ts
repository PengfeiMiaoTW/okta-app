import { GcpServiceAccountAuthentication } from "../types";
import { google } from "googleapis";
import { identity } from "../utils/cast-to";
import { CredentialBody } from "google-auth-library/build/src/auth/credentials";

export async function initializeGoogleApis(authenticationParams: GcpServiceAccountAuthentication) {
  try {
    console.info("Initializing Google APIs.");
    const auth = new google.auth.GoogleAuth({
      // Scopes can be specified either as an array or as a single, space-delimited string.
      scopes: authenticationParams?.scopes,
      credentials: authenticationParams?.credentials && getGoogleAuthCredentials(authenticationParams?.credentials),
    });
    const authClient = await auth.getClient();
    google.options({ auth: authClient });
    console.info("Successfully initialized Google APIs.");
    return google;
  } catch (error) {
    console.info("Failed to initialize Google APIs.");
    throw error;
  }
}

export function getGoogleAuthCredentials(credentials: GcpServiceAccountAuthentication["credentials"]) {
  const decodedCredential = JSON.parse(Buffer.from(credentials, "base64").toString());
  return identity<CredentialBody>({
    client_email: decodedCredential.client_email,
    private_key: decodedCredential.private_key,
  });
}
