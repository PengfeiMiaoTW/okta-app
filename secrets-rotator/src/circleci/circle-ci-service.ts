import axios, { Method } from "axios";

export const callCircleCiApi = async <Response = unknown>(
  url: string,
  method: Method = "get",
  accessToken: string,
  data?: unknown,
  params?: unknown,
) => {
  const completeUrl = `https://circleci.com/api/v2${url}`;
  try {
    console.info(`Calling ${completeUrl}.`);
    const response = await axios({
      url: completeUrl,
      method,
      headers: {
        "Circle-Token": accessToken,
        "Content-Type": "application/json",
      },
      data,
      params,
    });
    console.info(`Got ${response.status} from ${completeUrl}.`);
    return response.data as Response;
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    console.info(`Got ${error.response.status} error from ${completeUrl}.\nFailed with error ${error.response.data.message}`);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    throw new Error(error.response.data.message);
  }
};
