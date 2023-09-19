import axios, { AxiosRequestConfig } from "axios";
import MockAdapter from "axios-mock-adapter";
import { iif } from "../../src/utils/functions";
import { AwsCommand, AwsStub } from "aws-sdk-client-mock";
import { ServiceInputTypes, ServiceOutputTypes } from "@aws-sdk/client-secrets-manager";
import * as APIGateway from "@aws-sdk/client-api-gateway";

export function mockAxios() {
  const mock = new MockAdapter(axios);
  return mock;
}

/** *
 * Make sure to call
 * @see mockAxios before using this function
 */
export function assertApiRequest(
  mockedAxiosInstance: MockAdapter,
  options: Pick<AxiosRequestConfig, "url" | "method" | "headers" | "data">,
  noOfTimesCalled?: number) {
  const request = mockedAxiosInstance
    .history[options.method]
    .filter((request_) =>
      request_.data === options.data
      && request_.url === options.url,
    );
  expect(request.length).not.toBe(0);
  if (noOfTimesCalled) {
    expect(request.length).toBe(noOfTimesCalled);
  }
  iif(function assertRequestHeaders() {
    // eslint-disable-next-line security/detect-object-injection
    expect(Object.keys(options.headers).every((key) => options.headers[key] === request[0].headers[key])).toBeTruthy();
  });
}

export function assertApiRequestNotMade(
  mockedAxiosInstance: MockAdapter,
  options: Pick<AxiosRequestConfig, "url" | "method" | "headers" | "data">,
) {
  const request = mockedAxiosInstance
    .history[options.method]
    .find((request_) =>
      request_.data === options.data
      && request_.url === options.url,
    );
  expect(request).toBe(undefined);
}

export function assertSecretManagerClientSendRequests(options: {
  mockSecretManagerClient: AwsStub<ServiceInputTypes, ServiceOutputTypes>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sendRequestsInputFields: Array<Record<string, any>>;
},
) {
  const { mockSecretManagerClient, sendRequestsInputFields } = options;
  expect(mockSecretManagerClient.calls().length).toEqual(sendRequestsInputFields.length);
  sendRequestsInputFields.map((input, index) => {
    // eslint-disable-next-line security/detect-object-injection
    expect(mockSecretManagerClient.calls()[index].args[0].input).toEqual(input);
  });
}

export function assertAPIGatewayClientSendRequests(options: {
  mockAPIGatewayClient: AwsStub<APIGateway.ServiceInputTypes, APIGateway.ServiceOutputTypes>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sendRequestsInputFields: Array<Record<string, any>>;
},
) {
  const { mockAPIGatewayClient, sendRequestsInputFields } = options;
  expect(mockAPIGatewayClient.calls().length).toEqual(sendRequestsInputFields.length);
  sendRequestsInputFields.map((input, index) => {
    // eslint-disable-next-line security/detect-object-injection
    expect(mockAPIGatewayClient.calls()[index].args[0].input).toEqual(input);
  });
}

export function assertAPIGatewayClientCallsNotMade(options: {
  mockAPIGatewayClient: AwsStub<APIGateway.ServiceInputTypes, APIGateway.ServiceOutputTypes>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  command: new (input: any) => AwsCommand<any, any>;
},
) {
  const { mockAPIGatewayClient, command } = options;
  expect(mockAPIGatewayClient.commandCalls(command).length).toEqual(0);
}
