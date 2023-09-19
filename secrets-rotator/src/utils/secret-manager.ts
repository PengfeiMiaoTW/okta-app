import { Buffer } from "buffer";

export function createBufferForSecretManager(secret: object | string) {
  const secretAsString = typeof secret === "string" ? secret : JSON.stringify(secret);
  return Buffer.from(secretAsString, "utf8");
}
