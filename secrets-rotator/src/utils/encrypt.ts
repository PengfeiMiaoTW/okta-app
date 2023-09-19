import crypto from "crypto";
import { Buffer } from "buffer";
import { identity } from "./cast-to";

const algorithm = "aes-256-ctr";
let key = process.env.HASH_KEY;
key = crypto.createHash("sha256").update(String(key)).digest("base64").slice(0, 32);

export const encrypt = (value: Buffer) => {
  const initializationVector = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, initializationVector);
  const encryptedValue = Buffer.concat([initializationVector, cipher.update(value), cipher.final()]);
  return identity<Buffer>(encryptedValue);
};

export const decrypt = (encryptedValueWithoutInitializationVector: Buffer) => {
  const initializationVector = encryptedValueWithoutInitializationVector.slice(0, 16);
  encryptedValueWithoutInitializationVector = encryptedValueWithoutInitializationVector.slice(16);
  const decipher = crypto.createDecipheriv(algorithm, key, initializationVector);
  const decryptedValue = Buffer.concat([decipher.update(encryptedValueWithoutInitializationVector), decipher.final()]);
  return identity<Buffer>(decryptedValue);
};
