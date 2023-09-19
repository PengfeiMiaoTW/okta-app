import { ApiPlatformApiServiceTokenConsumerAction, Password } from "../types";
import { callApi } from "../api/api-action";

export async function rotateApiPlatformApiServiceToken(config: ApiPlatformApiServiceTokenConsumerAction, password: Password) {
  try {
    console.info("Started rotating api platform api service token.");
    const { result } = await callApi<{ result: Array<{ id: string; name: string }> }>({
      url: `${config.apiPlatformUrl}/publisher/apis/`,
      method: "GET",
      authentication: config.authentication,
    });
    const app = result.find((api) => api.name === config.apiName);
    if (!app) {
      const errorMessage = `API with name "${config.apiName}" not exist.`;
      console.info(errorMessage);
      // noinspection ExceptionCaughtLocallyJS
      throw new Error(errorMessage);
    }
    const apiId = app.id;
    await callApi({
      url: `${config.apiPlatformUrl}/publisher/apis/${apiId}/plugins/request-transformer`,
      method: "PUT",
      authentication: config.authentication,
      payload: {
        config: {
          append: {
            headers: [`${config.apiKeyHeaderName}:${password}`],
          },
        },
        type: "request-transformer",
      },
    });
    console.info("Completed rotating api platform api service token.");
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    console.info(`Error while rotating api platform api service token. Error Message:${error.message}`);
    throw error;
  }
}
