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
exports.redeploy = exports.reTriggerWorkflow = void 0;
const circle_ci_service_1 = require("./circle-ci-service");
const types_1 = require("./types");
const reTriggerWorkflow = ({ jobId, workflowId, accessToken }) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.info(`Starting to trigger the redeployment for the job ${jobId} in the workflow ${workflowId}.`);
        const response = yield (0, circle_ci_service_1.callCircleCiApi)(`/workflow/${workflowId}/rerun`, "post", accessToken, {
            jobs: [jobId],
        });
        console.info(`Successfully triggered redeployment for the job ${jobId} in the workflow ${workflowId}.`);
        // eslint-disable-next-line camelcase
        return response.workflow_id;
    }
    catch (error) {
        console.info(`Failed to trigger redeployment for the job ${jobId} in the workflow ${workflowId}.`);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        console.error(error.message);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        throw new Error(error.message);
    }
});
exports.reTriggerWorkflow = reTriggerWorkflow;
const redeploy = (redeployConfig) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.info("Starting to redeployment.");
        const { workflowId, jobId, accessToken } = redeployConfig;
        const newWorkflowId = yield (0, exports.reTriggerWorkflow)(redeployConfig);
        const newJobId = yield getTriggeredJobId(newWorkflowId, accessToken, (yield getJobDetailsById(workflowId, jobId, accessToken)).name);
        yield checkAndWaitForJobCompletion(newWorkflowId, newJobId, accessToken);
        console.info("Redeployment successful.");
    }
    catch (error) {
        console.info("Redeployment failed.");
        throw error;
    }
});
exports.redeploy = redeploy;
const checkAndWaitForJobCompletion = (workflowId, jobId, accessToken) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        let jobDetails = yield getJobDetailsById(workflowId, jobId, accessToken);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const validate = (resolve, reject, maxAttempts = 0) => __awaiter(void 0, void 0, void 0, function* () {
            if (jobDetails.job_number) {
                console.info(`Calling circleci api to get the job details for the job:${jobDetails.job_number}.`);
                const { status } = yield (0, circle_ci_service_1.callCircleCiApi)(`/project/${jobDetails.project_slug}/job/${jobDetails.job_number}`, "get", accessToken);
                if (status === types_1.JobStatus.success) {
                    console.info(`Job ${jobDetails.job_number} completed successfully.`);
                    return resolve(true);
                }
                else if (status === types_1.JobStatus.running || status === types_1.JobStatus.not_running || status === types_1.JobStatus.queued) {
                    console.info(`Job ${jobDetails.job_number} is still running...`);
                    setTimeout(function () {
                        validate(resolve, reject);
                    }, 60000);
                }
                else {
                    console.info(`Job ${jobDetails.job_number} failed with status:${status}.`);
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                    return reject(new Error("Redeployment Failed"));
                }
            }
            else if (!jobDetails.job_number && maxAttempts < 5) {
                setTimeout(function () {
                    return __awaiter(this, void 0, void 0, function* () {
                        jobDetails = yield getJobDetailsById(workflowId, jobId, accessToken);
                        yield validate(resolve, reject, maxAttempts + 1);
                    });
                }, 5000);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call
                return reject(new Error("Redeployment failed because the job number is not generated"));
            }
        });
        return new Promise(validate);
    }
    catch (error) {
        console.info(`Failed to get the job details for job id:${jobId}.`);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        console.error(error.message);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        throw new Error(error.message);
    }
});
const getWorkflowJobs = (workflowId, accessToken) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const workflowJobs = [];
        console.info(`Calling circleci api to get the jobs for the workflow:${workflowId}.`);
        const callApi = (pageToken) => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, circle_ci_service_1.callCircleCiApi)(`/workflow/${workflowId}/job`, "get", accessToken, undefined, {
                "page-token": pageToken,
            });
            workflowJobs.push(...response.items);
            if (response && response.next_page_token) {
                yield callApi(response.next_page_token);
            }
        });
        yield callApi();
        return workflowJobs;
    }
    catch (error) {
        console.info(`Failed to get the list of jobs for the workflow ${workflowId}.`);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        console.error(error.message);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        throw new Error(error.message);
    }
});
const getTriggeredJobId = (workflowId, accessToken, jobName) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.info("Starting to get the job id of the triggered job.");
        const jobs = yield getWorkflowJobs(workflowId, accessToken);
        console.info(`Got the jobs for the workflow:${workflowId}. Starting to filter the re-triggered job`);
        const jobDetails = jobs.find((job) => job.name === jobName);
        if (jobDetails && jobDetails.id) {
            console.info(`Job ${jobDetails.id} found`);
            return jobDetails.id;
        }
        // noinspection ExceptionCaughtLocallyJS
        throw new Error("Job not found");
    }
    catch (error) {
        console.info("Failed to get the job id of the triggered job.");
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        throw new Error(error.message);
    }
});
const getJobDetailsById = (workflowId, jobId, accessToken) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        console.info(`Starting to get the job details for id ${jobId}.`);
        const jobs = yield getWorkflowJobs(workflowId, accessToken);
        const jobDetails = jobs.find((job) => job.id === jobId);
        if (jobDetails) {
            console.info(`Got the job details for id ${jobId}.`);
            return jobDetails;
        }
        // noinspection ExceptionCaughtLocallyJS
        throw new Error("Job not found");
    }
    catch (error) {
        console.info("Error while getting the job details.");
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        throw new Error(error.message);
    }
});
//# sourceMappingURL=redeploy.js.map