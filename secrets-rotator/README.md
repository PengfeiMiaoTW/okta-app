# Automated Secrets Rotator

## Table Of Contents

* [Glossary](#glossary)
* [Introduction](#introduction)
* [Supported Secrets](#supported-secrets)
  * [CDA secrets (API Client secret, API publisher key, Event subscription token)](#cda-secrets)
  * [GCP SQL DB password](#gcp-sql-db-password)
  * [GCP service account key](#gcp-service-account-key)
  * [Static tokens](#static-token)
  * [Update secrets stored in GCP/AWS secret manager](#update-secrets-stored-in-gcpaws-secret-manager)
  * [AWS Gateway API key](#aws-gateway-api-key)
* [Installation](#installation)
* [Commands](#commands)
  * [Rotate secrets](#rotate-secrets)
  * [Decrypt the report file](#decrypt-the-report-file)
  * [Validate secrets rotator configuration file](#validate-secrets-rotator-configuration-file)
* [Triggering Secrets Rotator Tool](#triggering-secrets-rotator-tool)
* [Password Config](#password-config)
* [Configure chat notifications](#configure-chat-notifications)
* [Steps to generate GCLOUD key](#steps-to-generate-gcloud-key)
* [Sample secrets rotation configured repository](https://github.com/Digital-Innovation-Labs/secrets-rotator-reference-setup)
* [Steps to be followed when a secret is compromised](#steps-to-be-followed-when-a-secret-is-compromised)
* [FAQs](#faqs)

## Glossary

- **Secrets Rotator** - A tool to automate the secret rotation for services/systems and its consumers.
- **API client secret** - To consume an API in API platform, we need a consumer app. The consumer app will have client id and client secret. An access token will be generated only for a valid client id and client secret, using which the api endpoint can be accessed. The API client secret should be rotated periodically.
- **API publisher key** - When API platform accesses the upstream url(backend services), it sends a token in the request header.The backend service authenticates the request using this token. This token is referred to as API publisher key. The API publisher key will be used by the backend for authentication, when a call is made to the backend from api platform.
- **Event subscription token** - While delivering the events to the subscribers, the events platform sends a token in the request header. The subscriber endpoint authenticates the request using this token. This token is referred to as Event subscription token.
- **Static token** - Static tokens are the ones which are present only in the secret managers.The key to encrypt a file/password can be considered as a static token.Secret rotator supports the rotation of static tokens as well.
- **Config file** - The secrets rotator tool needs a JSON config file as input.This config file will contain the required details to rotate/update the secrets.
- **GCLOUD key** - GCP service account key in base64 encoded format.

## Introduction

The Secrets Rotator is a tool to automate the secrets rotation of services/systems. This tool will get the details required to rotate the secrets as a JSON config and generates an encrypted version of the rotated secrets and logs.

### Features

* Automatically rotate and update the rotated secrets in their consumer systems.
* Ability to work as a Command line utility and also in a pipeline.
* Ability to generate an encrypted file which will contain the information about the logs and rotated secrets.
* Ability to generate password with the help of config provided.

## Supported Secrets

Using the secrets rotator, the following secrets can be rotated:

* [CDA secrets (API Client secret, API publisher key, Event subscription token)](#cda-secrets)
* [GCP SQL DB password](#gcp-sql-db-password)
* [GCP service account key](#gcp-service-account-key)
* [Static tokens](#static-token)

### CDA secrets

In CDA, you can rotate:

* [API Client Secret](#api-client-secret)
* [API Publisher Key](#api-publisher-key)
* [Event Subscription Token](#event-subscription-token)

Please check the [CDA secrets demo videos](https://drive.google.com/drive/folders/1UNqQFqNh06oeugznoXlZb2ItDBnVfjJ6) for better understanding.

#### API Client Secret

The Client ID and Client Secret is used to generate a temporary Access token using Okta Auth Url.

![APIClientSecret](./images/APIClient.png)

Before starting with the secrets rotation please ensure two client secrets are created for the particular client id, else use the following end point to create the additional secret. endpoint: [https://neo.thoughtworks.net/api-gateway/apis/Clients](https://neo.thoughtworks.net/api-gateway/apis/Clients)
sub path: ``` /{clientId}/secrets ```
method: ``` POST ```

Ensure that the latest created secret is stored in your secret manager.

The Secrets Rotator needs a config file which will contain the details necessary to rotate the Client Secret. It should contain a **`source`** and **`consumers`** objects. In this case, the `source` will contain information needed to rotate the API platform consumer app secret. The `consumers` use this rotated client secret and will be updated in the required systems, e.g. GCP secret manager, AWS secret manager.

##### Sample Config to update secrets stored in GCP secret manager

```json
{
  "source": {
    "name": "<any name which will help to identify the secret source>",
    "action": {
      "type": "API_PLATFORM_CLIENT_SECRET",
      "apiPlatformUrl": "${API_PLATFORM_URL}",
      "authentication": {
        "clientId": "${API_PLATFORM_CLIENT_ID}",
        "clientSecret": "${API_PLATFORM_CLIENT_SECRET}",
        "tokenUrl": "${API_PLATFORM_TOKEN_URL}",
        "scope": "api",
        "grantType": "client_credentials",
        "type": "OAUTH_2"
      }
    }
  },
  "consumers": [
    {
      "name": "<any name which will help to identify the consumer>",
      "action": {
        "type": "GCP_SECRET_MANAGER_CONSUMER",
        "secretName": "${GCP_SECRET_NAME}",
        "keyFieldName": "apiPlatform.clientSecret",
        "projectId": "${GCP_PROJECT_ID}",
        "authentication": {
          "scopes": [],
          "type": "GCP_SERVICE_ACCOUNT",
          "credentials": "${GCLOUD_KEY}"
        }
      }
    },
    {
      "name": "<any name which will help to identify the consumer>",
      "action": {
        "type": "GCP_SECRET_MANAGER_CONSUMER",
        "secretName": "${GCP_SECRET_NAME}",
        "projectId": "${GCP_PROJECT_ID}",
        "authentication": {
          "scopes": [],
          "type": "GCP_SERVICE_ACCOUNT",
          "credentials": "${GCLOUD_KEY}"
        }
      },
      "redeploy": {
        "workflowId": "${WORKFLOW_ID}",
        "jobId": "${JOB_ID}",
        "accessToken": "${CIRCLE_CI_ACCESS_TOKEN}"
      }
    }
  ]
}
```

##### Source

`source` object contains following fields:

* `name` - Name will be used for logging purpose. E.g.: `"API Client Secret rotation"`
* `action` - Consumer app client secret will be rotated by calling the **[Clients](https://neo.thoughtworks.net/api-gateway/apis/Clients)** API provided by CDA Team. To call the API, you need to specify the `clientId`, existing `clientSecret` and the authentication `tokenUrl`  in the `authentication` object.

  * `${API_PLATFORM_URL}`:
    You can directly put the value in the configuration file or set environment variable with this name in the CircleCI. Use following values based on whether you are rotating secrets for API GW Staging or Prod:
    ```
    staging    -    https://apistg.thoughtworks.net/
    production -    https://api.thoughtworks.net/
    ```

  * `${API_PLATFORM_CLIENT_ID}`
    API Client ID. You can directly put the value in the configuration file or set environment variable in CircleCI.

  * `${API_PLATFORM_CLIENT_SECRET}`
    Existing Client Secret which will be used to generate the new secret.

  * `${API_PLATFORM_TOKEN_URL}`
     ```
    staging    -    https://thoughtworks.oktapreview.com/oauth2/auseakslniuZCJMzf0h7/v1/token
    production -    https://thoughtworks.okta.com/oauth2/aus1fjygi70z7ZtVB0h8/v1/token
    ```

##### Consumers

The `consumers` object is an array which contains the details about the systems where the rotated secrets need to be updated. In the above example, the rotated secrets will be updated in 2 places in the GCP secret manager.

###### Consumer type:  GCP_SECRET_MANAGER_CONSUMER

Refer [GCP secret manager consumer Section](#gcp-secret-manager-consumer) for updating secrets stored in GCP secret Manager.

###### Consumer type:  AWS_SECRET_MANAGER_CONSUMER

Refer [AWS secret manager consumer Section](#aws-secret-manager-consumer) for updating secrets stored in AWS secret Manager.

##### Redeploy field

Refer [Redeploy Section](#redeployment)

##### Triggering from Circle Ci

See [Automatically Triggering the Secrets Rotator Tool](#automatically-triggering-the-secrets-rotator-tool)

Please check the [API client secret rotation video](https://drive.google.com/drive/folders/1UNqQFqNh06oeugznoXlZb2ItDBnVfjJ6) for better understanding.

#### API Publisher Key

The API publisher key will be used by the backend for authentication, when a call is made to the backend from api platform. This key will be sent in the headers.

![APIPublisherKey](./images/APIPublisher.png)

The Secrets Rotator needs a config file which will contain the details necessary to rotate the API Publisher Key. It should contain a **`source`** and **`consumers`** objects. In this case, the `source` will contain information needed to generate a new API Publisher Key. The `consumers`  will be GCP secret manager, API Platform etc.

##### Sample Config- to update secrets in different secret files in secret manager.

```json
{
  "source": {
    "name": "<any name which will help to identify the source>",
    "passwordConfig": {
      "length": 24,
      "numbers": true,
      "symbols": false,
      "lowercase": true,
      "excludeSimilarCharacters": false,
      "exclude": "",
      "strict": false
    },
    "action": {
      "type": "GENERATE_PASSWORD"
    }
  },
  "consumers": [
    {
      "name": "<any name which will help to identify the consumer>",
      "action": {
        "type": "GCP_SECRET_MANAGER_CONSUMER",
        "secretName": "${GCP_SECRET_NAME}",
        "keyFieldName": "apiPlatform.apiToken",
        "isValueArray": true,
        "projectId": "${GCP_PROJECT_ID}",
        "authentication": {
          "scopes": [],
          "type": "GCP_SERVICE_ACCOUNT",
          "credentials": "${GCLOUD_KEY}"
        }
      }
    },
    {
      "name": "<any name which will help to identify the consumer>",
      "action": {
        "type": "GCP_SECRET_MANAGER_CONSUMER",
        "secretName": "${GCP_SECRET_NAME}",
        "keyFieldName": "apiPlatform.serviceToken",
        "projectId": "${GCP_PROJECT_ID}",
        "authentication": {
          "scopes": [],
          "type": "GCP_SERVICE_ACCOUNT",
          "credentials": "${GCLOUD_KEY}"
        }
      },
      "redeploy": {
        "workflowId": "${WORKFLOW_ID}",
        "jobId": "${JOB_ID}",
        "accessToken": "${CIRCLE_CI_ACCESS_TOKEN}"
      }
    },
    {
      "name": "<any name which will help to identify the consumer>",
      "action": {
        "type": "API_PLATFORM_API_SERVICE_TOKEN_CONSUMER",
        "apiName": "${API_PLATFORM_API_NAME}",
        "apiKeyHeaderName": "x-api-key",
        "apiPlatformUrl": "${API_PLATFORM_URL}",
        "authentication": {
          "clientId": "${API_PLATFORM_CLIENT_ID}",
          "clientSecret": "${API_PLATFORM_CLIENT_SECRET}",
          "tokenUrl": "${API_PLATFORM_TOKEN_URL}",
          "scope": "api",
          "grantType": "client_credentials",
          "type": "OAUTH_2"
        }
      }
    }
  ]
}
```

##### Sample Config- to update multiple fields in the same secret file in secret manager.

```json
{
  "source": {
    "name": "<any name which will help to identify the source>",
    "passwordConfig": {
      "length": 24,
      "numbers": true,
      "symbols": false,
      "lowercase": true,
      "excludeSimilarCharacters": false,
      "exclude": "",
      "strict": false
    },
    "action": {
      "type": "GENERATE_PASSWORD"
    }
  },
  "consumers": [
    {
      "name": "<any name which will help to identify the consumer>",
      "action": {
        "type": "GCP_SECRET_MANAGER_CONSUMER",
        "secretName": "${GCP_SECRET_NAME}",
        "keyFieldNames": [
          {
            "keyFieldName": "apiPlatform.apiToken",
            "isValueArray": true
          },
          {
            "keyFieldName": "apiPlatform.serviceToken"
          }
        ],
        "projectId": "${GCP_PROJECT_ID}",
        "authentication": {
          "scopes": [],
          "type": "GCP_SERVICE_ACCOUNT",
          "credentials": "${GCLOUD_KEY}"
        }
      },
      "redeploy": {
        "workflowId": "${WORKFLOW_ID}",
        "jobId": "${JOB_ID}",
        "accessToken": "${CIRCLE_CI_ACCESS_TOKEN}"
      }
    },
    {
      "name": "<any name which will help to identify the consumer>",
      "action": {
        "type": "API_PLATFORM_API_SERVICE_TOKEN_CONSUMER",
        "apiName": "${API_PLATFORM_API_NAME}",
        "apiKeyHeaderName": "x-api-key",
        "apiPlatformUrl": "${API_PLATFORM_URL}",
        "authentication": {
          "clientId": "${API_PLATFORM_CLIENT_ID}",
          "clientSecret": "${API_PLATFORM_CLIENT_SECRET}",
          "tokenUrl": "${API_PLATFORM_TOKEN_URL}",
          "scope": "api",
          "grantType": "client_credentials",
          "type": "OAUTH_2"
        }
      }
    }
  ]
}
```

##### Source

`source` object contains following fields:

* `name` - Name will be used for logging purpose. E.g.: `"Generate Password"`
* `passwordConfig`: New API publisher key will be generated using the criteria provided in this object. Please check [Password Config](#password-config)
* `action` - Contains the `type` of the source. Example source is of type `GENERATE_PASSWORD`.

##### Consumers

The `consumers` object is an array which contains the details about the systems where the new secret needs to be updated.

In the above example, the secret generated from the source will be updated in 2 places in GCP secret manager.The application will be redeployed after updating the second consumer, since it has *redeploy* field in the config.After the redeployment the same secret will be updated in the API Platform.

###### Consumer type:  GCP_SECRET_MANAGER_CONSUMER

Refer [GCP secret manager consumer Section](#gcp-secret-manager-consumer) for updating secrets stored in GCP secret Manager.

###### Consumer type:  AWS_SECRET_MANAGER_CONSUMER

Refer [AWS secret manager consumer Section](#aws-secret-manager-consumer) for updating secrets stored in AWS secret Manager.

###### Consumer type:  API_PLATFORM_API_SERVICE_TOKEN_CONSUMER

* `name` - Name will be used for logging purpose. E.g.: `"API publisher key rotation"`
* `action` - API publisher key will be rotated by calling the *publisher* API provided by CDA Team. To call the API, you need to specify the `clientId`, `clientSecret` and the authentication `tokenUrl`  in the `authentication` object.
  *apiKeyHeaderName* specifies the header name which will contain the API publisher key.


* `${API_PLATFORM_API_NAME}`
  Name of the API for which the API publisher key needs to be rotated.You can directly put the value in the configuration file or set environment variable in CircleCI.

* `${API_PLATFORM_URL}`
  You can directly put the value in the configuration file or set environment variable with this name in the CircleCI. Use following values based on whether you are rotating secrets for API GW Staging or Prod:
  ```
  staging    -    https://apistg.thoughtworks.net/
  production -    https://api.thoughtworks.net/
  ```

* `${API_PLATFORM_CLIENT_ID}`
  API Client ID. You can directly put the value in the configuration file or set environment variable in CircleCI.

* `${API_PLATFORM_CLIENT_SECRET}`
  Client Secret of the specified client id.

* `${API_PLATFORM_TOKEN_URL}`

   ```
  staging    -    https://thoughtworks.oktapreview.com/oauth2/auseakslniuZCJMzf0h7/v1/token
  production -    https://thoughtworks.okta.com/oauth2/aus1fjygi70z7ZtVB0h8/v1/token
  ```
  ###### Changes in code for Authentication
* To avoid downtime, we will be supporting two api publisher keys at a time.The api publisher keys will be an array in our secret manager. So we need to authenticate the request successfully when either one of the two keys is present in the incoming request.This requires a code change in the authentication logic.
  ```typescript
    const isApiTokenValid = () => apiPublisherKeys.includes(request.header("x-api-key"))
  ```

Please check the [API publisher key rotation video](https://drive.google.com/drive/folders/1UNqQFqNh06oeugznoXlZb2ItDBnVfjJ6) for better understanding.

##### Redeploy field

Refer [Redeploy Section](#redeployment)

#### Event Subscription Token

The Event Subscription Token will be used by the backend for authentication, when a call is made to the backend from event platform. This key will be sent in the headers.

![EventSubscriptionToken](./images/EventSubscription.png)

The Secrets Rotator needs a config file which will contain the details necessary to rotate the Event Subscription Token. It should contain a **`source`** and **`consumers`** objects. In this case, the `source` will contain information needed to generate a new Event Subscription Token. The `consumers`  will be GCP secret manager, Event Platform etc.

##### Sample Config

```json
{
  "source": {
    "name": "<any name which will help to identify the source>",
    "passwordConfig": {
      "length": 24,
      "numbers": true,
      "symbols": false,
      "lowercase": true,
      "excludeSimilarCharacters": false,
      "exclude": "",
      "strict": false
    },
    "action": {
      "type": "GENERATE_PASSWORD"
    }
  },
  "consumers": [
    {
      "name": "<any name which will help to identify the consumer>",
      "action": {
        "type": "GCP_SECRET_MANAGER_CONSUMER",
        "secretName": "${GCP_SECRET_NAME}",
        "keyFieldName": "eventSubscription.apiToken",
        "isValueArray": true,
        "projectId": "${GCP_PROJECT_ID}",
        "authentication": {
          "scopes": [],
          "type": "GCP_SERVICE_ACCOUNT",
          "credentials": "${GCLOUD_KEY}"
        }
      }
    },
    {
      "name": "<any name which will help to identify the consumer>",
      "action": {
        "type": "GCP_SECRET_MANAGER_CONSUMER",
        "secretName": "${GCP_SECRET_NAME}",
        "keyFieldName": "eventSubscription.serviceToken",
        "projectId": "${GCP_PROJECT_ID}",
        "authentication": {
          "scopes": [],
          "type": "GCP_SERVICE_ACCOUNT",
          "credentials": "${GCLOUD_KEY}"
        }
      },
      "redeploy": {
        "workflowId": "${WORKFLOW_ID}",
        "jobId": "${JOB_ID}",
        "accessToken": "${CIRCLE_CI_ACCESS_TOKEN}"
      }
    },
    {
      "name": "<any name which will help to identify the consumer>",
      "action": {
        "type": "EVENT_SUBSCRIPTION_TOKEN",
        "eventSubscriptionName": "${EVENT_SUBSCRIPTION_NAME}",
        "eventSubscriptionAuthHeaderName": "${EVENT_SUBSCRIPTION_AUTH_HEADER_NAME}",
        "apiPlatformUrl": "${API_PLATFORM_URL}",
        "authentication": {
          "clientId": "${API_PLATFORM_CLIENT_ID}",
          "clientSecret": "${API_PLATFORM_CLIENT_SECRET}",
          "tokenUrl": "${API_PLATFORM_TOKEN_URL}",
          "scope": "events.${EVENT_SUBSCRIPTION_NAME}",
          "grantType": "${API_PLATFORM_ACCESS_TOKEN_GRANT_TYPE}",
          "type": "OAUTH_2"
        }
      }
    }
  ]
}
```

##### Source

`source` object contains following fields:

* `name` - Name will be used for logging purpose. E.g.: `"Generate Password"`
* `passwordConfig`: New Event Subscription Token will be generated using the criteria provided in this object. Please check [Password Config](#password-config)
* `action` - Contains the `type` of the source. Example source is of type `GENERATE_PASSWORD`.

##### Consumers

The `consumers` object is an array which contains the details about the systems where the new secret needs to be updated.

In the above example, the secret generated from the source will be updated in 2 places in GCP secret manager.The application will be redeployed after updating the second consumer, since it has *redeploy* field in the config.After the redeployment the same secret will be updated in the Event Platform.

###### Consumer type:  GCP_SECRET_MANAGER_CONSUMER

Refer [GCP secret manager consumer Section](#gcp-secret-manager-consumer) for updating secrets stored in GCP secret Manager.

###### Consumer type:  AWS_SECRET_MANAGER_CONSUMER

Refer [AWS secret manager consumer Section](#aws-secret-manager-consumer) for updating secrets stored in AWS secret Manager.

###### Consumer type:  EVENT_SUBSCRIPTION_TOKEN

* `name` - Name will be used for logging purpose. E.g.: `"Event subscription token  rotation"`
* `action` - Event Subscription Token will be rotated by calling the *Event-Subscriber* API provided by CDA Team. To call the API, you need to specify the `clientId`, `clientSecret` and the authentication `tokenUrl`  in the `authentication` object.
  *eventSubscriptionAuthHeaderName* specifies the header name which will contain the event subscription token.


* `${API_PLATFORM_API_NAME}`
  Name of the API for which the API publisher key needs to be rotated.You can directly put the value in the configuration file or set environment variable in CircleCI.

* `${API_PLATFORM_URL}`
  You can directly put the value in the configuration file or set environment variable with this name in the CircleCI. Use following values based on whether you are rotating secrets for API GW Staging or Prod:
  ```
  staging    -    https://apistg.thoughtworks.net/
  production -    https://api.thoughtworks.net/
  ```

* `${API_PLATFORM_CLIENT_ID}`
  API Client ID. You can directly put the value in the configuration file or set environment variable in CircleCI.

* `${API_PLATFORM_CLIENT_SECRET}`
  Client Secret of the specified client id.

* `${API_PLATFORM_TOKEN_URL}`

   ```
  staging    -    https://thoughtworks.oktapreview.com/oauth2/auseakslniuZCJMzf0h7/v1/token
  production -    https://thoughtworks.okta.com/oauth2/aus1fjygi70z7ZtVB0h8/v1/token
  ```

Please check the [demo videos](https://drive.google.com/drive/folders/1UNqQFqNh06oeugznoXlZb2ItDBnVfjJ6) for better understanding. Note : Event subscription key rotation will be similar to API publisher key rotation.

#### Redeployment

The `redeploy` is an optional field which will be used to re-trigger the job which deployed your code to a particular environment. Using Redeploy mechanism, you will be able to rotate secrets without any downtime. When redeployment happens, your server will restart and will fetch the latest secrets from the GCP Secret Manager.

> Note: If you want to redeploy multiple applications sharing the same secret manager, you can also specify redeploy as an array of objects with the following properties.

It contains following fields:

* `workflowId`: workflow id of the commit which was last deployed to a particular environment.
* `jobId`: job id of the deployment job.
* `accessToken`: CircleCI access token to make api calls. These tokens are personal tokens which help to access CircleCI v2 APIs. We can generate the personal tokens from CircleCI > User settings > Personal API Tokens > Create a token.(https://app.circleci.com/settings/user/tokens)

redeploy example:

```
"redeploy":  {  
	"workflowId":  "${WORKFLOW_ID}",  
	"jobId":  "${JOB_ID}",  
	"accessToken":  "${CIRCLE_CI_ACCESS_TOKEN}" 
 }
```

redeploy as an array of objects example:

```
"redeploy": [
	{
	    "workflowId": "${WORKFLOW_ID_SERVICE_ONE}",
		"jobId": "${JOB_ID_SERVICE_ONE}",
		"accessToken": "${CIRCLE_CI_ACCESS_TOKEN}"
	},
	{
		"workflowId": "${WORKFLOW_ID_SERVICE_TWO}",
		"jobId": "${JOB_ID_SERVICE_TWO}",
		"accessToken": "${CIRCLE_CI_ACCESS_TOKEN}"
	}
]
```

We can re-trigger a job with CircleCI's API given the workflow id & job id. We can store workflow id & job id of the last deployed commit as an environment variable and use it to re-trigger that job. We can add a additional step in the deploy job to store the variables. we can store the variables either as a project environment variables or context variables.

##### As a Context variable:

* Create a context in CircleCI for each environment or can use the existing one.
* Create an environment variable `CONTEXT_ID` within the context and store the value of context id.(When we navigate to the context page, the context id can be obtained from the url)
* In the CircleCI Job which deploys your commit to a particular environment, add additional step to store workflow id and job id after the deployment is completed.

```bash
function store_job_details_as_env()
{
   echo "Storing workflow and job id as env"
   curl --request PUT \
     --url https://circleci.com/api/v2/context/${CONTEXT_ID}/environment-variable/WORKFLOW_ID \
     --header "Circle-Token: ${CIRCLE_CI_TOKEN}" \
     --header 'content-type: application/json' \
     --data '{"value":"'${CIRCLE_WORKFLOW_ID}'"}'

    curl --request PUT \
     --url https://circleci.com/api/v2/context/${CONTEXT_ID}/environment-variable/JOB_ID \
     --header "Circle-Token: ${CIRCLE_CI_TOKEN}" \
     --header 'content-type: application/json' \
     --data '{"value":"'${CIRCLE_WORKFLOW_JOB_ID}'"}'
}

store_job_details_as_env
```

#### As a project environment variable:

* Add an additional step in the deploy job to store workflow id and job id.
* Store the project slug and CircleCI token as env variables this will be used in CircleCI apis while creating project variables.

```bash
function create_env_workflow_id()
{
   echo "Storing WorkflowId"
   curl --request POST \
     --url https://circleci.com/api/v2/project/${PROJECT_SLUG}/envvar \
     --header "Circle-Token: ${CIRCLE_CI_TOKEN}" \
     --header 'content-type: application/json' \
     --data '{"name":"'$WORK_FLOW_ID_ENV_NAME'","value":"'${CIRCLE_WORKFLOW_ID}'"}'
}
function create_env_job_id()
{
   echo "Storing JobId"
   curl --request POST \
     --url https://circleci.com/api/v2/project/${PROJECT_SLUG}/envvar \
     --header "Circle-Token: ${CIRCLE_CI_TOKEN}" \
     --header 'content-type: application/json' \
     --data '{"name":"'$JOB_ID_ENV_NAME'","value":"'${CIRCLE_WORKFLOW_JOB_ID}'"}'
}

create_env_workflow_id
create_env_job_id
```

Please check [here](https://drive.google.com/drive/folders/1UNqQFqNh06oeugznoXlZb2ItDBnVfjJ6) to see the video on no down-time secret rotation.

### GCP SQL DB password

You can rotate GCP Cloud SQL for PostgreSQL user password and update the new password in GCP Secret manager, using following configuration:

```json
{
  "source": {
    "name": "${SOURCE_NAME}",
    "passwordConfig": {
      "length": 24,
      "numbers": true,
      "symbols": false,
      "lowercase": true,
      "excludeSimilarCharacters": false,
      "exclude": "",
      "strict": false
    },
    "action": {
      "type": "GCP_POSTGRES_DATABASE_SOURCE",
      "projectId": "${GCP_PROJECT_ID}",
      "userName": "${DB_USERNAME}",
      "instanceName": "${DB_INSTANCE_NAME_FOR_SECRET_ROTATION}",
      "authentication": {
        "type": "GCP_SERVICE_ACCOUNT",
        "scopes": [
          "https://www.googleapis.com/auth/cloud-platform",
          "https://www.googleapis.com/auth/sqlservice.admin"
        ],
        "credentials": "${GCLOUD_KEY}"
      }
    }
  },
  "consumers": [
    {
      "name": "Test Secret Manager 1",
      "action": {
        "type": "GCP_SECRET_MANAGER_CONSUMER",
        "secretName": "${GCP_SECRET_NAME1}",
        "keyFieldName": "deployment.dbPassword",
        "projectId": "${GCP_PROJECT_ID}",
        "authentication": {
          "type": "GCP_SERVICE_ACCOUNT",
          "scopes": [],
          "credentials": "${GCLOUD_KEY}"
        }
      },
      "redeploy": {
        "workflowId": "${WORKFLOW_ID}",
        "jobId": "${JOB_ID}",
        "accessToken": "${CIRCLE_CI_ACCESS_TOKEN}"
      }
    },
    {
      "name": "Test Secret Manager 2",
      "action": {
        "type": "GCP_SECRET_MANAGER_CONSUMER",
        "secretName": "${GCP_SECRET_NAME2}",
        "keyFieldName": "runtime.dbPassword",
        "projectId": "${GCP_PROJECT_ID}",
        "authentication": {
          "scopes": [],
          "type": "GCP_SERVICE_ACCOUNT",
          "credentials": "${GCLOUD_KEY}"
        }
      },
      "redeploy": {
        "workflowId": "${WORKFLOW_ID}",
        "jobId": "${JOB_ID}",
        "accessToken": "${CIRCLE_CI_ACCESS_TOKEN}"
      }
    }
  ]
}
```

The configuration file will contain following fields:

* `source`: contains information about rotating the password. It has the following fields:

  * `name`: any text which will be used for logging purpose. E.g.: `"PostgreSQL User Password Rotation"`

  * [`passwordConfig`](#password-config): new password will be generated using the criteria provided in this object. E.g. the password must be 24 characters long, and it should include numbers but not symbols, etc.

  * `action`: provides information about secret to be rotated. It should contain:
    * `projectId`: GCP Project ID. you can either hardcode it into the configuration file or put it in CircleCI environment variable.
    * `userName`: GCP Cloud SQL DB username whose password will be rotated.
    * `instanceName`: GCP DB Instance name. You can find it from your GCP Cloud Console https://console.cloud.google.com/sql/instances
    * authentication - The authentication field is optional. The service account key details can be either mentioned in the credentials field as below or the service account key can be exported as **GOOGLE_APPLICATION_CREDENTIALS**(recommended).

 ```
    authentication: {
     scopes:  [
          "https://www.googleapis.com/auth/cloud-platform",
          "https://www.googleapis.com/auth/sqlservice.admin"
        ],
     type: "GCP_SERVICE_ACCOUNT",
     credentials: "${GCLOUD_KEY}"
    }
```

${GCLOUD_KEY} - This will be used for authentication. It should be Base64 encoded GCP Service Account's private key of type JSON which contains `client_email` and `private_key` fields. Refer [Steps to generate GCLOUD key](#steps-to-generate-gcloud-key). This encoded key should be stored in `GCLOUD_KEY` variable in CircleCI. Contact Digital Innovation Labs team if you have any queries.

* `consumers`: contains the details about the systems where the rotated secrets need to be updated. In the above example, the rotated secrets will be updated in 2 secrets in GCP Secret Manager.

  ###### Consumer type:  GCP_SECRET_MANAGER_CONSUMER

  Refer [GCP secret manager consumer Section](#gcp-secret-manager-consumer) for updating secrets stored in GCP secret Manager.

##### Redeploy field

Refer [Redeploy Section](#redeployment)

> NOTE: For authenticating DB using IAM authentication you can refer to [IAM DB Authentication](https://github.com/Digital-Innovation-Labs/secrets-rotator/tree/main/docs/db-authentication)

### GCP Service Account Key

You are most probably using GCP Service Account in CircleCI to deploy your server in GCP AppEngine or CloudRun. You can rotate GCP Service Account Key and update the new key in CircleCI environment variable, using following configuration:

```json
{
  "source": {
    "name": "<any name e.g. Service Account Key Rotation>",
    "action": {
      "type": "GCP_SERVICE_ACCOUNT_KEY_SOURCE",
      "projectId": "${GCP_PROJECT_ID}",
      "authentication": {
        "type": "GCP_SERVICE_ACCOUNT",
        "scopes": [
          "https://www.googleapis.com/auth/cloud-platform"
        ],
        "credentials": "${GCLOUD_KEY}"
      },
      "serviceAccountName": "${GCP_CIRCLECI_SERVICE_ACCOUNT}"
    }
  },
  "consumers": [
    {
      "name": "<any name e.g. CircleCI>",
      "action": {
        "type": "API_CONSUMER",
        "url": "https://circleci.com/api/v2/context/${CIRCLECI_CONTEXT_ID}/environment-variable/<environment variable name, e.g. GCLOUD_KEY>",
        "method": "PUT",
        "body": {
          "value": "${{SECRET_VALUE}}"
        },
        "authentication": {
          "type": "BASIC",
          "userName": "${CIRCLECI_API_TOKEN}",
          "password": ""
        }
      }
    }
  ]
}
```

The configuration file will contain following fields:

* `source`: contains information about rotating the password. It has the following fields:

  * `projectId`: GCP Project ID. You can either hardcode it in the config file or put it in CircleCI environment variable.

  * `credentials`: existing GCP Service Account Key which will be used to generate a new one.

  * `serviceAccountName`: Name of the GCP Service Account, you can find it here https://console.cloud.google.com/iam-admin/serviceaccounts


* `consumers`: contains the details about the systems where the rotated secrets need to be updated. In the above example, the rotated secrets in CircleCI environment variable `GCLOUD_KEY`.

  * `name`: name will be used for logging purpose.

  * `action`: contains details about the consumers' and the authentication. You should provide:
    * `CIRCLECI_CONTEXT_ID`: the CircleCI context id where the environment variable will be stored. You can get it from CircleCI App > Organization Settings > Contexts > Select the correct context.
    * `CIRCLECI_API_TOKEN`: Personal token to access CircleCI API. You can generate it from CircleCI > User settings > Personal API Tokens > Create a token. https://app.circleci.com/settings/user/tokens

### Static Token

If you have a static token which you use for session or authentication in the backend, you can rotate it using following configuration and update it in the GCP Secret Manager:

```json
{
  "source": {
    "name": "<any name for logging, e.g. Static Token Rotation",
    "passwordConfig": {
      "length": 24,
      "numbers": true,
      "symbols": false,
      "lowercase": true,
      "excludeSimilarCharacters": false,
      "exclude": "",
      "strict": false
    },
    "action": {
      "type": "GCP_SECRET_MANAGER_SOURCE",
      "secretName": "${GCP_SECRET_NAME}",
      "keyFieldName": "runtime.session.secret this is optional",
      "projectId": "${GCP_PROJECT_ID}",
      "authentication": {
        "type": "GCP_SERVICE_ACCOUNT",
        "scopes": [],
        "credentials": "${GCLOUD_KEY}"
      }
    }
  },
  "consumers": []
}
```

The configuration file will contain following fields:

#### GCP SECRET MANAGER SOURCE

* `source`: contains information about rotating the static token. It has the following fields:

  * `name`: any text which will be used for logging purpose.

  * [`passwordConfig`](#password-config): new token will be generated using the criteria provided in this object. E.g. the password must be 24 characters long, and it should include numbers but not symbols, etc.
  * `action` - contains details about updating the new token in GCP Secret Manager and the authentication.
  * If secrets are stored in different secret files in JSON format in the secret manager, the field which needs to be updated can be specified in the **`keyFieldName`**   .If the secrets are stored as plain text, then the  **`keyFieldName`** field itself is not required in the config. When the secret needs to be updated in an array, `isValueArray` can be specified as true in the config. Both *`keyFieldName`* and *`isValueArray`* are optional fields.

  * If secrets are stored in the same secret file in JSON format in secret manager, all the fields which needs to be updated can be specified in the **`KeyFieldNames`**(optional field not required if secret is plain text) as an array of objects with properties *`keyFieldName`* and *`isValueArray`* (optional property if the specified keyFieldName value is an array this field can be set to true) .

    The GCP `projectId`, `secretName` and the `authentication` information needs to be provided in the config:

    * `${GCP_SECRET_NAME}` - Name of the secret in the GCP Secret Manager
    * `${GCP_PROJECT_ID}` - GCP project Id
    * authentication - The authentication field is optional. The service account key details can be either mentioned in the credentials field as below or the service account key can be exported as **GOOGLE_APPLICATION_CREDENTIALS**(recommended).

 ```
    authentication: {
     scopes: [],
     type: "GCP_SERVICE_ACCOUNT",
     credentials: "${GCLOUD_KEY}"
    }
```

${GCLOUD_KEY} - This will be used for authentication. It should be Base64 encoded GCP Service Account's private key of type JSON which contains `client_email` and `private_key` fields. Refer [Steps to generate GCLOUD key](#steps-to-generate-gcloud-key). This encoded key should be stored in `GCLOUD_KEY` variable in CircleCI. Contact Digital Innovation Labs team if you have any queries.


> Note: If you are using OIDC authentication then the authentication field itself is not required. Refer this [link](https://github.com/Digital-Innovation-Labs/circleci-oidc-auth-setup/tree/main#setup-for-gcp) to understand how to set up OIDC authentication in GCP.

#### AWS SECRET MANAGER SOURCE

```json
{
  "source": {
    "name": "<any name for logging, e.g. Static Token Rotation",
    "passwordConfig": {
      "length": 24,
      "numbers": true,
      "symbols": false,
      "lowercase": true,
      "excludeSimilarCharacters": false,
      "exclude": "",
      "strict": false
    },
    "action": {
      "type": "AWS_SECRET_MANAGER_SOURCE",
      "secretId": "<secret name or secret arn>",
      "keyFieldName": "runtime.secret",
      "region": "us-east-2",
      "authentication": {
        "type": "AWS_ACCOUNT",
        "credentials": {
          "accessKeyId": "${AWS_ACCESS_KEY_ID}",
          "secretAccessKey": "${AWS_SECRET_ACCESS_KEY}",
          "sessionToken": "${AWS_SESSION_TOKEN}"
        }
      }
    }
  },
  "consumers": []
}
```

* `source`: contains information about rotating the static token. It has the following fields:

  * `name`: any text which will be used for logging purpose.

  * [`passwordConfig`](#password-config): new token will be generated using the criteria provided in this object. E.g. the password must be 24 characters long, and it should include numbers but not symbols, etc.
  * `action` - contains details about updating the new token in AWS Secret Manager and the authentication.
  * If secrets are stored in different secret files in JSON format in the secret manager, the field which needs to be updated can be specified in the **`keyFieldName`**   .If the secrets are stored as plain text, then the  **`keyFieldName`** field itself is not required in the config. When the secret needs to be updated in an array, `isValueArray` can be specified as true in the config. Both *`keyFieldName`* and *`isValueArray`* are optional fields.

  * If secrets are stored in the same secret file in JSON format in secret manager, all the fields which needs to be updated can be specified in the **`KeyFieldNames`**(optional field not required if secret is plain text) as an array of objects with properties *`keyFieldName`* and *`isValueArray`* (optional property if the specified keyFieldName value is an array this field can be set to true) .
  * The `secretId`, `region` and the `authentication` information needs to be provided in the config.
    * `${AWS_REGION}` - Region of secret stored in AWS secret Manager
  * authentication - The authentication field is optional. AWS credentials should be mentioned in the credentials field as below.

 ```
    authentication: {
     type: "AWS_ACCOUNT",
     credentials: {
      accessKeyId: "${ACCESS_KEY_ID}",
      secretAccessKey: "${SECRET_ACCESS_KEY}",
      sessionToken: "${SESSION_TOKEN}",
    }
   }
```

> Note: If you are using OIDC authentication then the authentication field itself is not required. Refer this [link](https://github.com/Digital-Innovation-Labs/circleci-oidc-auth-setup/tree/main#setup-for-aws) to understand how to set up OIDC authentication in AWS.

### Update secrets stored in GCP/AWS secret manager

In most of the projects, the secrets are managed in GCP or AWS secret managers. Secrets like API client secret, API publisher key, Event subscription token, DB password etc. are stored in secret manager and are used by the applications for authentication. Once after rotating these secrets in the source, the same secret value needs to be updated in the respective secret manager. For rotating the above mentioned secrets, we need a config file with source and consumer details. please find below the sample consumer configs for updating secrets in GCP/AWS secret managers :

* [GCP secret manager consumer](#gcp-secret-manager-consumer)
* [AWS secret manger consumer](#aws-secret-manager-consumer)

#### GCP Secret manager consumer

##### Sample consumer Config

```json
{
  "consumers": [
    {
      "name": "Test Secret Manager 1",
      "action": {
        "type": "GCP_SECRET_MANAGER_CONSUMER",
        "secretName": "${GCP_SECRET_NAME1}",
        "keyFieldName": "deployment.dbPassword",
        "projectId": "${GCP_PROJECT_ID}",
        "authentication": {
          "type": "GCP_SERVICE_ACCOUNT",
          "scopes": [],
          "credentials": "${GCLOUD_KEY}"
        }
      }
    }
  ]
}
```

* `name` - Name will be used for logging purpose, E.g.: GCP Secret Manager
* `redeploy` - This will be an optional parameter. Whenever a redeployment is needed after updating the secret, *redeploy* field can be specified in the particular consumer object.Refer [Redeploy Section](#redeployment).
* `action` - Contains details about the consumers' and the authentication.
  * If secrets are stored in different secret files in JSON format in the secret manager, the field which needs to be updated can be specified in the **`keyFieldName`**   .If the secrets are stored as plain text, then the  **`keyFieldName`** field itself is not required in the config. When the secret needs to be updated in an array, `isValueArray` can be specified as true in the config. Both *`keyFieldName`* and *`isValueArray`* are optional fields.

  * If secrets are stored in the same secret file in JSON format in secret manager, all the fields which needs to be updated can be specified in the **`KeyFieldNames`**(optional field not required if secret is plain text) as an array of objects with properties *`keyFieldName`* and *`isValueArray`* (optional property if the specified keyFieldName value is an array this field can be set to true) .

The GCP `projectId`, `secretName` and the `authentication` information needs to be provided in the config:

* `${GCP_SECRET_NAME}` - Name of the secret in the GCP Secret Manager
* `${GCP_PROJECT_ID}` - GCP project Id
* authentication - The authentication field is optional. The service account key details can be either mentioned in the credentials field as below or the service account key can be exported as **GOOGLE_APPLICATION_CREDENTIALS**(recommended).

 ```
    authentication: {
     scopes: [],
     type: "GCP_SERVICE_ACCOUNT",
     credentials: "${GCLOUD_KEY}"
    }
```

${GCLOUD_KEY} - This will be used for authentication. It should be Base64 encoded GCP Service Account's private key of type JSON which contains `client_email` and `private_key` fields. Refer [Steps to generate GCLOUD key](#steps-to-generate-gcloud-key). This encoded key should be stored in `GCLOUD_KEY` variable in CircleCI. Contact Digital Innovation Labs team if you have any queries.


> Note: If you are using OIDC authentication then the authentication field itself is not required. Refer this [link](https://github.com/Digital-Innovation-Labs/circleci-oidc-auth-setup/tree/main#setup-for-gcp) to understand how to set up OIDC authentication in GCP.

#### AWS Secret Manager Consumer

##### Sample consumer Config

```json
{
  "consumers": [
    {
      "name": "<any name which will help to identify the consumer>",
      "action": {
        "type": "AWS_SECRET_MANAGER_CONSUMER",
        "secretId": "<secret name or secret arn>",
        "keyFieldName": "apiPlatform.clientSecret",
        "isValueArray": true,
        "region": "${AWS_REGION}",
        "authentication": {
          "type": "AWS_ACCOUNT",
          "credentials": {
            "accessKeyId": "${AWS_ACCESS_KEY_ID}",
            "secretAccessKey": "${AWS_SECRET_ACCESS_KEY}",
            "sessionToken": "${AWS_SESSION_TOKEN}"
          }
        }
      }
    }
  ]
}
```

The `consumers` object is an array which contains the details about the systems where the rotated secret need to be updated. In the above example, the rotated secrets will be updated in AWS secret manager.

* `name` - Name will be used for logging purpose, E.g.: AWS Secret Manager.

* `redeploy` - This will be an optional parameter. Whenever a redeployment is needed after updating the secret, *redeploy* field can be specified in the particular consumer object.Refer [Redeploy Section](#redeployment).
* `action` - Contains details about the consumers' and the authentication.
  * If secrets are stored in different secret files in JSON format in the secret manager, the field which needs to be updated can be specified in the **`keyFieldName`**   .If the secrets are stored as plain text, then the  **`keyFieldName`** field itself is not required in the config. When the secret needs to be updated in an array, `isValueArray` can be specified as true in the config. Both *`keyFieldName`* and *`isValueArray`* are optional fields.

  * If secrets are stored in the same secret file in JSON format in secret manager, all the fields which needs to be updated can be specified in the **`KeyFieldNames`**(optional field not required if secret is plain text) as an array of objects with properties *`keyFieldName`* and *`isValueArray`* (optional property if the specified keyFieldName value is an array this field can be set to true) . The `secretId`, `region` and the `authentication` information needs to be provided in the config.
  * `${AWS_REGION}` - Region of secret stored in AWS secret Manager
  * authentication - The authentication field is optional. AWS credentials should be mentioned in the credentials field as below.

 ```
    authentication: {
     type: "AWS_ACCOUNT",
     credentials: {
      accessKeyId: "${ACCESS_KEY_ID}",
      secretAccessKey: "${SECRET_ACCESS_KEY}",
      sessionToken: "${SESSION_TOKEN}",
    }
   }
```

> Note: If you are using OIDC authentication then the authentication field itself is not required. Refer this [link](https://github.com/Digital-Innovation-Labs/circleci-oidc-auth-setup/tree/main#setup-for-aws) to understand how to set up OIDC authentication in AWS.

### AWS Gateway API key

When an API is deployed in AWS gateway, the gateway uses api keys to authenticate the request. This api keys needs to be rotated periodically.

To avoid downtime during the key rotation, we will be supporting two api keys at a time. The latest api key needs to be used by the services which accesses the API. During the next key rotation, the oldest key will be deleted and a new api key will be created and the same will be added to the usage plan. Going forward, this new key should be used by the services.

**NOTE: Assumption is that currently, an API in aws gateway will have only one api key for each environment**

AWS Gateway API key rotation can be done in 2 ways:

* When we want the new api key value to be autogenerated by AWS Gateway, then api key rotation config can be specified as source object with type AWS_GATEWAY_API_KEY_SOURCE.
* When we want automated secrets rotator tool to generate the new api key value based on the password config provided by us, then use the api key rotation config in the consumer object with type AWS_GATEWAY_API_KEY_CONSUMER.

Please find below the sample config for rotating the api key in aws gateway.

#### AWS API Key rotation with AWS Gateway autogenerated key:

```json
{
  "source": {
    "name": "API Gateway API key",
    "action": {
      "type": "AWS_GATEWAY_API_KEY_SOURCE",
      "usagePlanId": "${USAGE_PLAN_ID}",
      "region": "${REGION}",
      "authentication": {
        "type": "AWS_ACCOUNT",
        "credentials": {
          "accessKeyId": "${AWS_ACCESS_KEY_ID}",
          "secretAccessKey": "${AWS_SECRET_ACCESS_KEY}",
          "sessionToken": "${AWS_SESSION_TOKEN}"
        }
      }
    }
  },
  "consumers": [
    {
      "name": "API Platform service token",
      "action": {
        "type": "API_PLATFORM_API_SERVICE_TOKEN_CONSUMER",
        "apiName": "${API_PLATFORM_API_NAME}",
        "apiKeyHeaderName": "x-api-key",
        "apiPlatformUrl": "${API_PLATFORM_URL}",
        "authentication": {
          "clientId": "${API_PLATFORM_CLIENT_ID}",
          "clientSecret": "${API_PLATFORM_CLIENT_SECRET}",
          "tokenUrl": "${API_PLATFORM_TOKEN_URL}",
          "scope": "${API_PLATFORM_ACCESS_TOKEN_SCOPE}",
          "grantType": "${API_PLATFORM_ACCESS_TOKEN_GRANT_TYPE}",
          "type": "OAUTH_2"
        }
      }
    }
  ]
}
```

The mentioned config has a source object and a consumer object. The source object will rotate the api key in aws gateway. The new api key will be autogenerated by the aws gateway. So this newly generated key will be used to update the consumers. In the above sample the new key will be updated in the API platform.

##### Source

`source`  object contains following fields:

- `name`  - Name will be used for logging purpose. E.g.:  `"API Gateway API key"`
- `action` - The `type`, `usagePlanId`, `region` and `authentication` information needs to be provided in the config.

`usagePlanId`    - Usage plan id of the AWS gateway for which the api keys needs to be rotated.

`region`         - Region of the API in the AWS Gateway.

`authentication` - The authentication field is optional. Credentials to connect to the AWS account should be mentioned here.

```
   authentication: {
    type: "AWS_ACCOUNT",
    credentials: {
     accessKeyId: "${ACCESS_KEY_ID}",
     secretAccessKey: "${SECRET_ACCESS_KEY}",
     sessionToken: "${SESSION_TOKEN}",
   }
  }

```

> Note: If you are using OIDC authentication then the authentication field itself is not required. Refer this [link](https://github.com/Digital-Innovation-Labs/circleci-oidc-auth-setup/tree/main#setup-for-aws) to understand how to set up OIDC authentication in AWS.

##### Consumers

Every consumer will have a `name` and `action` fields.

###### Consumer type: [API_PLATFORM_API_SERVICE_TOKEN_CONSUMER](#consumer-type--api_platform_api_service_token_consumer)

#### AWS API Key rotation based on the password config provided:

```json
{
  "source": {
    "name": "Generate Password",
    "passwordConfig": {
      "length": 30,
      "numbers": true,
      "symbols": false,
      "lowercase": true,
      "excludeSimilarCharacters": false,
      "exclude": "",
      "strict": false
    },
    "action": {
      "type": "GENERATE_PASSWORD"
    }
  },
  "consumers": [
    {
      "name": "AWS Gateway API key",
      "action": {
        "type": "AWS_GATEWAY_API_KEY_CONSUMER",
        "usagePlanId": "${USAGE_PLAN_ID}",
        "region": "${AWS_REGION}",
        "authentication": {
          "type": "AWS_ACCOUNT",
          "credentials": {
            "accessKeyId": "${AWS_ACCESS_KEY_ID}",
            "secretAccessKey": "${AWS_SECRET_ACCESS_KEY}",
            "sessionToken": "${AWS_SESSION_TOKEN}"
          }
        }
      }
    },
    {
      "name": "API Platform service token",
      "action": {
        "type": "API_PLATFORM_API_SERVICE_TOKEN_CONSUMER",
        "apiName": "${API_PLATFORM_API_NAME}",
        "apiKeyHeaderName": "x-api-key",
        "apiPlatformUrl": "${API_PLATFORM_URL}",
        "authentication": {
          "clientId": "${API_PLATFORM_CLIENT_ID}",
          "clientSecret": "${API_PLATFORM_CLIENT_SECRET}",
          "tokenUrl": "${API_PLATFORM_TOKEN_URL}",
          "scope": "${API_PLATFORM_ACCESS_TOKEN_SCOPE}",
          "grantType": "${API_PLATFORM_ACCESS_TOKEN_GRANT_TYPE}",
          "type": "OAUTH_2"
        }
      }
    }
  ]
}
```

The mentioned config has a source object and two consumer objects.Secrets rotator will use this source config to generate a password based on the configuration provided by us and update the same in the consumers. Here the first consumer contains details necessary to update the AWS gateway api key and the second with details to update the api publisher key in API platform.

##### Source

`source`  object contains following fields:

- `name`  - Name will be used for logging purpose. E.g.:  `"Generate Password"`
- `passwordConfig`: New API key value will be generated using the criteria provided in this object. Please check  [Password Config](https://stackedit.io/app#password-config)
- `action`  - Contains the  `type`  of the source. Example source is of type  `GENERATE_PASSWORD`.

##### Consumers

Every consumer will have a `name` and `action` fields.

- `name`  - This field can contain any meaningful string which will help us to identify the secret we are rotating. This will be used for logging purpose. E.g.: AWS Gateway API key.

- `action`  - This information will be specific to the type of consumer and also the authentication information which is needed to establish a connection with the consumer.

###### Consumer type: AWS_GATEWAY_API_KEY_CONSUMER

The `type`, `usagePlanId`, `region` and `authentication` information needs to be provided in the config.

`usagePlanId`    - Usage plan id of the AWS gateway for which the api keys needs to be rotated.

`region`         - Region of the API in the AWS Gateway.

`authentication` - The authentication field is optional. Credentials to connect to the AWS account should be mentioned here.

```
   authentication: {
    type: "AWS_ACCOUNT",
    credentials: {
     accessKeyId: "${ACCESS_KEY_ID}",
     secretAccessKey: "${SECRET_ACCESS_KEY}",
     sessionToken: "${SESSION_TOKEN}",
   }
  }

```

> Note: If you are using OIDC authentication then the authentication field itself is not required. Refer this [link](https://github.com/Digital-Innovation-Labs/circleci-oidc-auth-setup/tree/main#setup-for-aws) to understand how to set up OIDC authentication in AWS.

###### Consumer type: [API_PLATFORM_API_SERVICE_TOKEN_CONSUMER](#consumer-type--api_platform_api_service_token_consumer)

## Installation

We recommend to use the Secrets Rotator tool from [CircleCI](#accessing-through-circleci). Please get in touch with Digital Innovations Lab team for any clarifications.

### Accessing through CircleCI

Generate the Deployment keys for GitHub using the below steps (same can be found here: https://circleci.com/docs/github-integration/#deployment-keys-and-user-keys):

* Create the SSH key by running the following command in the terminal
  ```
  ssh-keygen -t ed25519 -C "your_email@example.com"
  ```
* Add the private key to the CircleCI project settings (Open CircleCI web app > Projects > Select 3 dots next to your project > Project Settings > SSH Keys)
* Add the fingerprint generated in the above step, to the job in CircleCI config.yaml in your project
  ```yaml
  version: 2.1
  jobs:
    rotate-secrets:
      steps:
        - add_ssh_keys:
            fingerprints:
              - "SO:ME:FIN:G:ER:PR:IN:T"
  ```
* After adding the private key, share the public key to Digital Innovations Lab team. The public key will be stored in *.pub file.
* Then you can clone the repository using
  ```bash
  git clone --depth 1 --branch <use latest version*> git@github.com:Digital-Innovation-Labs/secrets-rotator.git
  cd secrets-rotator
  yarn install
  yarn start rotate -c <path to config.json>
  yarn start decrypt -r <path to report.encrypted>
  ``` 
  Or if you use Node Tech Stack, you can add it as a dependency:
  ```bash
  yarn add git+ssh://git@github.com:Digital-Innovation-Labs/secrets-rotator.git#<use latest version*>
  yarn secrets-rotator rotate -c <path to config.json>
  yarn secrets-rotator decrypt -r <path to report.encrypted>
  ``` 

> \* Use the latest version which can be found at https://neo.thoughtworks.net/catalogue/developer-tools/UtxWTI2WoQ/Automated_Secrets_Rotator. eg `v2.0.1-2023`.

**NOTE: Add a file .yarnrc with below command to avoid concurrency issue while adding the secrets rotator as a dependency.**

```network-concurrency 1```

See [Commands](#commands) for rotating the secrets.

### Download from NEO Portal

The secrets rotator tool can be downloaded from the <a href="https://neo.thoughtworks.net/catalogue/developer-tools/UtxWTI2WoQ/Secrets_rotator" target="_blank">Developer Tools</a> section in NEO Portal.

Use this method to test our the tool in your local.

```bash
yarn install
yarn start rotate -c <path to config.json>
yarn start decrypt -r <path to report.encrypted>
```

See [Commands](#commands) for rotating the secrets.

## Commands

### Rotate secrets:

Rotating the secrets will create a file named `report.encrypted` for storing the logs generated during secrets rotation. You need to export the below environment variable, as this will be used to encrypt the file `report.encrypted`. It can be any random text:

```bash
export HASH_KEY=<random value>
```

**Note:** If the `HASH_KEY` is rotated or changed, we will no longer be able to decrypt `report.encrypted` which is encrypted with previous versions of `HASH_KEY`

Then you can run following command to rotate secrets:

```bash 
# if you added as dependency in Node project:
yarn secrets-rotator rotate -c <path to config.json>
# OR if you cloned the repo:
yarn start rotate -c <path to config.json>
``` 

You can store the `config.json` file in your GitHub project whose secrets need to be rotated. Contact Digital Innovations Lab team for more clarifications.

### Decrypt the report file

In order to decrypt `report.encrypted` file, run:

```bash 
# if you added secrets-rotator as dependency in Node project:
yarn secrets-rotator decrypt -r <path to report.encrypted>
# OR if you cloned the repo:
yarn start decrypt -r <path to report.encrypted>
```

New decrypted file `report.txt` will be generated which will contain the new secrets and logs.

> Note: Decrypt command uses same `HASH_KEY` environment variable for decryption.

### Validate secrets rotator configuration file

In order to validate secrets rotator config file, run:

```bash 
# if you added secrets-rotator as dependency in Node project:
yarn secrets-rotator validate-schema -c <path to config file>
# OR if you cloned the repo:
yarn start validate-schema -c <path to config file>
```

> Note: if config files have environment variables make sure you have exported/substituted those variables before running the validate-schema command.

## Triggering Secrets Rotator Tool

In this section, we will see how to trigger and run the Secrets Rotator Tool in CircleCI. You can either trigger the Workflow manually or automatically.

We recommend to use automatic trigger for CDA related secrets (API Client Secret Rotation, API Publisher Key Rotation, Events Subscription Token Rotation). This will allow you to rotate the secrets without any manual intervention and zero downtime. It is not recommended to use automatic trigger for rotating GCP SQL DB password as it involves downtime for now.

### Automatically Triggering the Secrets Rotator Tool

You can automatically trigger the secrets rotator tool at the specified time/interval using CircleCI's scheduled workflows feature.
https://circleci.com/docs/workflows/#scheduling-a-workflow

Sample CircleCI config yaml file:

```yaml
jobs:
  rotate-client-secrets-staging:
    machine:
      image: ubuntu-2004:202010-01
    steps:
      - checkout
      - run:
          name: "install secrets rotator"
          command: "<check Installation section>"
      - run:
          name: "rotate-client-secrets-staging"
          command: "<check Commands section>"

Workflows:
  rotate-client-secret-workflow-staging:
    triggers:
      - schedule:
          cron: "0 10 2 * *"   # This will run once a month, on the second day of the month at 10AM UTC
          filters:
            branches:
              only:
                - main
    jobs:
      - rotate-client-secrets-staging
```

The above configuration contains a workflow which will get auto triggered based on the provided cron expression. Refer https://medium.com/@ashishb21/how-to-run-cron-jobs-and-schedule-it-d7c417e9c35e
and https://www.unix.com/man-page/POSIX/1posix/crontab/ for cron expressions.

After the workflow is triggered it will run `rotate-client-secrets-staging` job and rotate the secrets for staging environment. Please check [Installation](#installation) and [Commands](#commands) for how to install and run the Secrets Rotator tool.

Similarly, please create multiple workflows for different secrets for different environments.

### Manually Triggering the Secrets Rotator Tool

You can manually trigger a workflow in CircleCI using the following sample CircleCI config file:

```yaml
jobs:
  rotate-db-user-password-staging:
    machine:
      image: ubuntu-2004:202010-01
    steps:
      - checkout
      - run:
          name: "install secrets rotator"
          command: "<check Installation section>"
      - run:
          name: "rotate-db-user-password-staging"
          command: "<check Commands section>"

workflows:
  rotate-db-user-password-workflow-staging:
    jobs:
      - hold-rotate-db-user-password-staging:
          type: approval
      - rotate-db-user-password-staging:
    requires:
      - hold-rotate-db-user-password-staging
```

In this configuration, the `rotate-db-user-password-staging` will run only after someone approves `hold-rotate-db-user-password-staging` job.

Please check [Installation](#installation) and [Commands](#commands) for how to install and run the Secrets Rotator tool.

Similarly, please create multiple workflows for different secrets for different environments.

Please check [here](https://drive.google.com/drive/folders/1UNqQFqNh06oeugznoXlZb2ItDBnVfjJ6) for the video on how to configure the automated secrets rotator in CircleCI.

## Password Config

The secrets rotator can generate password based on the config and use the same to rotate the secrets. The password config needs to be mentioned in the source object of the JSON config.

| Name                     | Description                                                           | Default Value |
|--------------------------|-----------------------------------------------------------------------|---------------|
| length                   | Integer, length of password.                                          | 30   (As per AppSec guidelines)         |
| numbers*                 | Boolean, put numbers in password.                                     | false         |
| symbols*                 | Boolean or String, put symbols in password.                           | false         |
| lowercase*               | Boolean, put lowercase in password                                    | true          |
| uppercase*               | Boolean, use uppercase letters in password.                           | true          |
| excludeSimilarCharacters | Boolean, exclude similar chars, like 'i' and 'l'.                     | false         |
| exclude                  | String, characters to be excluded from password.                      | ''            |
| strict                   | Boolean, password must include at least one character from each pool. | false         |

*At least one should be true.

#### Sample config

```
{
  "source": {
    "name": "${SOURCE_NAME}",
    "passwordConfig": {
      "length": 30,
      "numbers": true,
      "symbols": false,
      "lowercase": true,
      "excludeSimilarCharacters": false,
      "exclude": "",
      "strict": false
    },
    "action": {
      "type": "API_PLATFORM_API_SERVICE_TOKEN_SOURCE",
      "apiName": "${API_PLATFORM_API_NAME}",
      "apiKeyHeaderName": "x-api-key",
      "apiPlatformUrl": "${API_PLATFORM_URL}",
      "authentication": {
        "clientId": "${API_PLATFORM_CLIENT_ID}",
        "clientSecret": "${API_PLATFORM_CLIENT_SECRET}",
        "tokenUrl": "${API_PLATFORM_TOKEN_URL}",
        "scope": "${API_PLATFORM_ACCESS_TOKEN_SCOPE}",
        "grantType": "${API_PLATFORM_ACCESS_TOKEN_GRANT_TYPE}",
        "type": "OAUTH_2"
      }
    }
  },
  "consumers": [
    {
      "name": "Test Secret Manager 1",
      "action": {
        "type": "GCP_SECRET_MANAGER_CONSUMER",
        "secretName": "${GCP_SECRET_NAME}",
        "keyFieldName": "apiPlatform.apiToken",
        "projectId": "${GCP_PROJECT_ID}",
        "authentication": {
          "scopes": [],
          "type": "GCP_SERVICE_ACCOUNT",
          "credentials": "${GCLOUD_KEY}"
        }
      }
    }
  ]
}
```

## Configure chat notifications

Follow the steps below to configure chat notifications

* Find the Google Group Chat Webhook URL
  * Navigate to the Google Group Chat, and click on the dropdown near the name. Choose Manage Webhooks and in the modal that opens, add a new webhook. Once the webhook is created, copy the URL.
* Add the Webhook as an Environment Variable
  * Navigate to the Circle CI Projects pane, and click on the 3 dots (…) towards the right of your project’s name. Navigate to Project Settings.
  * Under Project Settings, navigate to Environment Variables, and click Add Environment Variable. Add an Environment Variable called CHAT_WEBHOOK, and set its value as the Google Chat Webhook URL you had copied earlier.
* Add the Script to the Circle CI Config.yml
  * Navigate to the Circle CI config.yml file,create a separate command and add success and failure hooks. Use this command in any job. If only failure alerts are needed, add the on_fail step and skip the on_success one.
  * Sample command

```
  notify-google-chat:
  description: "Notify google chat on job status"
  steps:
    - run:
        name: Chat Notification Fail 
        when: on_fail 
        command: >
          curl --header "Content-Type: application/json"
          --request POST 
          --data "{\"cards\":[{\"header\":{\"title\":\"Required title.\",\"imageUrl\":\"https://png.pngtree.com/svg/20170406/icon_failed__1325447.png\",\"imageStyle\":\"IMAGE\"},\"sections\":[{\"widgets\":[{\"keyValue\":{\"content\":\"Required message\",\"contentMultiline\":\"true\",\"onClick\": {\"openLink\": {\"url\": \"${CIRCLE_BUILD_URL}/\"}}}}]
           }]}]"
           $CHAT_WEBHOOK_URL
    - run:
        name: Chat Notification Success 
        when: on_success 
        command: >
          curl --header "Content-Type: application/json" 
          --request POST 
          --data "{\"cards\":[{\"header\":{\"title\":\"Required title.\",\"imageUrl\":\"https://png.pngtree.com/svg/20170510/success_404253.png\",\"imageStyle\":\"IMAGE\"},\"sections\":[{\"widgets\":[{\"keyValue\":{\"content\":\"Required content\",\"contentMultiline\":\"true\",\"onClick\": {\"openLink\": {\"url\": \"${CIRCLE_BUILD_URL}/\"}}}}]
          }]}]" 
          $CHAT_WEBHOOK_URL

```

## Steps to generate GCLOUD key

Follow the steps below to generate the GCLOUD key

* In the Google Cloud console, select the project.
* Go to the service accounts page.
* Click the email address of the service account that you want to create a key for.
* Click the Keys tab.
* Click the Add key drop-down menu, then select Create new key.
* Select JSON as the Key type and click Create.
* Clicking Create downloads a service account key file. After you download the key file, you cannot download it again.

The downloaded key has the following format, where PRIVATE_KEY is the private portion of the public/private key pair:

```
{
"type": "service_account",
"project_id": "PROJECT_ID",
"private_key_id": "KEY_ID",
"private_key": "-----BEGIN PRIVATE KEY-----\nPRIVATE_KEY\n-----END PRIVATE KEY-----\n",
"client_email": "SERVICE_ACCOUNT_EMAIL",
"client_id": "CLIENT_ID",
"auth_uri": "https://accounts.google.com/o/oauth2/auth",
"token_uri": "https://accounts.google.com/o/oauth2/token",
"auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
"client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/SERVICE_ACCOUNT_EMAIL"
}
```

Make sure to store the key file securely, because it can be used to authenticate as your service account. You can move and rename this file however you would like.

Once key is downloaded, to convert into base64 copy it to the terminal and use the following command:
``` <gcloud_key> | base64 ```

## Steps to be followed when a secret is compromised

When a secret is compromised, rotate it immediately. In case of CDA secrets, as we maintain two secrets to support no downtime rotation follow the below steps to prune the secrets out of the system in the event of a compromise.

| Type    | Number of automated rotations |
| -------- | ------- |
| Oldest secret | Rotate the secrets **once** |
| Latest secret | Rotate the secrets **twice** |

## FAQs

- **How much time will it take to onboard this automated secrets rotator tool?**
  <br/>Effort varies based on the number of environments and services/systems. We feel that to integrate secrets-rotator for a single service in the dev environment which has the “GCP Secret Manager” already implemented to manage your secret, it should take around half a day of a developer's time.

- **What if my team is not managing their secrets in “GCP Secret Manager”?**
  <br/>Security team recommends leveraging SaaS solutions such as AWS Secrets Manager, Azure Key Vault, GCP Secrets Manager, etc. So, the recommendation is to first migrate your secrets to the cloud secret manager and go through this automation process. Please reach out to us if there are more questions.

- **If it is automated, how will I get to know that the secret rotation was successful or failed?**
  <br/>Automated secrets-rotator tool has the capability to inform the rotation execution status to the team members through google chat. This capability requires configuration to be added to the pipeline. Please refer to the guided resources for more details.

- **If the secret rotation failed, how can I fix the error?**
  <br/>You can open the pipeline and see the logs. In the logs, it will be mentioned what caused the failure. You can take the action based on the logs. Also, an encrypted file is generated which you can manually check to see the newly generated secret and take further action.

- **If I am using same API Publisher key to publish multiple APIs in the API Platform, can I rotate that API Publisher key everywhere at once?**
  <br/>Yes. In case you have a monolith application and using single key to authenticate multiple APIs, you can rotate the key and update it in the API Platform in multiple places by adding more consumers in the Secrets Rotator configuration file.

- **If I am using same Events Subscription token to listen multiple events from different domains, can I rotate that token everywhere at once?**
  <br/>Yes. In case you have a monolith application and using single key to authenticate multiple APIs, you can rotate the token and update it in the API Platform in multiple places by adding more consumers in the Secrets Rotator configuration file.

- **Can I update multiple Client Secrets at once?**
  <br/>No. Different clients need to be updated separately.

- **Will I be able to update the secrets stored in AWS secret manager using the Automated Secrets Rotator tool?**
  <br/>Yes. This feature is available now in the current tool.

- **Can I rotate the API publisher key of a registered API using the Automated Secrets Rotator tool?**
  <br/>No. The tool can be used to rotate the API publisher key of published APIs only.

- **What if I need any support during integration?**
  <br/>Contact us through [digital-innovation-labs@thoughtworks.com](mailto:digital-innovation-labs@thoughtworks.com) or [techops-developer-platform-team@thoughtworks.com](mailto:techops-developer-platform-team@thoughtworks.com)

- **Did you rotate the secrets used in the training video after recording?**
  <br/>Yes, we have rotated the secrets which have been shown on the training videos.
