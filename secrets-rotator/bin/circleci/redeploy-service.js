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
exports.reTriggerWorkflow = exports.redeployService = void 0;
const circle_ci_service_1 = require("./circle-ci-service");
const timer = (ms) => new Promise((res) => setTimeout(res, ms));
const poll = (jobNumber, projectSlug, accessToken) => __awaiter(void 0, void 0, void 0, function* () {
    let ok = false;
    let response;
    while (!ok) {
        yield timer(3000);
        try {
            response = yield (0, circle_ci_service_1.callCircleCiApi)(`/project/${projectSlug}/job/${jobNumber}`, "post", accessToken);
            if (response.status === "success") {
                ok = true;
            }
        }
        catch ( /* keep looping */_a) { /* keep looping */
        }
    }
    return response;
});
const getJobDetails = (workflowId, accessToken) => __awaiter(void 0, void 0, void 0, function* () {
    const { items } = yield (0, circle_ci_service_1.callCircleCiApi)(`/workflow/${workflowId}/job`, "get", accessToken);
    let jobNumber;
    let projectSlug;
    for (const job of items) {
        if (job.status === "running") {
            jobNumber = job.job_number;
            projectSlug = job.project_slug;
            break;
        }
    }
    yield poll(jobNumber, projectSlug, accessToken)
        .then((res) => res.text())
        .then(console.log);
});
const redeployService = (redeployConfig) => __awaiter(void 0, void 0, void 0, function* () {
    const { workflow_id } = yield (0, exports.reTriggerWorkflow)(redeployConfig);
    const job_id = getJobDetails(workflow_id, redeployConfig.accessToken);
});
exports.redeployService = redeployService;
const reTriggerWorkflow = (redeployConfig) => __awaiter(void 0, void 0, void 0, function* () {
    const { jobId, workflowId, accessToken } = redeployConfig;
    try {
        console.info(`Starting to trigger the redeployment for the job ${jobId} in the workflow ${workflowId}`);
        // eslint-disable-next-line camelcase
        const { workflow_id } = yield (0, circle_ci_service_1.callCircleCiApi)(`/workflow/${workflowId}/rerun`, "post", accessToken, {
            jobs: [jobId],
        });
        console.info(`Successfully triggered redeployment for the job ${jobId} in the workflow ${workflowId}`);
        // eslint-disable-next-line camelcase
        return workflow_id;
    }
    catch (error) {
        console.info(`Failed to trigger redeployment for the job ${jobId} in the workflow ${workflowId}`);
        console.error(error);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        throw new Error(error.response.data.message);
    }
});
exports.reTriggerWorkflow = reTriggerWorkflow;
//# sourceMappingURL=redeploy-service.js.map