import { ApiClientSecretAction, ApiConsumerAction, ApiSourceAction, Password, SourceActionType } from "../types";
import axios, { Method } from "axios";
import _ from "lodash";
import querystring from "querystring";
import { getCredentialsForBasicAuth } from "../utils/api";
import { identity } from "../utils/cast-to";

const getAuthorizationHeader = async (auth: ApiSourceAction["authentication"]) => {
  try {
    console.info("Starting to get authorization header.");
    if (auth.type === "BASIC") {
      return `Basic ${getCredentialsForBasicAuth(auth)}`;
    } else if (auth.type === "BEARER") {
      return `Bearer ${auth.apiKey}`;
    } else if (auth.type === "OAUTH_2") {
      // eslint-disable-next-line camelcase
      const response: { data: { access_token: string } } = await axios(
        {
          url: auth.tokenUrl,
          method: "post",
          headers: {
            Authorization: `Basic ${getCredentialsForBasicAuth({
              userName: auth.clientId,
              password: auth.clientSecret,
            })}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          data: querystring.stringify({
            // eslint-disable-next-line camelcase
            grant_type: auth.grantType,
            scope: auth.scope,
          }),
        },
      );
      console.info("Got authorization header.");
      return `Bearer ${response.data.access_token}`;
    }
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    console.info(`Error while getting authorization header\nFailed with error ${JSON.stringify(error.response.data)}`);
    throw error;
  }
};

export async function callApi<Response = unknown>(config: {
  url: string;
  method: Method;
  authentication: ApiSourceAction["authentication"];
  payload?: unknown;
}) {
  try {
    console.info(`Calling ${config.method} ${config.url}.`);
    const response = await axios(
      config.url,
      {
        method: config.method,
        headers: {
          Authorization: await getAuthorizationHeader(config.authentication),
        },
        data: config?.payload ?? undefined,
      },
    );
    console.info(`Got ${response.status} response from ${config.url}.`);
    return response.data as Response;
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    console.info(`Got ${error.response.status} error from ${config.url}.\nFailed with error ${JSON.stringify(error.response.data)}`);
    throw error;
  }
}

function replacePlaceHolderInPayload(
  payload: unknown,
  secretValue: string,
  placeHolderName: string = "${{SECRET_VALUE}}",
) {
  // todo future scope. this might fail if the payload is x-www-form-urlencoded string or any other non json format.
  const payloadAsString = JSON.stringify(payload);
  const replacedPayload = payloadAsString.replace(placeHolderName, secretValue);
  return JSON.parse(replacedPayload);
}

export async function rotateSourceSecretByApiCall(action: ApiSourceAction) {
  try {
    console.info("Started rotating source secret by an api call.");
    const response = await callApi({
      url: action.url,
      method: action.method,
      payload: action.body,
      authentication: action.authentication,
    });
    console.info("Completed rotating source secret by an api call.");
    if (action.responseKeyField) {
      return _.get(response, action.responseKeyField);
    }
    return response;
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    console.info(`Error while calling the api to rotate secrets. Error Message:${error.message}`);
    throw error;
  }
}

export async function rotateClientSecretByApiCall(apiClientSecretAction: ApiClientSecretAction) {
  return rotateSourceSecretByApiCall(identity<ApiSourceAction>({
    type: SourceActionType.API,
    url: `${apiClientSecretAction.apiPlatformUrl}/clients/${apiClientSecretAction.authentication.clientId}/secrets/regenerate-oldest`,
    method: "POST",
    params: null,
    authentication: apiClientSecretAction.authentication,
    body: {},
    responseKeyField: "newSecret.secret",
  }));
}

export async function rotateConsumerSecretByApiCall(action: ApiConsumerAction, password: Password) {
  try {
    console.info("Started rotating consumer secret by api call.");
    const response = await callApi({
      url: action.url,
      method: action.method,
      payload: replacePlaceHolderInPayload(action.body, password),
      authentication: action.authentication,
    });
    console.info("Completed rotating consumer secret by api call.");
    return response;
  } catch (error) {
    console.info("Failed to rotate consumer secret by api call.");
    throw error;
  }
}

