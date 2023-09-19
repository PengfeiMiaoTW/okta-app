import { GcpPostgresDataBaseSourceAction, Password } from "../types";
import { initializeGoogleApis } from "./authorization";

export async function rotatePostgresDbPassword(config: GcpPostgresDataBaseSourceAction, password: Password) {
  try {
    console.info("Started rotating cloud sql password");
    const google = await initializeGoogleApis(config.authentication);
    const sql = google.sqladmin("v1beta4");
    await sql.users.update({
      name: config.userName,
      instance: config.instanceName,
      project: config.projectId,
      requestBody: {
        password,
      },
    });
    console.info("Successfully rotated cloud sql password");
  } catch (error) {
    console.info("Failed to rotate cloud sql password");
    throw error;
  }
}
