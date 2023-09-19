"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.rotateSecretsInAWSSecretManager = void 0;
const client_secrets_manager_1 = require("@aws-sdk/client-secrets-manager");
const lodash_1 = __importDefault(require("lodash"));
function getLatestFieldValueBasedOnFieldType(options) {
    const { existingSecret, password, isValueArray, keyFieldName } = options;
    if (isValueArray) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const existingValue = keyFieldName
            ? lodash_1.default.get(JSON.parse(existingSecret), keyFieldName)
            : JSON.parse(existingSecret);
        if (!Array.isArray(existingValue)) {
            throw new TypeError("Existing secret is not an array");
        }
        existingValue.shift();
        existingValue.push(password);
        return existingValue;
    }
    return password;
}
function rotateSecretsInAWSSecretManager(config, password) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let newSecret;
            console.info("Initializing the secret manager client");
            const secretManagerClient = new client_secrets_manager_1.SecretsManagerClient({
                region: config.region,
                credentials: (_a = config.authentication) === null || _a === void 0 ? void 0 : _a.credentials,
            });
            console.info("Fetching the existing secret from secret manager");
            let existingSecret = (yield secretManagerClient.send(new client_secrets_manager_1.GetSecretValueCommand({
                SecretId: config.secretId,
            }))).SecretString;
            console.info("Successfully fetched the existing secret from secret manager");
            if (config.keyFieldNames) {
                config.keyFieldNames.map((secretDetail) => {
                    console.info(`Started updating secret of "${secretDetail.keyFieldName}" field in secret manager`);
                    const newKeyFieldValue = getLatestFieldValueBasedOnFieldType({
                        existingSecret,
                        password,
                        isValueArray: secretDetail.isValueArray,
                        keyFieldName: secretDetail.keyFieldName,
                    });
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    existingSecret = JSON.stringify(lodash_1.default.update(JSON.parse(existingSecret), secretDetail.keyFieldName, () => newKeyFieldValue));
                });
                newSecret = existingSecret;
            }
            else {
                const newKeyFieldValue = getLatestFieldValueBasedOnFieldType({
                    existingSecret,
                    password,
                    isValueArray: config.isValueArray,
                    keyFieldName: config.keyFieldName,
                });
                if (config.keyFieldName) {
                    console.info(`Started updating secret of "${config.keyFieldName}" field in secret manager`);
                    newSecret = JSON.stringify(lodash_1.default.update(JSON.parse(existingSecret), config.keyFieldName, () => newKeyFieldValue));
                }
                else {
                    newSecret = newKeyFieldValue;
                }
            }
            yield secretManagerClient.send(new client_secrets_manager_1.UpdateSecretCommand({
                SecretId: config.secretId,
                SecretString: typeof newSecret === "string" ? newSecret : JSON.stringify(newSecret),
            }));
            console.info("Secrets updated successfully in secret manager");
        }
        catch (error) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            console.info(`Error while updating the secret of the field ${config.keyFieldName} in secret manager. Error Message:${error.message}`);
            throw error;
        }
    });
}
exports.rotateSecretsInAWSSecretManager = rotateSecretsInAWSSecretManager;
//# sourceMappingURL=secret-manager.js.map