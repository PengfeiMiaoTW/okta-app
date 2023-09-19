import { Method } from "axios";

export type Password = string;
export type Url = string;

export enum SourceActionType {
  GCP_SERVICE_ACCOUNT_KEY = "GCP_SERVICE_ACCOUNT_KEY_SOURCE",
  GCP_POSTGRES_DATABASE = "GCP_POSTGRES_DATABASE_SOURCE",
  API = "API_SOURCE",
  API_PLATFORM_CLIENT_SECRET = "API_PLATFORM_CLIENT_SECRET",
  GCP_SECRET_MANAGER = "GCP_SECRET_MANAGER_SOURCE",
  AWS_SECRET_MANAGER = "AWS_SECRET_MANAGER_SOURCE",
  SENDGRID = "SENDGRID_SOURCE",
  API_PLATFORM_API_SERVICE_TOKEN = "API_PLATFORM_API_SERVICE_TOKEN_SOURCE",
  GENERATE_PASSWORD = "GENERATE_PASSWORD",
  AWS_GATEWAY_API_KEY = "AWS_GATEWAY_API_KEY_SOURCE"
}

export enum ConsumerActionType {
  GCP_SECRET_MANAGER = "GCP_SECRET_MANAGER_CONSUMER",
  API = "API_CONSUMER",
  API_PLATFORM_API_SERVICE_TOKEN = "API_PLATFORM_API_SERVICE_TOKEN_CONSUMER",
  EVENT_SUBSCRIPTION_TOKEN = "EVENT_SUBSCRIPTION_TOKEN",
  AWS_SECRET_MANAGER = "AWS_SECRET_MANAGER_CONSUMER",
  AWS_GATEWAY_API_KEY = "AWS_GATEWAY_API_KEY_CONSUMER",
}

export enum AuthenticationType {
  GCP_SERVICE_ACCOUNT = "GCP_SERVICE_ACCOUNT",
  SENDGRID = "SENDGRID",
  BASIC = "BASIC",
  OAUTH_2 = "OAUTH_2",
  BEARER = "BEARER",
  AWS_ACCOUNT = "AWS_ACCOUNT"
}

export type AwsAccountAuthentication = {
  type: AuthenticationType.AWS_ACCOUNT;
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
  };
};

export type GcpServiceAccountAuthentication = {
  type: AuthenticationType.GCP_SERVICE_ACCOUNT;
  scopes?: string[];
  /** *
   * base64 encoded gcp service account key
   */
  credentials?: string;
};

export type SendGridAuthentication = {
  type: AuthenticationType.SENDGRID;
  apiKey: string;
};

export type BasicAuthentication = {
  type: AuthenticationType.BASIC;
  userName: string;
  password: string;
};

export type Oauth2Authentication = {
  type: AuthenticationType.OAUTH_2;
  grantType: string;
  scope: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
};

export type BearerAuthentication = {
  type: AuthenticationType.BEARER;
  apiKey: string;
};

export type GcpPostgresDataBaseSourceAction = {
  type: SourceActionType.GCP_POSTGRES_DATABASE;
  userName: string;
  instanceName: string;
  projectId: string;
  authentication?: GcpServiceAccountAuthentication;
};

export type GcpSecretManagerSourceAction = {
  type: SourceActionType.GCP_SECRET_MANAGER;
  secretName: string;
  keyFieldName?: string;
  isValueArray?: boolean;
  keyFieldNames?: Array<{
    keyFieldName: string;
    isValueArray?: boolean;
  }>;
  projectId: string;
  authentication?: GcpServiceAccountAuthentication;
};

export type GcpSecretManagerConsumerAction = Omit<GcpSecretManagerSourceAction, "type"> & {
  type: ConsumerActionType.GCP_SECRET_MANAGER;
};


type secretName = string;
type secretARN = string;

export type AwsSecretManagerSourceAction = {
  type: SourceActionType.AWS_SECRET_MANAGER;
  secretId: secretName | secretARN;
  region: string;
  keyFieldName?: string;
  isValueArray?: boolean;
  keyFieldNames?: Array<{
    keyFieldName: string;
    isValueArray?: boolean;
  }>;
  authentication?: AwsAccountAuthentication;
};


