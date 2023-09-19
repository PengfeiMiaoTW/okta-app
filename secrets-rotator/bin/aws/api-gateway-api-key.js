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
exports.rotateAWSGatewayApiKey = void 0;
const client_api_gateway_1 = require("@aws-sdk/client-api-gateway");
const moment_1 = __importDefault(require("moment"));
const functions_1 = require("../utils/functions");
function rotateAWSGatewayApiKey(config, password) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        try {
            let createApiKeyResponse;
            console.info("Initializing the api gateway client");
            const apiGatewayClient = new client_api_gateway_1.APIGatewayClient({
                region: config.region,
                credentials: (_a = config.authentication) === null || _a === void 0 ? void 0 : _a.credentials,
            });
            console.info("Successfully initialized the api gateway client");
            yield getUsagePlanApiKeysAndDeleteTheOldestIfRequired(apiGatewayClient, config);
            yield (0, functions_1.iif)(function createNewApiKeyAndAddToUsagePlan() {
                return __awaiter(this, void 0, void 0, function* () {
                    createApiKeyResponse = yield createApiKey(apiGatewayClient, password);
                    console.info("Successfully created a new api key");
                    console.info("Started adding newly created api key to the usage plan");
                    yield apiGatewayClient.send(new client_api_gateway_1.CreateUsagePlanKeyCommand({
                        usagePlanId: config.usagePlanId,
                        keyId: createApiKeyResponse.id,
                        keyType: "API_KEY",
                    }));
                    console.info("Successfully added the newly created api key to the usage plan");
                });
            });
            return createApiKeyResponse.value;
        }
        catch (error) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            console.info(`Error while rotating the api key in api gateway. Error Message:${error.message}`);
            throw error;
        }
    });
}
exports.rotateAWSGatewayApiKey = rotateAWSGatewayApiKey;
function getUsagePlanApiKeysAndDeleteTheOldestIfRequired(apiGatewayClient, config) {
    return __awaiter(this, void 0, void 0, function* () {
        let usagePlanKeys;
        try {
            console.info("Fetching the existing api keys in usage plan");
            usagePlanKeys = yield apiGatewayClient.send(new client_api_gateway_1.GetUsagePlanKeysCommand({
                usagePlanId: config.usagePlanId,
            }));
            console.info("Successfully fetched the existing usage plan api keys");
        }
        catch (error) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            console.info(`Error while fetching the existing api keys in usage plan. Error Message:${error.message}`);
            throw error;
        }
        if (usagePlanKeys.items.length > 1) {
            console.info("Fetching oldest api key in usage plan");
            const oldestAPIKeyId = yield getOldestUsagePlanAPIKeyId(apiGatewayClient, usagePlanKeys.items);
            console.info("Successfully fetched the oldest api key in usage plan");
            console.info("Started deleting the oldest api key");
            yield deleteAWSGatewayAPIKey(apiGatewayClient, oldestAPIKeyId);
            console.info("Successfully deleted the oldest api key");
        }
    });
}
function createApiKey(apiGatewayClient, password) {
    return __awaiter(this, void 0, void 0, function* () {
        console.info("Started creating a new api key in enabled state");
        return apiGatewayClient.send(new client_api_gateway_1.CreateApiKeyCommand({
            name: `aws_gateway_api_key_${(0, moment_1.default)().format("YYYY-MM-DD HH:mm:ss")}`,
            value: password,
            enabled: true,
        }));
    });
}
function getOldestUsagePlanAPIKeyId(apiGatewayClient, usagePlanKeys) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.info("Fetching the api keys");
            const apiKeys = yield apiGatewayClient.send(new client_api_gateway_1.GetApiKeysCommand({
                includeValues: false,
            }));
            console.info("Successfully fetched the api keys");
            const usagePlanKeysWithCreatedDate = apiKeys.items.filter((apiKey) => usagePlanKeys.some((usagePlanKey) => usagePlanKey.id === apiKey.id));
            return usagePlanKeysWithCreatedDate.reduce((result, apiKey) => (result === null || result === void 0 ? void 0 : result.createdDate) < apiKey.createdDate ? result : apiKey, null).id;
        }
        catch (error) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            console.info(`Error while fetching the api keys. Error Message:${error.message}`);
            throw error;
        }
    });
}
function deleteAWSGatewayAPIKey(apiGatewayClient, oldestAPIKeyId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield apiGatewayClient.send(new client_api_gateway_1.DeleteApiKeyCommand({
                apiKey: oldestAPIKeyId,
            }));
        }
        catch (error) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            console.info(`Error while deleting oldest api key. Error Message:${error.message}`);
            throw error;
        }
    });
}
//# sourceMappingURL=api-gateway-api-key.js.map