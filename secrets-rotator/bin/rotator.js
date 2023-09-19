"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.decryptEncryptedReportFile = exports.runSecretRotation = exports.getConfigData = exports.validateIfHashKeyEnvironmentVariableIsPresent = exports.substituteEnvironmentVariables = exports.rotateSecrets = void 0;
const types_1 = require("./types");
const db_password_rotator_1 = require("./gcp/db-password-rotator");
const generate_password_1 = require("generate-password");
const secret_manager_1 = require("./gcp/secret-manager");
const api_action_1 = require("./api/api-action");
const sendgrid_key_1 = require("./sendgrid/sendgrid-key");
const service_account_1 = require("./gcp/service-account");
const logger_1 = require("./logger");
const cast_to_1 = __importStar(require("./utils/cast-to"));
const fs_1 = require("fs");
const data_1 = require("./data");
const functions_1 = require("./utils/functions");
const encrypt_1 = require("./utils/encrypt");
const api_service_token_1 = require("./api-platform/api-service-token");
const redeploy_1 = require("./circleci/redeploy");
const event_subscription_token_1 = require("./event-platform/event-subscription-token");
const validate_schema_1 = require("./utils/validate-schema");
const secret_manager_2 = require("./aws/secret-manager");
const api_gateway_api_key_1 = require("./aws/api-gateway-api-key");
function generatePasswordAndPerformSecretRotation(source, handlerFunction) {
    return __awaiter(this, void 0, void 0, function* () {
        const password = yield generatePassword(source.passwordConfig);
        console.info("Password generated successfully");
        yield handlerFunction(source.action, password);
        return password;
    });
}
function generatePassword(passwordConfig) {
    return __awaiter(this, void 0, void 0, function* () {
        return (0, generate_password_1.generate)(passwordConfig);
    });
}
function performSourceAction(source) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.info(`Rotation of source secret for "${source.name}" started`);
            const sourceActionHandlerMap = {
                [types_1.SourceActionType.GCP_POSTGRES_DATABASE]: () => generatePasswordAndPerformSecretRotation(source, db_password_rotator_1.rotatePostgresDbPassword),
                [types_1.SourceActionType.API]: () => (0, api_action_1.rotateSourceSecretByApiCall)((0, cast_to_1.default)(source.action)),
                [types_1.SourceActionType.API_PLATFORM_CLIENT_SECRET]: () => (0, api_action_1.rotateClientSecretByApiCall)((0, cast_to_1.default)(source.action)),
                [types_1.SourceActionType.API_PLATFORM_API_SERVICE_TOKEN]: () => generatePasswordAndPerformSecretRotation(source, api_service_token_1.rotateApiPlatformApiServiceToken),
                [types_1.SourceActionType.SENDGRID]: () => (0, sendgrid_key_1.rotateSendGridApiKey)((0, cast_to_1.default)(source.action)),
                [types_1.SourceActionType.GCP_SERVICE_ACCOUNT_KEY]: () => (0, service_account_1.rotateServiceAccount)((0, cast_to_1.default)(source.action)),
                [types_1.SourceActionType.GCP_SECRET_MANAGER]: () => generatePasswordAndPerformSecretRotation(source, secret_manager_1.rotateSecretsInSecretManager),
                [types_1.SourceActionType.AWS_SECRET_MANAGER]: () => generatePasswordAndPerformSecretRotation(source, secret_manager_2.rotateSecretsInAWSSecretManager),
                [types_1.SourceActionType.AWS_GATEWAY_API_KEY]: () => (0, api_gateway_api_key_1.rotateAWSGatewayApiKey)((0, cast_to_1.default)(source.action)),
                [types_1.SourceActionType.GENERATE_PASSWORD]: () => generatePassword(source.passwordConfig),
            };
            const password = yield sourceActionHandlerMap[source.action.type]();
            console.info(`Successfully rotated secret in source for "${source.name}"`);
            logger_1.reportFileLogger.appendText(`New secret value for "${source.name}": ${password}`);
            return password;
        }
        catch (error) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            console.info(`Failed to rotate source secret for "${source.name}". Error Message: ${error.message}`);
            throw error;
        }
    });
}
function performConsumerAction(consumer, password) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.info(`Rotation of secret for consumer: "${consumer.name}" started`);
            const consumerActionHandlerMap = {
                [types_1.ConsumerActionType.GCP_SECRET_MANAGER]: () => (0, secret_manager_1.rotateSecretsInSecretManager)((0, cast_to_1.default)(consumer.action), password),
                [types_1.ConsumerActionType.API]: () => (0, api_action_1.rotateConsumerSecretByApiCall)((0, cast_to_1.default)(consumer.action), password),
                [types_1.ConsumerActionType.API_PLATFORM_API_SERVICE_TOKEN]: () => (0, api_service_token_1.rotateApiPlatformApiServiceToken)((0, cast_to_1.default)(consumer.action), password),
                [types_1.ConsumerActionType.EVENT_SUBSCRIPTION_TOKEN]: () => (0, event_subscription_token_1.rotateEventSubscriptionToken)((0, cast_to_1.default)(consumer.action), password), [types_1.ConsumerActionType.AWS_SECRET_MANAGER]: () => (0, secret_manager_2.rotateSecretsInAWSSecretManager)((0, cast_to_1.default)(consumer.action), password), [types_1.ConsumerActionType.AWS_GATEWAY_API_KEY]: () => (0, api_gateway_api_key_1.rotateAWSGatewayApiKey)((0, cast_to_1.default)(consumer.action), password),
            };
            yield consumerActionHandlerMap[consumer.action.type]();
            console.info(`Successfully rotated secret of consumer: "${consumer.name}"`);
        }
        catch (error) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            console.info(`Failed to rotate secret of consumer: "${consumer.name}". Error Message: ${error.message}`);
            throw error;
        }
    });
}
function rotateSecrets(config) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { source, consumers } = config;
            const password = yield performSourceAction(source);
            for (const consumer of consumers) {
                yield performConsumerAction(consumer, password);
                if (consumer.redeploy) {
                    Array.isArray(consumer.redeploy)
                        ? consumer.redeploy.map((redeployConfig) => __awaiter(this, void 0, void 0, function* () {
                            yield (0, redeploy_1.redeploy)(redeployConfig);
                        }))
                        : yield (0, redeploy_1.redeploy)(consumer.redeploy);
                }
            }
        }
        catch (error) {
            console.info("Failed to rotate secret");
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            console.error(error.message);
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            throw new Error(error.message);
        }
    });
}
exports.rotateSecrets = rotateSecrets;
function substituteEnvironmentVariables(json) {
    const ENV_PATTERN = /\${([\w-_]*)}/gm;
    let matchersResult;
    let resultedJson = json;
    while ((matchersResult = ENV_PATTERN.exec(json)) !== null) {
        const [textToReplace, envVariableName] = matchersResult;
        // eslint-disable-next-line security/detect-object-injection
        if (!process.env[envVariableName]) {
            const errorMessage = `Environment variable: ${envVariableName} mentioned in config has no value.`;
            console.info(errorMessage);
            throw new Error(errorMessage);
        }
        // eslint-disable-next-line security/detect-object-injection
        resultedJson = resultedJson.replace(textToReplace, process.env[envVariableName]);
    }
    return resultedJson;
}
exports.substituteEnvironmentVariables = substituteEnvironmentVariables;
function validateIfHashKeyEnvironmentVariableIsPresent() {
    const hashKeyEnvVariableName = "HASH_KEY";
    // eslint-disable-next-line security/detect-object-injection
    if (!process.env[hashKeyEnvVariableName]) {
        const errorMessage = `Environment variable: ${hashKeyEnvVariableName} needed for secret rotation is not present.`;
        console.info(errorMessage);
        throw new Error(errorMessage);
    }
}
exports.validateIfHashKeyEnvironmentVariableIsPresent = validateIfHashKeyEnvironmentVariableIsPresent;
function readJsonFile(filePath) {
    return __awaiter(this, void 0, void 0, function* () {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        return fs_1.promises.readFile(filePath, "utf8");
    });
}
function getConfigData(filePath) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.info("Started to read config file.");
            const jsonDataAsString = yield readJsonFile(filePath);
            const config = (0, cast_to_1.identity)(JSON.parse(substituteEnvironmentVariables(jsonDataAsString)));
            console.info("Successfully read config file.");
            return config;
        }
        catch (error) {
            console.info("Failed to read config json file.");
            throw error;
        }
    });
}
exports.getConfigData = getConfigData;
function runSecretRotation(configFilePath) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.info("Started running secret rotation.");
            validateIfHashKeyEnvironmentVariableIsPresent();
            const config = yield getConfigData(configFilePath);
            yield (0, validate_schema_1.validateConfigFileSchema)(configFilePath);
            yield rotateSecrets(config);
            console.info("Secret rotation completed.");
        }
        catch (error) {
            logger_1.reportFileLogger.appendError("Failed to rotate secrets", error);
            throw error;
        }
        finally {
            console.info("Generating report file.");
            yield (0, functions_1.iif)(function generateEncryptedReportFile() {
                return __awaiter(this, void 0, void 0, function* () {
                    // eslint-disable-next-line security/detect-non-literal-fs-filename
                    const fileInBufferFormat = yield fs_1.promises.readFile(data_1.outputFileName);
                    // eslint-disable-next-line security/detect-non-literal-fs-filename
                    yield fs_1.promises.writeFile(data_1.encryptedReportFileName, (0, encrypt_1.encrypt)(fileInBufferFormat));
                });
            });
            yield (0, functions_1.iif)(function removeTemporaryReportFile() {
                return __awaiter(this, void 0, void 0, function* () {
                    // eslint-disable-next-line security/detect-non-literal-fs-filename
                    yield fs_1.promises.unlink(data_1.outputFileName);
                });
            });
            console.info("Report file generated successfully.");
        }
    });
}
exports.runSecretRotation = runSecretRotation;
function decryptEncryptedReportFile(encryptedReportFilePath) {
    return __awaiter(this, void 0, void 0, function* () {
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        const fileContent = yield fs_1.promises.readFile(encryptedReportFilePath);
        // eslint-disable-next-line security/detect-non-literal-fs-filename
        yield fs_1.promises.writeFile(data_1.decryptedReportFileName, (0, encrypt_1.decrypt)(fileContent).toString());
    });
}
exports.decryptEncryptedReportFile = decryptEncryptedReportFile;
//# sourceMappingURL=rotator.js.map