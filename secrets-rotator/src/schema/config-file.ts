export const configFileSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  $id: "http://example.com/example.json",
  title: "config file schema",
  type: "object",
  properties: {
    source: {
      type: "object",
      required: ["name", "action"],
      properties: {
        name: {
          type: "string",
        },
        action: {
          type: "object",
          required: ["type"],
          allOf: [
            {
              if: {
                properties: {
                  type: {
                    oneOf: [
                      {
                        type: "number",
                      },
                      {
                        type: "string",
                      },
                      {
                        type: "boolean",
                      },
                      {
                        type: "object",
                      },
                      {
                        type: "array",
                      },
                      {
                        type: "null",
                      },
                    ],
                  },
                },
                required: ["type"],
              },
              then: {
                properties: {
                  type: {
                    enum: ["SENDGRID_SOURCE", "API_SOURCE", "API_PLATFORM_CLIENT_SECRET", "GCP_SECRET_MANAGER_SOURCE",
                           "AWS_SECRET_MANAGER_SOURCE", "GCP_POSTGRES_DATABASE_SOURCE", "API_PLATFORM_API_SERVICE_TOKEN_SOURCE",
                           "GCP_SERVICE_ACCOUNT_KEY_SOURCE", "GENERATE_PASSWORD", "AWS_GATEWAY_API_KEY_SOURCE"],
                  },
                },
                required: ["type"],
              },
            },
            {
              if: {
                properties: {
                  type: {
                    const: "SENDGRID_SOURCE",
                  },
                },
                required: ["type"],
              },
              then: {
                $ref: "#/definitions/sendGridSourceAction",
              },
            },
            {
              if: {
                properties: {
                  type: {
                    const: "API_SOURCE",
                  },
                },
                required: ["type"],
              },
              then: {
                $ref: "#/definitions/apiSourceAction",
              },
            },
            {
              if: {
                properties: {
                  type: {
                    const: "API_PLATFORM_CLIENT_SECRET",
                  },
                },
                required: ["type"],
              },
              then: {
                $ref: "#/definitions/apiClientSecretAction",
              },
            },
            {
              if: {
                properties: {
                  type: {
                    const: "GCP_SECRET_MANAGER_SOURCE",
                  },
                },
                required: ["type"],
              },
              then: {
                $ref: "#/definitions/gcpSecretManagerSourceAction",
              },
            },
            {
              if: {
                properties: {
                  type: {
                    const: "AWS_SECRET_MANAGER_SOURCE",
                  },
                },
                required: ["type"],
              },
              then: {
                $ref: "#/definitions/awsSecretManagerSourceAction",
              },
            },
            {
              if: {
                properties: {
                  type: {
                    const: "GCP_POSTGRES_DATABASE_SOURCE",
                  },
                },
                required: ["type"],
              },
              then: {
                $ref: "#/definitions/gcpPostgresDataBaseSourceAction",
              },
            },
            {
              if: {
                properties: {
                  type: {
                    const: "API_PLATFORM_API_SERVICE_TOKEN_SOURCE",
                  },
                },
                required: ["type"],
              },
              then: {
                $ref: "#/definitions/apiPlatformApiServiceTokenSourceAction",
              },
            },
            {
              if: {
                properties: {
                  type: {
                    const: "GCP_SERVICE_ACCOUNT_KEY_SOURCE",
                  },
                },
                required: ["type"],
              },
              then: {
                $ref: "#/definitions/gcpServiceAccountKeySourceAction",
              },
            },
            {
              if: {
                properties: {
                  type: {
                    const: "GENERATE_PASSWORD",
                  },
                },
                required: ["type"],
              },
              then: {
                $ref: "#/definitions/generatePasswordSourceAction",
              },
            },
            {
              if: {
                properties: {
                  type: {
                    const: "AWS_GATEWAY_API_KEY_SOURCE",
                  },
                },
                required: ["type"],
              },
              then: {
                $ref: "#/definitions/awsApiGatewayApiKeySourceAction",
              },
            },
          ],
        },
        passwordConfig: {
          type: "object",
          required: ["length", "numbers", "symbols", "lowercase", "excludeSimilarCharacters", "exclude", "strict"],
          properties: {
            length: {
              type: "number",
            },
            numbers: {
              type: "boolean",
            },
            symbols: {
              type: "boolean",
            },
            lowercase: {
              type: "boolean",
            },
            excludeSimilarCharacters: {
              type: "boolean",
            },
            exclude: {
              type: "string",
            },
            strict: {
              type: "boolean",
            },
          },
        },
      },
    },
    consumers: {
      type: "array",
      items: {
        $ref: "#/definitions/consumer",
      },
    },
  },
  definitions: {
    basicAuthentication: {
      type: "object",
      required: ["type", "userName", "password"],
      properties: {
        type: {
          const: "BASIC",
        },
        userName: {
          type: "string",
        },
        password: {
          type: "string",
        },
      },
    },
    oauth2Authentication: {
      type: "object",
      required: ["type", "grantType", "scope", "tokenUrl", "clientId", "clientSecret"],
      properties: {
        type: {
          const: "OAUTH_2",
        },
        grantType: {
          type: "string",
        },
        scope: {
          type: "string",
        },
        tokenUrl: {
          type: "string",
        },
        clientId: {
          type: "string",
        },
        clientSecret: {
          type: "string",
        },
      },
    },
    bearerAuthentication: {
      type: "object",
      required: ["type", "apiKey"],
      properties: {
        type: {
          const: "BEARER",
        },
        apiKey: {
          type: "string",
        },
      },
    },
    gcpServiceAccountAuthentication: {
      type: "object",
      required: ["type"],
      properties: {
        type: {
          const: "GCP_SERVICE_ACCOUNT",
        },
        scopes: {
          type: "array",
          items: {
            type: "string",
          },
        },
        credentials: {
          type: "string",
        },
      },
    },
    sendGridSourceAction: {
      type: "object",
      required: ["type", "apiKeyName", "authentication"],
      properties: {
        type: {
          const: "SENDGRID_SOURCE",
        },
        apiKeyName: {
          type: "string",
        },
        authentication: {
          type: "object",
          properties: {
            type: {
              const: "SENDGRID",
            },
            apiKey: {
              type: "string",
            },
          },
        },
      },
    },
    awsAccountAuthentication: {
      type: "object",
      required: ["type", "credentials"],
      properties: {
        type: {
          const: "AWS_ACCOUNT",
        },
        scopes: {
          type: "array",
          items: {
            type: "string",
          },
        },
        credentials: {
          type: "object",
          required: ["accessKeyId", "secretAccessKey", "sessionToken"],
          properties: {
            accessKeyId: {
              type: "string",
            },
            secretAccessKey: {
              type: "string",
            },
            sessionToken: {
              type: "string",
            },
          },
        },
      },
    },
    apiSourceAction: {
      type: "object",
      required: ["type", "url", "method", "authentication"],
      properties: {
        type: {
          const: "API_SOURCE",
        },
        body: {
          anyOf: [
            {
              type: "number",
            },
            {
              type: "string",
            },
            {
              type: "boolean",
            },
            {
              type: "object",
            },
            {
              type: "array",
            },
            {
              type: "null",
            },
          ],
        },
        params: {
          anyOf: [
            {
              type: "number",
            },
            {
              type: "string",
            },
            {
              type: "boolean",
            },
            {
              type: "object",
            },
            {
              type: "array",
            },
            {
              type: "null",
            },
          ],
        },
        url: {
          type: "string",
        },
        method: {
          enum: ["get", "GET", "delete", "DELETE", "head", "HEAD",
                 "options", "OPTIONS", "post", "POST", "put", "PUT", "patch", "PATCH", "purge", "PURGE", "link", "LINK", "unlink", "UNLINK"],
        },
        responseKeyField: {
          type: "string",
        },
        authentication: {
          type: "object",
          required: ["type"],
          allOf: [
            {
              if: {
                properties: {
                  type: {
                    oneOf: [
                      {
                        type: "number",
                      },
                      {
                        type: "string",
                      },
                      {
                        type: "boolean",
                      },
                      {
                        type: "object",
                      },
                      {
                        type: "array",
                      },
                      {
                        type: "null",
                      },
                    ],
                  },
                },
                required: ["type"],
              },
              then: {
                properties: {
                  type: {
                    enum: ["BASIC", "OAUTH_2", "BEARER"],
                  },
                },
                required: ["type"],
              },
            },
            {
              if: {
                properties: {
                  type: {
                    const: "BASIC",
                  },
                },
                required: ["type"],
              },
              then: {
                $ref: "#/definitions/basicAuthentication",
              },
            },
            {
              if: {
                properties: {
                  type: {
                    const: "OAUTH_2",
                  },
                },
                required: ["type"],
              },
              then: {
                $ref: "#/definitions/oauth2Authentication",
              },
            },
            {
              if: {
                properties: {
                  type: {
                    const: "BEARER",
                  },
                },
                required: ["type"],
              },
              then: {
                $ref: "#/definitions/bearerAuthentication",
              },
            },
          ],
        },
      },
    },
    apiClientSecretAction: {
      type: "object",
      required: ["type", "apiPlatformUrl", "authentication"],
      properties: {
        type: {
          const: "API_PLATFORM_CLIENT_SECRET",
        },
        apiPlatformUrl: {
          type: "string",
        },
        authentication: {
          $ref: "#/definitions/oauth2Authentication",
        },
      },
    },
    gcpSecretManagerSourceAction: {
      type: "object",
      required: ["type", "secretName", "projectId"],
      properties: {
        type: {
          const: "GCP_SECRET_MANAGER_SOURCE",
        },
        secretName: {
          type: "string",
        },
        keyFieldName: {
          type: "string",
        },
        isValueArray: {
          type: "boolean",
        },
        keyFieldNames: {
          type: "array",
          items: {
            type: "object",
            required: ["keyFieldName"],
            properties: {
              keyFieldName: {
                type: "string",
              },
              isValueArray: {
                type: "boolean",
              },
            },
          },
        },
        projectId: {
          type: "string",
        },
        authentication: {
          $ref: "#/definitions/gcpServiceAccountAuthentication",
        },
      },
    },
    awsSecretManagerSourceAction: {
      type: "object",
      required: ["type", "secretId", "region"],
      properties: {
        type: {
          const: "AWS_SECRET_MANAGER_SOURCE",
        },
        secretId: {
          type: "string",
        },
        keyFieldName: {
          type: "string",
        },
        isValueArray: {
          type: "boolean",
        },
        keyFieldNames: {
          type: "array",
          items: {
            type: "object",
            required: ["keyFieldName"],
            properties: {
              keyFieldName: {
                type: "string",
              },
              isValueArray: {
                type: "boolean",
              },
            },
          },
        },
        region: {
          type: "string",
        },
        authentication: {
          $ref: "#/definitions/awsAccountAuthentication",
        },
      },
    },
    gcpPostgresDataBaseSourceAction: {
      type: "object",
      required: ["type", "userName", "instanceName", "projectId"],
      properties: {
        type: {
          const: "GCP_POSTGRES_DATABASE_SOURCE",
        },
        userName: {
          type: "string",
        },
        instanceName: {
          type: "string",
        },
        projectId: {
          type: "string",
        },
        authentication: {
          $ref: "#/definitions/gcpServiceAccountAuthentication",
        },
      },
    },
    apiPlatformApiServiceTokenSourceAction: {
      type: "object",
      required: ["type", "apiName", "apiKeyHeaderName", "apiPlatformUrl", "authentication"],
      properties: {
        type: {
          const: "API_PLATFORM_API_SERVICE_TOKEN_SOURCE",
        },
        apiName: {
          type: "string",
        },
        apiKeyHeaderName: {
          type: "string",
        },
        apiPlatformUrl: {
          type: "string",
        },
        authentication: {
          $ref: "#/definitions/oauth2Authentication",
        },
      },
    },
    gcpServiceAccountKeySourceAction: {
      type: "object",
      required: ["type", "serviceAccountName", "projectId"],
      properties: {
        type: {
          const: "GCP_SERVICE_ACCOUNT_KEY_SOURCE",
        },
        serviceAccountName: {
          type: "string",
        },
        projectId: {
          type: "string",
        },
        authentication: {
          $ref: "#/definitions/gcpServiceAccountAuthentication",
        },
      },
    },
    generatePasswordSourceAction: {
      type: "object",
      required: ["type"],
      properties: {
        type: {
          const: "GENERATE_PASSWORD",
        },
      },
    },
    apiConsumerAction: {
      type: "object",
      required: ["type", "url", "method", "authentication"],
      properties: {
        type: {
          const: "API_CONSUMER",
        },
        body: {
          anyOf: [
            {
              type: "number",
            },
            {
              type: "string",
            },
            {
              type: "boolean",
            },
            {
              type: "object",
            },
            {
              type: "array",
            },
            {
              type: "null",
            },
          ],
        },
        params: {
          anyOf: [
            {
              type: "number",
            },
            {
              type: "string",
            },
            {
              type: "boolean",
            },
            {
              type: "object",
            },
            {
              type: "array",
            },
            {
              type: "null",
            },
          ],
        },
        url: {
          type: "string",
        },
        method: {
          enum: ["get", "GET", "delete", "DELETE", "head", "HEAD",
                 "options", "OPTIONS", "post", "POST", "put", "PUT", "patch", "PATCH", "purge", "PURGE", "link", "LINK", "unlink", "UNLINK"],
        },
        responseKeyField: {
          type: "string",
        },
        authentication: {
          type: "object",
          required: ["type"],
          allOf: [
            {
              if: {
                properties: {
                  type: {
                    oneOf: [
                      {
                        type: "number",
                      },
                      {
                        type: "string",
                      },
                      {
                        type: "boolean",
                      },
                      {
                        type: "object",
                      },
                      {
                        type: "array",
                      },
                      {
                        type: "null",
                      },
                    ],
                  },
                },
                required: ["type"],
              },
              then: {
                properties: {
                  type: {
                    enum: ["BASIC", "OAUTH_2", "BEARER"],
                  },
                },
                required: ["type"],
              },
            },
            {
              if: {
                properties: {
                  type: {
                    const: "BASIC",
                  },
                },
                required: ["type"],
              },
              then: {
                $ref: "#/definitions/basicAuthentication",
              },
            },
            {
              if: {
                properties: {
                  type: {
                    const: "OAUTH_2",
                  },
                },
                required: ["type"],
              },
              then: {
                $ref: "#/definitions/oauth2Authentication",
              },
            },
            {
              if: {
                properties: {
                  type: {
                    const: "BEARER",
                  },
                },
                required: ["type"],
              },
              then: {
                $ref: "#/definitions/bearerAuthentication",
              },
            },
          ],
        },
      },
    },
    gcpSecretManagerConsumerAction: {
      type: "object",
      required: ["type", "secretName", "projectId"],
      properties: {
        type: {
          const: "GCP_SECRET_MANAGER_CONSUMER",
        },
        secretName: {
          type: "string",
        },
        keyFieldName: {
          type: "string",
        },
        isValueArray: {
          type: "boolean",
        },
        keyFieldNames: {
          type: "array",
          items: {
            type: "object",
            required: ["keyFieldName"],
            properties: {
              keyFieldName: {
                type: "string",
              },
              isValueArray: {
                type: "boolean",
              },
            },
          },
        },
        projectId: {
          type: "string",
        },
        authentication: {
          $ref: "#/definitions/gcpServiceAccountAuthentication",
        },
      },
    },
    apiPlatformApiServiceTokenConsumerAction: {
      type: "object",
      required: ["type", "apiName", "apiKeyHeaderName", "apiPlatformUrl", "authentication"],
      properties: {
        type: {
          const: "API_PLATFORM_API_SERVICE_TOKEN_CONSUMER",
        },
        apiName: {
          type: "string",
        },
        apiKeyHeaderName: {
          type: "string",
        },
        apiPlatformUrl: {
          type: "string",
        },
        authentication: {
          $ref: "#/definitions/oauth2Authentication",
        },
      },
    },
    eventSubscriptionTokenConsumerAction: {
      type: "object",
      required: ["type", "eventSubscriptionName", "eventSubscriptionAuthHeaderName", "apiPlatformUrl", "authentication"],
      properties: {
        type: {
          const: "EVENT_SUBSCRIPTION_TOKEN",
        },
        eventSubscriptionName: {
          type: "string",
        },
        eventSubscriptionAuthHeaderName: {
          type: "string",
        },
        apiPlatformUrl: {
          type: "string",
        },
        authentication: {
          $ref: "#/definitions/oauth2Authentication",
        },
      },
    },
    awsSecretManagerConsumerAction: {
      type: "object",
      required: ["type", "secretId", "region"],
      properties: {
        type: {
          const: "AWS_SECRET_MANAGER_CONSUMER",
        },
        secretId: {
          type: "string",
        },
        keyFieldName: {
          type: "string",
        },
        isValueArray: {
          type: "boolean",
        },
        keyFieldNames: {
          type: "array",
          items: {
            type: "object",
            required: ["keyFieldName"],
            properties: {
              keyFieldName: {
                type: "string",
              },
              isValueArray: {
                type: "boolean",
              },
            },
          },
        },
        region: {
          type: "string",
        },
        authentication: {
          $ref: "#/definitions/awsAccountAuthentication",
        },
      },
    },
    awsApiGatewayApiKeyConsumerAction: {
      type: "object",
      required: ["type", "usagePlanId", "region"],
      properties: {
        type: {
          const: "AWS_GATEWAY_API_KEY_CONSUMER",
        },
        usagePlanId: {
          type: "string",
        },
        region: {
          type: "string",
        },
        authentication: {
          $ref: "#/definitions/awsAccountAuthentication",
        },
      },
    },
    awsApiGatewayApiKeySourceAction: {
      type: "object",
      required: ["type", "usagePlanId", "region"],
      properties: {
        type: {
          const: "AWS_GATEWAY_API_KEY_SOURCE",
        },
        usagePlanId: {
          type: "string",
        },
        region: {
          type: "string",
        },
        authentication: {
          $ref: "#/definitions/awsAccountAuthentication",
        },
      },
    },
    redeploy: {
      type: "object",
      required: ["workflowId", "jobId", "accessToken"],
      properties: {
        workflowId: {
          type: "string",
        },
        jobId: {
          type: "string",
        },
        accessToken: {
          type: "string",
        },
      },
    },
    consumer: {
      type: "object",
      required: ["name", "action"],
      properties: {
        name: {
          type: "string",
        },
        action: {
          type: "object",
          required: ["type"],
          allOf: [
            {
              if: {
                properties: {
                  type: {
                    oneOf: [
                      {
                        type: "number",
                      },
                      {
                        type: "string",
                      },
                      {
                        type: "boolean",
                      },
                      {
                        type: "object",
                      },
                      {
                        type: "array",
                      },
                      {
                        type: "null",
                      },
                    ],
                  },
                },
                required: ["type"],
              },
              then: {
                properties: {
                  type: {
                    enum:
                      [
                        "API_CONSUMER",
                        "GCP_SECRET_MANAGER_CONSUMER",
                        "API_PLATFORM_API_SERVICE_TOKEN_CONSUMER",
                        "EVENT_SUBSCRIPTION_TOKEN",
                        "AWS_SECRET_MANAGER_CONSUMER",
                        "AWS_GATEWAY_API_KEY_CONSUMER",
                      ],
                  },
                },
                required: ["type"],
              },
            },
            {
              if: {
                properties: {
                  type: {
                    const: "API_CONSUMER",
                  },
                },
                required: ["type"],
              },
              then: {
                $ref: "#/definitions/apiConsumerAction",
              },
            },
            {
              if: {
                properties: {
                  type: {
                    const: "GCP_SECRET_MANAGER_CONSUMER",
                  },
                },
                required: ["type"],
              },
              then: {
                $ref: "#/definitions/gcpSecretManagerConsumerAction",
              },
            },
            {
              if: {
                properties: {
                  type: {
                    const: "API_PLATFORM_API_SERVICE_TOKEN_CONSUMER",
                  },
                },
                required: ["type"],
              },
              then: {
                $ref: "#/definitions/apiPlatformApiServiceTokenConsumerAction",
              },
            },
            {
              if: {
                properties: {
                  type: {
                    const: "EVENT_SUBSCRIPTION_TOKEN",
                  },
                },
                required: ["type"],
              },
              then: {
                $ref: "#/definitions/eventSubscriptionTokenConsumerAction",
              },
            },
            {
              if: {
                properties: {
                  type: {
                    const: "AWS_SECRET_MANAGER_CONSUMER",
                  },
                },
                required: ["type"],
              },
              then: {
                $ref: "#/definitions/awsSecretManagerConsumerAction",
              },
            },
            {
              if: {
                properties: {
                  type: {
                    const: "AWS_GATEWAY_API_KEY_CONSUMER",
                  },
                },
                required: ["type"],
              },
              then: {
                $ref: "#/definitions/awsApiGatewayApiKeyConsumerAction",
              },
            },
          ],
        },
        redeploy: {
          oneOf: [
            {
              $ref: "#/definitions/redeploy",
            },
            {
              type: "array",
              items: {
                $ref: "#/definitions/redeploy",
              },
            },
          ],
        },
      },
    },
  },
};


