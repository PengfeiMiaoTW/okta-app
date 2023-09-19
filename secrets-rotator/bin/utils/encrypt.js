"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.decrypt = exports.encrypt = void 0;
const crypto_1 = __importDefault(require("crypto"));
const buffer_1 = require("buffer");
const cast_to_1 = require("./cast-to");
const algorithm = "aes-256-ctr";
let key = process.env.HASH_KEY;
key = crypto_1.default.createHash("sha256").update(String(key)).digest("base64").slice(0, 32);
const encrypt = (value) => {
    const initializationVector = crypto_1.default.randomBytes(16);
    const cipher = crypto_1.default.createCipheriv(algorithm, key, initializationVector);
    const encryptedValue = buffer_1.Buffer.concat([initializationVector, cipher.update(value), cipher.final()]);
    return (0, cast_to_1.identity)(encryptedValue);
};
exports.encrypt = encrypt;
const decrypt = (encryptedValueWithoutInitializationVector) => {
    const initializationVector = encryptedValueWithoutInitializationVector.slice(0, 16);
    encryptedValueWithoutInitializationVector = encryptedValueWithoutInitializationVector.slice(16);
    const decipher = crypto_1.default.createDecipheriv(algorithm, key, initializationVector);
    const decryptedValue = buffer_1.Buffer.concat([decipher.update(encryptedValueWithoutInitializationVector), decipher.final()]);
    return (0, cast_to_1.identity)(decryptedValue);
};
exports.decrypt = decrypt;
//# sourceMappingURL=encrypt.js.map