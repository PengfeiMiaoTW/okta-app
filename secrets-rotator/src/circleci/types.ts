export type IReTriggerWorkflowResponse = {
  // eslint-disable-next-line camelcase
  workflow_id: string;
};

export enum JobStatus {
  success = "success",
  running = "running",
  "not_run" = "not_run",
  failed = "failed",
  retried = "retried",
  queued = "queued",
  "not_running" = "not_running",
  "infrastructure_fail" = "infrastructure_fail",
  timedout = "timedout",
  "on_hold" = "on_hold",
  "terminated-unknown" = "terminated-unknown",
  blocked = "blocked",
  canceled = "canceled",
  unauthorized = "unauthorized"
}

export interface IJobDetails {
  "dependencies": string[];
  "job_number": number;
  "id": string;
  "started_at": string;
  "name": string;
  "project_slug": string;
  "status": JobStatus;
  "type": string;
  "stopped_at": string;
}

export type IGetJobDetailResponse = {
  status: JobStatus;
};

export type IGetWorkFlowJobsResponse = {
  // eslint-disable-next-line camelcase
  next_page_token: string;
  items: IJobDetails[];
};
