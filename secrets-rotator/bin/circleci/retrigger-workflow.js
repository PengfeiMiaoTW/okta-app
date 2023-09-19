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
exports.reTriggerWorkflow = void 0;
const axios_1 = __importDefault(require("axios"));
const reTriggerWorkflow = (redeployConfig) => __awaiter(void 0, void 0, void 0, function* () {
    const { jobId, workflowId, accessToken } = redeployConfig;
    try {
        console.info(`Starting to trigger the redeployment for the job ${jobId} in the workflow ${workflowId}`);
        yield (0, axios_1.default)({
            url: `https://circleci.com/api/v2/workflow/${workflowId}/rerun`,
            method: "post",
            headers: {
                "Circle-Token": accessToken,
                "Content-Type": "application/json",
            },
            data: {
                jobs: [jobId],
            },
        });
        console.info(`Successfully triggered redeployment for the job ${jobId} in the workflow ${workflowId}`);
    }
    catch (error) {
        console.info(`Failed to trigger redeployment for the job ${jobId} in the workflow ${workflowId}`);
        console.error(error);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        throw new Error(error.response.data.message);
    }
});
exports.reTriggerWorkflow = reTriggerWorkflow;
//# sourceMappingURL=retrigger-workflow.js.map