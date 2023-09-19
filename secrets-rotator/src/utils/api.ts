import { BasicAuthentication } from "../types";
import { Buffer } from "buffer";

export function getCredentialsForBasicAuth(config: Pick<BasicAuthentication, "userName" | "password">) {
  return Buffer.from(`${config.userName}:${config.password}`, "utf8").toString("base64");
}
