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
exports.rotateConsumerSecretByApiCall = exports.rotateClientSecretByApiCall = exports.rotateSourceSecretByApiCall = exports.callApi = void 0;
const types_1 = require("../types");
const axios_1 = __importDefault(require("axios"));
const lodash_1 = __importDefault(require("lodash"));
const querystring_1 = __importDefault(require("querystring"));
const api_1 = require("../utils/api");
const cast_to_1 = require("../utils/cast-to");
const getAuthorizationHeader = (auth) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.info("Starting to get authorization header.");
        if (auth.type === "BASIC") {
            return `Basic ${(0, api_1.getCredentialsForBasicAuth)(auth)}`;
        }
        else if (auth.type === "BEARER") {
            return `Bearer ${auth.apiKey}`;
        }
        else if (auth.type === "OAUTH_2") {
            // eslint-disable-next-line camelcase
            const response = yield (0, axios_1.default)({
                url: auth.tokenUrl,
                method: "post",
                headers: {
                    Authorization: `Basic ${(0, api_1.getCredentialsForBasicAuth)({
                        userName: auth.clientId,
                        password: auth.clientSecret,
                    })}`,
                    "Content-Type": "application/x-www-form-urlencoded",
                },
                data: querystring_1.default.stringify({
                    // eslint-disable-next-line camelcase
                    grant_type: auth.grantType,
                    scope: auth.scope,
                }),
            });
            console.info("Got authorization header.");
            return `Bearer ${response.data.access_token}`;
        }
    }
    catch (error) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        console.info(`Error while getting authorization header\nFailed with error ${JSON.stringify(error.response.data)}`);
        throw error;
    }
});
function callApi(config) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.info(`Calling ${config.method} ${config.url}.`);
            const response = yield (0, axios_1.default)(config.url, {
                method: config.method,
                headers: {
                    Authorization: yield getAuthorizationHeader(config.authentication),
                },
                data: (_a = config === null || config === void 0 ? void 0 : config.payload) !== null && _a !== void 0 ? _a : undefined,
            });
            console.info(`Got ${response.status} response from ${config.url}.`);
            return response.data;
        }
        catch (error) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            console.info(`Got ${error.response.status} error from ${config.url}.\nFailed with error ${JSON.stringify(error.response.data)}`);
            throw error;
        }
    });
}
exports.callApi = callApi;
function replacePlaceHolderInPayload(payload, secretValue, placeHolderName = "${{SECRET_VALUE}}") {
    // todo future scope. this might fail if the payload is x-www-form-urlencoded string or any other non json format.
    const payloadAsString = JSON.stringify(payload);
    const replacedPayload = payloadAsString.replace(placeHolderName, secretValue);
    return JSON.parse(replacedPayload);
}
function rotateSourceSecretByApiCall(action) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.info("Started rotating source secret by an api call.");
            const response = yield callApi({
                url: action.url,
                method: action.method,
                payload: action.body,
                authentication: action.authentication,
            });
            console.info("Completed rotating source secret by an api call.");
            if (action.responseKeyField) {
                return lodash_1.default.get(response, action.responseKeyField);
            }
            return response;
        }
        catch (error) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            console.info(`Error while calling the api to rotate secrets. Error Message:${error.message}`);
            throw error;
        }
    });
}
exports.rotateSourceSecretByApiCall = rotateSourceSecretByApiCall;
function rotateClientSecretByApiCall(apiClientSecretAction) {
    return __awaiter(this, void 0, void 0, function* () {
        return rotateSourceSecretByApiCall((0, cast_to_1.identity)({
            type: types_1.SourceActionType.API,
            url: `${apiClientSecretAction.apiPlatformUrl}/clients/${apiClientSecretAction.authentication.clientId}/secrets/regenerate-oldest`,
            method: "POST",
            params: null,
            authentication: apiClientSecretAction.authentication,
            body: {},
            responseKeyField: "newSecret.secret",
        }));
    });
}
exports.rotateClientSecretByApiCall = rotateClientSecretByApiCall;
function rotateConsumerSecretByApiCall(action, password) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.info("Started rotating consumer secret by api call.");
            const response = yield callApi({
                url: action.url,
                method: action.method,
                payload: replacePlaceHolderInPayload(action.body, password),
                authentication: action.authentication,
            });
            console.info("Completed rotating consumer secret by api call.");
            return response;
        }
        catch (error) {
            console.info("Failed to rotate consumer secret by api call.");
            throw error;
        }
    });
}
exports.rotateConsumerSecretByApiCall = rotateConsumerSecretByApiCall;
//# sourceMappingURL=api-action.js.map