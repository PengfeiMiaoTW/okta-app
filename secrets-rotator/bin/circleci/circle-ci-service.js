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
exports.callCircleCiApi = void 0;
const axios_1 = __importDefault(require("axios"));
const callCircleCiApi = (url, method = "get", accessToken, data, params) => __awaiter(void 0, void 0, void 0, function* () {
    const completeUrl = `https://circleci.com/api/v2${url}`;
    try {
        console.info(`Calling ${completeUrl}.`);
        const response = yield (0, axios_1.default)({
            url: completeUrl,
            method,
            headers: {
                "Circle-Token": accessToken,
                "Content-Type": "application/json",
            },
            data,
            params,
        });
        console.info(`Got ${response.status} from ${completeUrl}.`);
        return response.data;
    }
    catch (error) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        console.info(`Got ${error.response.status} error from ${completeUrl}.\nFailed with error ${error.response.data.message}`);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        throw new Error(error.response.data.message);
    }
});
exports.callCircleCiApi = callCircleCiApi;
//# sourceMappingURL=circle-ci-service.js.map