import { assertApiRequest, assertApiRequestNotMade, mockAxios } from "../test-helpers/request";
import {
  mockGetJobDetailsWithJobNumber,
  mockGetWorkflowJobsApiCall,
  mockRerunCircleCiWorkflowApiCall,
} from "../test-helpers/mocks";
import { JobStatus } from "../../src/circleci/types";
import { redeploy } from "../../src/circleci/redeploy";
import { iif } from "../../src/utils/functions";

const workflowId = "workflow-000001";
const jobId = "job-000001";
const newWorkflowId = "workflow-000002";
const newJobId = "job-000002";
const projectSlug = "test-slug";
const reRunJobNumber = 5503;
const circleCiAccessToken = "test-token";
const jobName = "deploy-dev";

afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

describe("Redeploy jobs after secret rotation", () => {
  describe("Success scenarios", () => {
    /* eslint-disable camelcase */
    it("should call the job details api with timeout when job status is running", async () => {
      const mockedAxiosInstance = mockAxios();
      const setTimeoutSpy = jest.spyOn(global, "setTimeout");
      mockRerunCircleCiWorkflowApiCall(mockedAxiosInstance, workflowId, jobId, newWorkflowId);
      mockGetWorkflowJobsApiCall({ mockedAxiosInstance, workflowId, jobId, projectSlug, jobName });
      mockGetWorkflowJobsApiCall({
        mockedAxiosInstance,
        workflowId: newWorkflowId,
        jobNumber: reRunJobNumber,
        projectSlug,
        jobName,
      });
      mockGetJobDetailsWithJobNumber(mockedAxiosInstance, {
        status: JobStatus.running,
        jobNumber: reRunJobNumber,
        workFlowId: newWorkflowId,
        projectSlug,
      });
      setTimeout(() => {
        mockGetJobDetailsWithJobNumber(mockedAxiosInstance, {
          status: JobStatus.success,
          jobNumber: reRunJobNumber,
          workFlowId: newWorkflowId,
          projectSlug,
        });
      }, 200);
      setTimeout(() => {
        jest.runAllTimers();
      }, 300);
      jest.useFakeTimers();

      await redeploy({
        workflowId,
        jobId,
        accessToken: circleCiAccessToken,
      });

      iif(function assertCircleCiApiCalls() {
        assertApiRequest(
          mockedAxiosInstance,
          {
            url: `https://circleci.com/api/v2/workflow/${workflowId}/rerun`,
            method: "post",
            data: JSON.stringify({
              jobs: [jobId],
            }),
            headers: {
              "Circle-Token": circleCiAccessToken,
              "Content-Type": "application/json",
            },
          },
        );
        assertApiRequest(
          mockedAxiosInstance,
          {
            url: `https://circleci.com/api/v2/project/${projectSlug}/job/${reRunJobNumber}`,
            method: "get",
            headers: {
              "Circle-Token": circleCiAccessToken,
            },
          },
          2,
        );
        assertApiRequest(
          mockedAxiosInstance,
          {
            url: `https://circleci.com/api/v2/workflow/${workflowId}/job`,
            method: "get",
            headers: {
              "Circle-Token": circleCiAccessToken,
            },
          });
        assertApiRequest(
          mockedAxiosInstance,
          {
            url: `https://circleci.com/api/v2/workflow/${newWorkflowId}/job`,
            method: "get",
            headers: {
              "Circle-Token": circleCiAccessToken,
            },
          });
      });
      expect(setTimeoutSpy).toHaveBeenCalledTimes(2);
      expect(setTimeoutSpy).toHaveBeenNthCalledWith(1, expect.any(Function), 200);
      expect(setTimeoutSpy).toHaveBeenNthCalledWith(2, expect.any(Function), 300);
    });

    it("should resolve to true when job status is success", async () => {
      const mockedAxiosInstance = mockAxios();
      jest.useFakeTimers();
      jest.spyOn(global, "setTimeout");
      mockRerunCircleCiWorkflowApiCall(mockedAxiosInstance, workflowId, jobId, newWorkflowId);
      const nextPageToken = "token-to-access-next-page";
      mockGetWorkflowJobsApiCall({ mockedAxiosInstance, workflowId, jobId, projectSlug, jobName });
      mockedAxiosInstance
        .onGet(`https://circleci.com/api/v2/workflow/${newWorkflowId}/job`)
        .replyOnce(
          200,
          {
            next_page_token: nextPageToken,
            items: [{
              dependencies: [],
              job_number: 5501,
              id: "jobId-1",
              started_at: "2022-12-23T10:28:07Z",
              name: "whispers-secret-scan",
              project_slug: projectSlug,
              status: "success",
              type: "build",
              stopped_at: "2022-12-23T10:28:23Z",
            }, {
              dependencies: [],
              job_number: 5500,
              id: "jobId-2",
              started_at: "2022-12-23T10:28:07Z",
              name: "build",
              project_slug: projectSlug,
              status: "success",
              type: "build",
              stopped_at: "2022-12-23T10:28:53Z",
            }, {
              dependencies: ["jobId-2"],
              job_number: 5501,
              id: "jobId-3",
              started_at: "2022-12-23T10:29:08Z",
              name: "integration-test",
              project_slug: projectSlug,
              status: "success",
              type: "build",
              stopped_at: "2022-12-23T10:36:07Z",
            }],
          },
        );
      mockedAxiosInstance
        .onGet(`https://circleci.com/api/v2/workflow/${newWorkflowId}/job`)
        .reply(
          200,
          {
            next_page_token: null,
            items: [{
              dependencies: ["jobId-2"],
              job_number: reRunJobNumber,
              id: newJobId,
              started_at: "2022-12-23T10:29:08Z",
              name: jobName,
              project_slug: projectSlug,
              status: "success",
              type: "build",
              stopped_at: "2022-12-23T10:36:07Z",
            }],
          },
        );
      mockGetJobDetailsWithJobNumber(mockedAxiosInstance, {
        status: JobStatus.success,
        jobNumber: reRunJobNumber,
        workFlowId: newWorkflowId,
        projectSlug,
      });

      await redeploy({
        workflowId,
        jobId,
        accessToken: circleCiAccessToken,
      });

      iif(function assertCircleCiApiCalls() {
        assertApiRequest(
          mockedAxiosInstance,
          {
            url: `https://circleci.com/api/v2/workflow/${workflowId}/rerun`,
            method: "post",
            data: JSON.stringify({
              jobs: [jobId],
            }),
            headers: {
              "Circle-Token": circleCiAccessToken,
              "Content-Type": "application/json",
            },
          },
        );
        assertApiRequest(
          mockedAxiosInstance,
          {
            url: `https://circleci.com/api/v2/project/${projectSlug}/job/${reRunJobNumber}`,
            method: "get",
            headers: {
              "Circle-Token": circleCiAccessToken,
            },
          },
        );
        assertApiRequest(
          mockedAxiosInstance,
          {
            url: `https://circleci.com/api/v2/workflow/${workflowId}/job`,
            method: "get",
            headers: {
              "Circle-Token": circleCiAccessToken,
            },
          });
        assertApiRequest(
          mockedAxiosInstance,
          {
            url: `https://circleci.com/api/v2/workflow/${newWorkflowId}/job`,
            method: "get",
            headers: {
              "Circle-Token": circleCiAccessToken,
            },
          });
        expect(setTimeout).toHaveBeenCalledTimes(0);
      });
    });
  });

  describe("Error scenarios", () => {
    it("should throw error when workflow is not found while trying to re-trigger", async () => {
      const mockedAxiosInstance = mockAxios();
      jest.spyOn(global, "setTimeout");
      mockedAxiosInstance
        .onPost(`https://circleci.com/api/v2/workflow/${workflowId}/rerun`, { jobs: [jobId] })
        .reply(
          404,
          {
            message: "Workflow not found",
          },
        );

      await expect(redeploy({
        workflowId,
        jobId,
        accessToken: circleCiAccessToken,
      })).rejects.toThrowError(new Error("Workflow not found"));
      iif(function assertReDeployWorkflowIsTriggered() {
        assertApiRequest(
          mockedAxiosInstance,
          {
            url: `https://circleci.com/api/v2/workflow/${workflowId}/rerun`,
            method: "post",
            data: JSON.stringify({
              jobs: [jobId],
            }),
            headers: {
              "Circle-Token": circleCiAccessToken,
              "Content-Type": "application/json",
            },
          },
        );
      });
      assertApiRequestNotMade(
        mockedAxiosInstance,
        {
          url: `https://circleci.com/api/v2/workflow/${newWorkflowId}/job`,
          method: "get",
          headers: {
            "Circle-Token": circleCiAccessToken,
          },
        },
      );
      assertApiRequestNotMade(
        mockedAxiosInstance,
        {
          url: `https://circleci.com/api/v2/workflow/${workflowId}/job`,
          method: "get",
          headers: {
            "Circle-Token": circleCiAccessToken,
          },
        },
      );
      expect(setTimeout).toHaveBeenCalledTimes(0);
      assertApiRequestNotMade(
        mockedAxiosInstance,
        {
          url: `https://circleci.com/api/v2/project/${projectSlug}/job/${reRunJobNumber}`,
          method: "get",
          headers: {
            "Circle-Token": circleCiAccessToken,
          },
        },
      );
    });

    it("should throw error when trying to re-trigger a workflow which is more than 90 days old", async () => {
      const mockedAxiosInstance = mockAxios();
      jest.spyOn(global, "setTimeout");
      mockedAxiosInstance
        .onPost(`https://circleci.com/api/v2/workflow/${workflowId}/rerun`, { jobs: [jobId] })
        .reply(
          400,
          {
            message: "Cannot rerun workflow: The workflow's pipeline is more than 90 days old.",
          },
        );

      await expect(redeploy({
        workflowId,
        jobId,
        accessToken: circleCiAccessToken,
      })).rejects.toThrowError(new Error("Cannot rerun workflow: The workflow's pipeline is more than 90 days old."));
      iif(function assertReDeployWorkflowIsTriggered() {
        assertApiRequest(
          mockedAxiosInstance,
          {
            url: `https://circleci.com/api/v2/workflow/${workflowId}/rerun`,
            method: "post",
            data: JSON.stringify({
              jobs: [jobId],
            }),
            headers: {
              "Circle-Token": circleCiAccessToken,
              "Content-Type": "application/json",
            },
          },
        );
      });
      assertApiRequestNotMade(
        mockedAxiosInstance,
        {
          url: `https://circleci.com/api/v2/workflow/${newWorkflowId}/job`,
          method: "get",
          headers: {
            "Circle-Token": circleCiAccessToken,
          },
        },
      );
      assertApiRequestNotMade(
        mockedAxiosInstance,
        {
          url: `https://circleci.com/api/v2/workflow/${workflowId}/job`,
          method: "get",
          headers: {
            "Circle-Token": circleCiAccessToken,
          },
        },
      );
      expect(setTimeout).toHaveBeenCalledTimes(0);
      assertApiRequestNotMade(
        mockedAxiosInstance,
        {
          url: `https://circleci.com/api/v2/project/${projectSlug}/job/${reRunJobNumber}`,
          method: "get",
          headers: {
            "Circle-Token": circleCiAccessToken,
          },
        },
      );
    });

    it("Should throw error when something fails while getting the workflow jobs", async () => {
      const mockedAxiosInstance = mockAxios();
      jest.spyOn(global, "setTimeout");
      mockRerunCircleCiWorkflowApiCall(mockedAxiosInstance, workflowId, jobId, newWorkflowId);
      mockedAxiosInstance
        .onGet(`https://circleci.com/api/v2/workflow/${workflowId}/job`)
        .reply(
          500,
          { message: "Error" },
        );

      await expect(redeploy({
        workflowId,
        jobId,
        accessToken: circleCiAccessToken,
      })).rejects.toThrowError();
      iif(function assertReDeployWorkflowIsTriggered() {
        assertApiRequest(
          mockedAxiosInstance,
          {
            url: `https://circleci.com/api/v2/workflow/${workflowId}/rerun`,
            method: "post",
            data: JSON.stringify({
              jobs: [jobId],
            }),
            headers: {
              "Circle-Token": circleCiAccessToken,
              "Content-Type": "application/json",
            },
          },
        );
      });
      iif(function assertGetWorkFlowJobsIsTriggered() {
        assertApiRequest(
          mockedAxiosInstance,
          {
            url: `https://circleci.com/api/v2/workflow/${workflowId}/job`,
            method: "get",
            headers: {
              "Circle-Token": circleCiAccessToken,
              "Content-Type": "application/json",
            },
          },
        );
      });
      expect(setTimeout).toHaveBeenCalledTimes(0);
      assertApiRequestNotMade(
        mockedAxiosInstance,
        {
          url: `https://circleci.com/api/v2/project/${projectSlug}/job/${reRunJobNumber}`,
          method: "get",
          headers: {
            "Circle-Token": circleCiAccessToken,
          },
        },
      );
    });

    it("Should throw error when the job is not found in the newly triggered workflow", async () => {
      const mockedAxiosInstance = mockAxios();
      jest.spyOn(global, "setTimeout");
      mockRerunCircleCiWorkflowApiCall(mockedAxiosInstance, workflowId, jobId, newWorkflowId);
      mockGetWorkflowJobsApiCall({ mockedAxiosInstance, workflowId, jobId, projectSlug, jobName });
      mockGetWorkflowJobsApiCall({
        mockedAxiosInstance,
        workflowId: newWorkflowId,
        jobNumber: reRunJobNumber,
        projectSlug,
        jobName: "different-job",
      });

      await expect(redeploy({
        workflowId,
        jobId,
        accessToken: circleCiAccessToken,
      })).rejects.toThrowError(new Error("Job not found"));
      iif(function assertCircleCiApiCalls() {
        assertApiRequest(
          mockedAxiosInstance,
          {
            url: `https://circleci.com/api/v2/workflow/${workflowId}/rerun`,
            method: "post",
            data: JSON.stringify({
              jobs: [jobId],
            }),
            headers: {
              "Circle-Token": circleCiAccessToken,
              "Content-Type": "application/json",
            },
          },
        );
        assertApiRequest(
          mockedAxiosInstance,
          {
            url: `https://circleci.com/api/v2/workflow/${workflowId}/job`,
            method: "get",
            headers: {
              "Circle-Token": circleCiAccessToken,
            },
          });
        assertApiRequest(
          mockedAxiosInstance,
          {
            url: `https://circleci.com/api/v2/workflow/${newWorkflowId}/job`,
            method: "get",
            headers: {
              "Circle-Token": circleCiAccessToken,
            },
          });
        assertApiRequestNotMade(
          mockedAxiosInstance,
          {
            url: `https://circleci.com/api/v2/project/${projectSlug}/job/${reRunJobNumber}`,
            method: "get",
            headers: {
              "Circle-Token": circleCiAccessToken,
            },
          },
        );
      });
      expect(setTimeout).toHaveBeenCalledTimes(0);
    });

    it("Should throw error when the job execution is not successfully completed", async () => {
      const mockedAxiosInstance = mockAxios();
      mockRerunCircleCiWorkflowApiCall(mockedAxiosInstance, workflowId, jobId, newWorkflowId);
      mockGetWorkflowJobsApiCall({ mockedAxiosInstance, workflowId, jobId, projectSlug, jobName });
      mockGetWorkflowJobsApiCall({
        mockedAxiosInstance,
        workflowId: newWorkflowId,
        jobNumber: reRunJobNumber,
        projectSlug,
        jobName,
      });
      mockGetJobDetailsWithJobNumber(mockedAxiosInstance, {
        status: JobStatus.failed,
        jobNumber: reRunJobNumber,
        workFlowId: newWorkflowId,
        projectSlug,
      });

      await expect(redeploy({
        workflowId,
        jobId,
        accessToken: circleCiAccessToken,
      })).rejects.toThrowError(new Error("Redeployment Failed"));
      iif(function assertCircleCiApiCalls() {
        assertApiRequest(
          mockedAxiosInstance,
          {
            url: `https://circleci.com/api/v2/workflow/${workflowId}/rerun`,
            method: "post",
            data: JSON.stringify({
              jobs: [jobId],
            }),
            headers: {
              "Circle-Token": circleCiAccessToken,
              "Content-Type": "application/json",
            },
          },
        );
        assertApiRequest(
          mockedAxiosInstance,
          {
            url: `https://circleci.com/api/v2/project/${projectSlug}/job/${reRunJobNumber}`,
            method: "get",
            headers: {
              "Circle-Token": circleCiAccessToken,
            },
          },
        );
        assertApiRequest(
          mockedAxiosInstance,
          {
            url: `https://circleci.com/api/v2/workflow/${workflowId}/job`,
            method: "get",
            headers: {
              "Circle-Token": circleCiAccessToken,
            },
          });
        assertApiRequest(
          mockedAxiosInstance,
          {
            url: `https://circleci.com/api/v2/workflow/${newWorkflowId}/job`,
            method: "get",
            headers: {
              "Circle-Token": circleCiAccessToken,
            },
          });
      });
    });
  });
});
