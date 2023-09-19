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
exports.rotateSendGridApiKey = void 0;
const client_1 = __importDefault(require("@sendgrid/client"));
const cast_to_1 = __importDefault(require("../utils/cast-to"));
function getApiKeyInfo(apiKeyName) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.info(`Getting sendgrid api-key info by name ${apiKeyName}.`);
            const [response] = yield client_1.default.request({
                method: "GET",
                url: "/v3/api_keys",
            });
            const apiKeys = (0, cast_to_1.default)(response.body).result;
            const apiKey = apiKeys.find((key) => key.name === apiKeyName);
            if (!apiKey) {
                const errorMessage = `sendgrid api-key with name ${apiKeyName} does not exists.`;
                console.info(errorMessage);
                // noinspection ExceptionCaughtLocallyJS
                throw new Error(errorMessage);
            }
            console.info("Successfully fetched sendgrid api-key info.");
            return apiKey;
        }
        catch (error) {
            console.info("Failed to fetch sendgrid api-key info.");
            throw error;
        }
    });
}
function createApiKey(apiKeyName) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.info(`Creating sendgrid api-key with name ${apiKeyName}.`);
            const [response] = yield client_1.default.request({
                body: {
                    name: apiKeyName,
                },
                method: "POST",
                url: "/v3/api_keys",
            });
            console.info("Successfully created sendgrid api-key.");
            return (0, cast_to_1.default)(response.body);
        }
        catch (error) {
            console.info("Failed to create sendgrid api-key.");
            throw error;
        }
    });
}
function deleteApiKey(apiKeyId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.info(`Deleted sendgrid api-key with id ${apiKeyId}.`);
            yield client_1.default.request({
                method: "DELETE",
                url: `/v3/api_keys/${apiKeyId}`,
            });
            console.info("Successfully deleted sendgrid api-key.");
        }
        catch (error) {
            console.info("Failed to delete sendgrid api-key.");
            throw error;
        }
    });
}
const rotateSendGridApiKey = (config) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.info("Started rotating sendgrid api-key.");
        client_1.default.setApiKey(config.authentication.apiKey);
        const { api_key_id: apiKeyId } = yield getApiKeyInfo(config.apiKeyName);
        const newSendGridApiKey = (yield createApiKey(config.apiKeyName)).api_key;
        yield deleteApiKey(apiKeyId);
        console.info("Completed rotating sendgrid api-key.");
        return newSendGridApiKey;
    }
    catch (error) {
        console.info("Failed to rotate sendgrid api-key.");
        throw error;
    }
});
exports.rotateSendGridApiKey = rotateSendGridApiKey;
//# sourceMappingURL=sendgrid-key.js.map