export type AwsSecretManagerConsumerAction = Omit<AwsSecretManagerSourceAction, "type"> & {
  type: ConsumerActionType.AWS_SECRET_MANAGER;
};

export type ApiSourceAction = {
  type: SourceActionType.API;
  body?: unknown;
  params?: unknown;
  url: string;
  method: Method;
  responseKeyField?: string;
  authentication: BasicAuthentication | Oauth2Authentication | BearerAuthentication;
};

export type ApiClientSecretAction = {
  type: SourceActionType.API_PLATFORM_CLIENT_SECRET;
  apiPlatformUrl: Url;
  authentication: Oauth2Authentication;
};

export type ApiConsumerAction = Omit<ApiSourceAction, "type"> & {
  type: ConsumerActionType.API;
};

export type SendGridSourceAction = {
  type: SourceActionType.SENDGRID;
  apiKeyName: string;
  authentication: SendGridAuthentication;
};

export type GeneratePasswordSourceAction = {
  type: SourceActionType.GENERATE_PASSWORD;
};

export type ApiPlatformApiServiceTokenSourceAction = {
  type: SourceActionType.API_PLATFORM_API_SERVICE_TOKEN;
  apiName: string;
  apiKeyHeaderName: string;
  apiPlatformUrl: string;
  authentication: Oauth2Authentication;
};

export type ApiPlatformApiServiceTokenConsumerAction = {
  type: ConsumerActionType.API_PLATFORM_API_SERVICE_TOKEN;
  apiName: string;
  apiKeyHeaderName: string;
  apiPlatformUrl: string;
  authentication: Oauth2Authentication;
};

export type EventSubscriptionTokenConsumerAction = {
  type: ConsumerActionType.EVENT_SUBSCRIPTION_TOKEN;
  eventSubscriptionName: string;
  eventSubscriptionAuthHeaderName: string;
  apiPlatformUrl: string;
  authentication: Oauth2Authentication;
};

export type AwsGatewayApiKeySourceAction = {
  type: SourceActionType.AWS_GATEWAY_API_KEY;
  usagePlanId: string;
  region: string;
  authentication?: AwsAccountAuthentication;
};

export type AwsGatewayApiKeyConsumerAction = Omit<AwsGatewayApiKeySourceAction, "type"> & {
  type: ConsumerActionType.AWS_GATEWAY_API_KEY;
};

export type GCPServiceAccountKeySourceAction = {
  type: SourceActionType.GCP_SERVICE_ACCOUNT_KEY;
  serviceAccountName: string;
  projectId: string;
  authentication?: GcpServiceAccountAuthentication;
};

export type SourceAction = SendGridSourceAction
| ApiSourceAction
| ApiClientSecretAction
| GcpSecretManagerSourceAction
| AwsSecretManagerSourceAction
| GcpPostgresDataBaseSourceAction
| ApiPlatformApiServiceTokenSourceAction
| GCPServiceAccountKeySourceAction
| GeneratePasswordSourceAction
| AwsGatewayApiKeySourceAction;


export type ConsumerAction =
  ApiConsumerAction
  | GcpSecretManagerConsumerAction
  | ApiPlatformApiServiceTokenConsumerAction
  | EventSubscriptionTokenConsumerAction
  | AwsSecretManagerConsumerAction
  | AwsGatewayApiKeyConsumerAction;

export type SecretSource = {
  name: string;
  action: SourceAction;
  passwordConfig?: {
    length: number;
    numbers: boolean;
    symbols: boolean;
    lowercase: boolean;
    excludeSimilarCharacters: boolean;
    exclude: string;
    strict: boolean;
  };
};

export type redeployConfiguration = {
  workflowId: string;
  jobId: string;
  accessToken: string;
};

export type SecretConsumer = {
  name: string;
  action: ConsumerAction;
  redeploy?: redeployConfiguration | redeployConfiguration[];
};

export type SecretRotationConfig = {
  source: SecretSource;
  consumers: SecretConsumer[];
};
