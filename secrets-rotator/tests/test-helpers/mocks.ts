import * as SecretManager from "@google-cloud/secret-manager";
import castTo from "../../src/utils/cast-to";
import * as gcpAuthentication from "../../src/gcp/authorization";
import { GoogleApis } from "googleapis/build/src/googleapis";
import MockAdapter from "axios-mock-adapter";
import { JobStatus } from "../../src/circleci/types";
import { AwsStub, mockClient } from "aws-sdk-client-mock";
import {
  GetSecretValueCommand,
  SecretsManagerClient,
  ServiceInputTypes,
  ServiceOutputTypes,
  UpdateSecretCommand,
} from "@aws-sdk/client-secrets-manager";
import * as APIGateway from "@aws-sdk/client-api-gateway";
import {
  ApiKeys,
  CreateApiKeyCommand,
  CreateUsagePlanKeyCommand,
  DeleteApiKeyCommand,
  GetApiKeysCommand,
  GetUsagePlanKeysCommand,
  UsagePlanKeys,
} from "@aws-sdk/client-api-gateway";
import { ApiKey, UsagePlanKey } from "@aws-sdk/client-api-gateway/dist-types/models/models_0";

export const mockGCPSecretManager = () => {
  const mockAddSecretVersion = jest.fn();
  const mockDisableSecretVersion = jest.fn();
  const mockAccessSecretVersion = jest.fn();
  jest
    .spyOn(SecretManager, "SecretManagerServiceClient")
    .mockImplementation(() => castTo<SecretManager.SecretManagerServiceClient>({
      accessSecretVersion: mockAccessSecretVersion,
      addSecretVersion: mockAddSecretVersion,
      disableSecretVersion: mockDisableSecretVersion,
    }));
  return { mockAccessSecretVersion, mockAddSecretVersion, mockDisableSecretVersion };
};

export const mockAWSSecretManagerClient = () => {
  const mockSecretManagerClient = mockClient(SecretsManagerClient);
  return { mockSecretManagerClient };
};

export const mockAWSGetSecretValueCommand = (options: {
  mockSecretManagerClient: AwsStub<ServiceInputTypes, ServiceOutputTypes>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockResponse: any;
}) => {
  const { mockSecretManagerClient, mockResponse } = options;
  mockSecretManagerClient.on(GetSecretValueCommand)
    .resolves({
      SecretString: JSON.stringify(mockResponse),
    });
};

export const mockAWSUpdateSecretCommand = (options: {
  mockSecretManagerClient: AwsStub<ServiceInputTypes, ServiceOutputTypes>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockResponse: Record<string, any>;
}) => {
  const { mockSecretManagerClient, mockResponse } = options;
  mockSecretManagerClient.on(UpdateSecretCommand)
    .resolves(mockResponse);
};
export const mockRejectsAWSUpdateSecretCommand = (options: {
  mockSecretManagerClient: AwsStub<ServiceInputTypes, ServiceOutputTypes>;
}) => {
  const { mockSecretManagerClient } = options;
  mockSecretManagerClient.on(UpdateSecretCommand)
    .rejects(new Error("mocked error"));
};

export const mockAWSAPIGatewayClient = () => {
  const mockAPIGatewayClient = mockClient(APIGateway.APIGatewayClient);
  return { mockAPIGatewayClient };
};

export const mockAWSGetUsagePlanKeysCommand = (options: {
  mockAPIGatewayClient: AwsStub<APIGateway.ServiceInputTypes, APIGateway.ServiceOutputTypes>;
  mockResponse: UsagePlanKeys;
}) => {
  const { mockAPIGatewayClient, mockResponse } = options;
  mockAPIGatewayClient.on(GetUsagePlanKeysCommand)
    .resolves(mockResponse);
};

export const mockAWSGetApiKeysCommand = (options: {
  mockAPIGatewayClient: AwsStub<APIGateway.ServiceInputTypes, APIGateway.ServiceOutputTypes>;
  mockResponse: ApiKeys;
}) => {
  const { mockAPIGatewayClient, mockResponse } = options;
  mockAPIGatewayClient.on(GetApiKeysCommand)
    .resolves(mockResponse);
};

