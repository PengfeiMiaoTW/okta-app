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
exports.rotateApiPlatformApiServiceToken = void 0;
const api_action_1 = require("../api/api-action");
function rotateApiPlatformApiServiceToken(config, password) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            console.info("Started rotating api platform api service token.");
            const { result } = yield (0, api_action_1.callApi)({
                url: `${config.apiPlatformUrl}/publisher/apis/`,
                method: "GET",
                authentication: config.authentication,
            });
            const app = result.find((api) => api.name === config.apiName);
            if (!app) {
                const errorMessage = `API with name "${config.apiName}" not exist.`;
                console.info(errorMessage);
                // noinspection ExceptionCaughtLocallyJS
                throw new Error(errorMessage);
            }
            const apiId = app.id;
            yield (0, api_action_1.callApi)({
                url: `${config.apiPlatformUrl}/publisher/apis/${apiId}/plugins/request-transformer`,
                method: "PUT",
                authentication: config.authentication,
                payload: {
                    config: {
                        append: {
                            headers: [`${config.apiKeyHeaderName}:${password}`],
                        },
                    },
                    type: "request-transformer",
                },
            });
            console.info("Completed rotating api platform api service token.");
        }
        catch (error) {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
            console.info(`Error while rotating api platform api service token. Error Message:${error.message}`);
            throw error;
        }
    });
}
exports.rotateApiPlatformApiServiceToken = rotateApiPlatformApiServiceToken;
//# sourceMappingURL=api-service-token.js.map