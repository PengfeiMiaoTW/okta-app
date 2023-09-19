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
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGoogleAuthCredentials = exports.initializeGoogleApis = void 0;
const googleapis_1 = require("googleapis");
const cast_to_1 = require("../utils/cast-to");
function initializeGoogleApis(authenticationParams) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.info("Initializing Google APIs.");
            const auth = new googleapis_1.google.auth.GoogleAuth({
                // Scopes can be specified either as an array or as a single, space-delimited string.
                scopes: authenticationParams === null || authenticationParams === void 0 ? void 0 : authenticationParams.scopes,
                credentials: (authenticationParams === null || authenticationParams === void 0 ? void 0 : authenticationParams.credentials) && getGoogleAuthCredentials(authenticationParams === null || authenticationParams === void 0 ? void 0 : authenticationParams.credentials),
            });
            const authClient = yield auth.getClient();
            googleapis_1.google.options({ auth: authClient });
            console.info("Successfully initialized Google APIs.");
            return googleapis_1.google;
        }
        catch (error) {
            console.info("Failed to initialize Google APIs.");
            throw error;
        }
    });
}
exports.initializeGoogleApis = initializeGoogleApis;
function getGoogleAuthCredentials(credentials) {
    const decodedCredential = JSON.parse(Buffer.from(credentials, "base64").toString());
    return (0, cast_to_1.identity)({
        client_email: decodedCredential.client_email,
        private_key: decodedCredential.private_key,
    });
}
exports.getGoogleAuthCredentials = getGoogleAuthCredentials;
//# sourceMappingURL=authorization.js.map