export const mockAWSCreateApiKeyCommand = (options: {
  mockAPIGatewayClient: AwsStub<APIGateway.ServiceInputTypes, APIGateway.ServiceOutputTypes>;
  mockResponse: ApiKey;
}) => {
  const { mockAPIGatewayClient, mockResponse } = options;
  mockAPIGatewayClient.on(CreateApiKeyCommand)
    .resolves(mockResponse);
};

export const mockAWSCreateUsagePlanKeyCommand = (options: {
  mockAPIGatewayClient: AwsStub<APIGateway.ServiceInputTypes, APIGateway.ServiceOutputTypes>;
  mockResponse: UsagePlanKey;
}) => {
  const { mockAPIGatewayClient, mockResponse } = options;
  mockAPIGatewayClient.on(CreateUsagePlanKeyCommand)
    .resolves(mockResponse);
};

export const mockAWSDeleteApiKeyCommand = (options: {
  mockAPIGatewayClient: AwsStub<APIGateway.ServiceInputTypes, APIGateway.ServiceOutputTypes>;
}) => {
  const { mockAPIGatewayClient } = options;
  mockAPIGatewayClient.on(DeleteApiKeyCommand);
};

export const mockGcpSqlUserUpdate = (response: unknown) => {
  const mockSqlUserUpdate = jest.fn().mockReturnValue(response);
  jest
    .spyOn(gcpAuthentication, "initializeGoogleApis")
    .mockResolvedValueOnce(castTo<GoogleApis>({
      sqladmin: jest.fn().mockReturnValue({
        users: {
          update: mockSqlUserUpdate,
        },
      }),
    }));
  return mockSqlUserUpdate;
};

export const mockRerunCircleCiWorkflowApiCall =
  (mockedAxiosInstance: MockAdapter, workflowId: string, jobId: string, newWorkflowId: string) => {
    mockedAxiosInstance
      .onPost(`https://circleci.com/api/v2/workflow/${workflowId}/rerun`, { jobs: [jobId] })
      .reply(
        200,
        {
          // eslint-disable-next-line camelcase
          workflow_id: newWorkflowId,
        },
      );
  };

export const mockGetWorkflowJobsApiCall = (options: {
  mockedAxiosInstance: MockAdapter;
  workflowId: string;
  projectSlug: string;
  jobName: string;
  jobId?: string;
  jobNumber?: number;

}) => {
  const { mockedAxiosInstance, workflowId, jobId, projectSlug, jobNumber, jobName } = options;
  mockedAxiosInstance
    .onGet(`https://circleci.com/api/v2/workflow/${workflowId}/job`)
    .reply(
      200,
      {
        /* eslint-disable camelcase */
        next_page_token: null,
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
          job_number: jobNumber ?? "123",
          id: jobId ?? "jobId-3",
          started_at: "2022-12-23T10:29:08Z",
          name: jobName,
          project_slug: projectSlug,
          status: "running",
          type: "build",
          stopped_at: "2022-12-23T10:36:07Z",
        }],
      },
    );
};

export const mockGetJobDetailsWithJobNumber = (
  mockedAxiosInstance: MockAdapter,
  jobDetails: {
    status: JobStatus;
    projectSlug: string;
    jobNumber: number;
    workFlowId: string;
  }) => {
  const { projectSlug, jobNumber, status, workFlowId } = jobDetails;
  mockedAxiosInstance
    .onGet(`https://circleci.com/api/v2/project/${projectSlug}/job/${jobNumber}`)
    .reply(
      200,
      {
        /* eslint-disable camelcase */
        web_url: "https://test/url",
        project: {
          external_url: "https://test/url",
          slug: projectSlug,
          name: "test-service",
          id: "project-id",
        },
        parallel_runs: [{
          index: 0,
          status,
        }],
        started_at: "2022-12-27T06:54:28.125Z",
        latest_workflow: {
          name: "test-and-deploy",
          id: workFlowId,
        },
        name: "integration-test",
        executor: {
          resource_class: "medium",
          type: "linux",
        },
        parallelism: 1,
        status,
        // eslint-disable-next-line id-blacklist
        number: 5516,
        pipeline: {
          id: "pipeline-id",
        },
        duration: 348248,
        created_at: "2022-12-27T06:54:25.536Z",
        messages: [],
        contexts: [{
          name: "TEST_CONTEXT",
        }],
        organization: {
          name: "org-name",
        },
        queued_at: "2022-12-27T06:54:25.614Z",
        stopped_at: "2022-12-27T07:00:16.373Z",

      },
    );
};
