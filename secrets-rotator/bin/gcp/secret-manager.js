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
exports.rotateSecretsInSecretManager = void 0;
const lodash_1 = __importDefault(require("lodash"));
const secret_manager_1 = require("@google-cloud/secret-manager");
const secret_manager_2 = require("../utils/secret-manager");
const authorization_1 = require("./authorization");
function accessLatestSecretVersion(client, secretName) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.info(`Fetching latest version of ${secretName}.`);
            const [version] = yield client.accessSecretVersion({
                name: `${secretName}/versions/latest`,
            });
            console.info("Successfully fetched secrets.");
            return ({
                name: version.name,
                payload: version.payload.data.toString(),
            });
        }
        catch (error) {
            console.info("Failed to fetch secrets.");
            throw error;
        }
    });
}
function disableSecretVersion(client, secretNameWithVersion) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.info(`Disabling ${secretNameWithVersion} secret version.`);
            yield client.disableSecretVersion({
                name: secretNameWithVersion,
            });
            console.info("Successfully disabled secret version.");
        }
        catch (error) {
            console.info("Failed to disabled secret version.");
            throw error;
        }
    });
}
function getLatestFieldValueBasedOnFieldType(options) {
    const { existingSecret, password, isValueArray, keyFieldName } = options;
    if (isValueArray) {
        const existingValue = keyFieldName
            ? lodash_1.default.get(JSON.parse(existingSecret), keyFieldName)
            : JSON.parse(existingSecret);
        if (!Array.isArray(existingValue)) {
            throw Error("Existing secret is not an array");
        }
        existingValue.shift();
        existingValue.push(password);
        return existingValue;
    }
    return password;
}
function rotateSecretsInSecretManager(config, password) {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const client = new secret_manager_1.SecretManagerServiceClient({
                projectId: config.projectId,
                credentials: ((_a = config.authentication) === null || _a === void 0 ? void 0 : _a.credentials) && (0, authorization_1.getGoogleAuthCredentials)((_b = config.authentication) === null || _b === void 0 ? void 0 : _b.credentials),
            });
            const secretName = `projects/${config.projectId}/secrets/${config.secretName}`;
            let newSecret;
            let { name: existingSecretNameWithVersion, payload: existingSecret, } = yield accessLatestSecretVersion(client, secretName);
            if (config.keyFieldNames) {
                config.keyFieldNames.map((secretDetails) => {
                    console.info(`Started updating secret of "${secretDetails.keyFieldName}" field in secret manager`);
                    const newKeyFieldValue = getLatestFieldValueBasedOnFieldType({
                        existingSecret,
                        password,
                        isValueArray: secretDetails.isValueArray,
                        keyFieldName: secretDetails.keyFieldName,
                    });
                    existingSecret = JSON.stringify(lodash_1.default.update(JSON.parse(existingSecret), secretDetails.keyFieldName, () => newKeyFieldValue));
                });
                newSecret = existingSecret;
            }
            else {
                const newKeyFieldValue = yield getLatestFieldValueBasedOnFieldType({
                    existingSecret,
                    password,
                    isValueArray: config.isValueArray,
                    keyFieldName: config.keyFieldName,
                });
                if (config.keyFieldName) {
                    console.info(`Started updating secret of "${config.keyFieldName}" field in secret manager`);
                    newSecret = lodash_1.default.update(JSON.parse(existingSecret), config.keyFieldName, () => newKeyFieldValue);
                }
                else {
                    newSecret = newKeyFieldValue;
                }
            }
            yield client.addSecretVersion({
                parent: secretName,
                payload: {
                    data: (0, secret_manager_2.createBufferForSecretManager)(newSecret),
                },
            });
            yield disableSecretVersion(client, existingSecretNameWithVersion);
            console.info("Secrets updated successfully in secret manager");
        }
        catch (error) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            console.info(`Error while updating the secret of the field ${config.keyFieldName} in secret manager. Error Message:${error.message}`);
            throw error;
        }
    });
}
exports.rotateSecretsInSecretManager = rotateSecretsInSecretManager;
//# sourceMappingURL=secret-manager.js.map