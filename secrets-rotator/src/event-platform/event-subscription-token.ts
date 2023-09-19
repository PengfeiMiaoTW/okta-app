import { EventSubscriptionTokenConsumerAction, Password } from "../types";
import { callApi } from "../api/api-action";

export async function rotateEventSubscriptionToken(config: EventSubscriptionTokenConsumerAction, password: Password) {
  try {
    console.info("Started rotating event subscription token");
    await callApi({
      url: `${config.apiPlatformUrl}/event-subscribers/v2/subscriptions/${config.eventSubscriptionName}`,
      method: "PUT",
      authentication: config.authentication,
      payload: {
        notification: {
          auth: {
            header: config.eventSubscriptionAuthHeaderName,
            value: password,
          },
        },
      },
    });
    console.info("Completed rotating event subscription token");
  } catch (error) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    console.info(`Error while rotating event subscription token. Error Message:${error.message}`);
    throw error;
  }
}
