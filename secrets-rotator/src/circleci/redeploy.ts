import { redeployConfiguration } from "../types";
import { callCircleCiApi } from "./circle-ci-service";
import {
  IGetJobDetailResponse,
  IGetWorkFlowJobsResponse,
  IJobDetails,
  IReTriggerWorkflowResponse,
  JobStatus,
} from "./types";


export const reTriggerWorkflow = async ({ jobId, workflowId, accessToken }: redeployConfiguration) => {
  try {
    console.info(`Starting to trigger the redeployment for the job ${jobId} in the workflow ${workflowId}.`);
    const response = await callCircleCiApi<IReTriggerWorkflowResponse>(
      `/workflow/${workflowId}/rerun`,
      "post",
      accessToken,
      {
        jobs: [jobId],
      },
    );
    console.info(`Successfully triggered redeployment for the job ${jobId} in the workflow ${workflowId}.`);
    // eslint-disable-next-line camelcase
    return response.workflow_id;
  } catch (error) {
    console.info(`Failed to trigger redeployment for the job ${jobId} in the workflow ${workflowId}.`);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    console.error(error.message);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    throw new Error(error.message);
  }
};

export const redeploy = async (redeployConfig: redeployConfiguration) => {
  try {
    console.info("Starting to redeployment.");
    const { workflowId, jobId, accessToken } = redeployConfig;
    const newWorkflowId = await reTriggerWorkflow(redeployConfig);
    const newJobId = await getTriggeredJobId(
      newWorkflowId,
      accessToken,
      (await getJobDetailsById(workflowId, jobId, accessToken)).name,
    );
    await checkAndWaitForJobCompletion(newWorkflowId, newJobId, accessToken);
    console.info("Redeployment successful.");
  } catch (error) {
    console.info("Redeployment failed.");
    throw error;
  }
};

const checkAndWaitForJobCompletion = async (workflowId: string, jobId: IJobDetails["id"], accessToken: string) => {
  try {
    let jobDetails = await getJobDetailsById(workflowId, jobId, accessToken);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const validate = async (resolve: (arg0: boolean) => any, reject: any, maxAttempts: number = 0) => {
      if (jobDetails.job_number) {
        console.info(`Calling circleci api to get the job details for the job:${jobDetails.job_number}.`);
        const { status } = await callCircleCiApi<IGetJobDetailResponse>(
          `/project/${jobDetails.project_slug}/job/${jobDetails.job_number}`,
          "get",
          accessToken,
        );
        if (status === JobStatus.success) {
          console.info(`Job ${jobDetails.job_number} completed successfully.`);
          return resolve(true);
        } else if (status === JobStatus.running || status === JobStatus.not_running || status === JobStatus.queued) {
          console.info(`Job ${jobDetails.job_number} is still running...`);
          setTimeout(function() {
            validate(resolve, reject);
          }, 60000);
        } else {
          console.info(`Job ${jobDetails.job_number} failed with status:${status}.`);
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call
          return reject(new Error("Redeployment Failed"));
        }
      } else if (!jobDetails.job_number && maxAttempts < 5) {
        setTimeout(async function() {
          jobDetails = await getJobDetailsById(workflowId, jobId, accessToken);
          await validate(resolve, reject, maxAttempts + 1);
        }, 5000);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        return reject(new Error("Redeployment failed because the job number is not generated"));
      }
    };
    return new Promise(validate);
  } catch (error) {
    console.info(`Failed to get the job details for job id:${jobId}.`);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    console.error(error.message);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    throw new Error(error.message);
  }
};

const getWorkflowJobs = async (
  workflowId: string,
  accessToken: redeployConfiguration["accessToken"],
) => {
  try {
    const workflowJobs: IGetWorkFlowJobsResponse["items"] = [];
    console.info(`Calling circleci api to get the jobs for the workflow:${workflowId}.`);
    const callApi = async (pageToken?: string) => {
      const response = await callCircleCiApi<IGetWorkFlowJobsResponse>(
        `/workflow/${workflowId}/job`,
        "get",
        accessToken,
        undefined,
        {
          "page-token": pageToken,
        },
      );
      workflowJobs.push(...response.items);
      if (response && response.next_page_token) {
        await callApi(response.next_page_token);
      }
    };
    await callApi();
    return workflowJobs;
  } catch (error) {
    console.info(`Failed to get the list of jobs for the workflow ${workflowId}.`);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    console.error(error.message);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    throw new Error(error.message);
  }
};

const getTriggeredJobId = async (
  workflowId: string,
  accessToken: redeployConfiguration["accessToken"],
  jobName: string,
) => {
  try {
    console.info("Starting to get the job id of the triggered job.");
    const jobs = await getWorkflowJobs(workflowId, accessToken);
    console.info(`Got the jobs for the workflow:${workflowId}. Starting to filter the re-triggered job`);
    const jobDetails = jobs.find((job) => job.name === jobName);
    if (jobDetails && jobDetails.id) {
      console.info(`Job ${jobDetails.id} found`);
      return jobDetails.id;
    }
    // noinspection ExceptionCaughtLocallyJS
    throw new Error("Job not found");
  } catch (error) {
    console.info("Failed to get the job id of the triggered job.");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    throw new Error(error.message);
  }
};

const getJobDetailsById = async (workflowId: string, jobId: string, accessToken: redeployConfiguration["accessToken"]) => {
  try {
    console.info(`Starting to get the job details for id ${jobId}.`);
    const jobs = await getWorkflowJobs(workflowId, accessToken);
    const jobDetails = jobs.find((job) => job.id === jobId);
    if (jobDetails) {
      console.info(`Got the job details for id ${jobId}.`);
      return jobDetails;
    }
    // noinspection ExceptionCaughtLocallyJS
    throw new Error("Job not found");
  } catch (error) {
    console.info("Error while getting the job details.");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    throw new Error(error.message);
  }
};

