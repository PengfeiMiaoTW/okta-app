"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthenticationType = exports.ConsumerActionType = exports.SourceActionType = void 0;
var SourceActionType;
(function (SourceActionType) {
    SourceActionType["GCP_SERVICE_ACCOUNT_KEY"] = "GCP_SERVICE_ACCOUNT_KEY_SOURCE";
    SourceActionType["GCP_POSTGRES_DATABASE"] = "GCP_POSTGRES_DATABASE_SOURCE";
    SourceActionType["API"] = "API_SOURCE";
    SourceActionType["API_PLATFORM_CLIENT_SECRET"] = "API_PLATFORM_CLIENT_SECRET";
    SourceActionType["GCP_SECRET_MANAGER"] = "GCP_SECRET_MANAGER_SOURCE";
    SourceActionType["AWS_SECRET_MANAGER"] = "AWS_SECRET_MANAGER_SOURCE";
    SourceActionType["SENDGRID"] = "SENDGRID_SOURCE";
    SourceActionType["API_PLATFORM_API_SERVICE_TOKEN"] = "API_PLATFORM_API_SERVICE_TOKEN_SOURCE";
    SourceActionType["GENERATE_PASSWORD"] = "GENERATE_PASSWORD";
    SourceActionType["AWS_GATEWAY_API_KEY"] = "AWS_GATEWAY_API_KEY_SOURCE";
})(SourceActionType = exports.SourceActionType || (exports.SourceActionType = {}));
var ConsumerActionType;
(function (ConsumerActionType) {
    ConsumerActionType["GCP_SECRET_MANAGER"] = "GCP_SECRET_MANAGER_CONSUMER";
    ConsumerActionType["API"] = "API_CONSUMER";
    ConsumerActionType["API_PLATFORM_API_SERVICE_TOKEN"] = "API_PLATFORM_API_SERVICE_TOKEN_CONSUMER";
    ConsumerActionType["EVENT_SUBSCRIPTION_TOKEN"] = "EVENT_SUBSCRIPTION_TOKEN";
    ConsumerActionType["AWS_SECRET_MANAGER"] = "AWS_SECRET_MANAGER_CONSUMER";
    ConsumerActionType["AWS_GATEWAY_API_KEY"] = "AWS_GATEWAY_API_KEY_CONSUMER";
})(ConsumerActionType = exports.ConsumerActionType || (exports.ConsumerActionType = {}));
var AuthenticationType;
(function (AuthenticationType) {
    AuthenticationType["GCP_SERVICE_ACCOUNT"] = "GCP_SERVICE_ACCOUNT";
    AuthenticationType["SENDGRID"] = "SENDGRID";
    AuthenticationType["BASIC"] = "BASIC";
    AuthenticationType["OAUTH_2"] = "OAUTH_2";
    AuthenticationType["BEARER"] = "BEARER";
    AuthenticationType["AWS_ACCOUNT"] = "AWS_ACCOUNT";
})(AuthenticationType = exports.AuthenticationType || (exports.AuthenticationType = {}));
//# sourceMappingURL=types.js.map