import { TwitchOIDC } from "../oidc.mjs";
import {
  TWITCH_BOT,
  TWITCH_BROADCASTER,
  TWITCH_ENVIRONMENT,
} from "../environment.mjs";
import { Logger } from "../../logging.mjs";

export const subscribe = async (
  entity: TwitchOIDC,
  type: `channel.${
    | `channel_points_custom_reward_redemption.${"add"}`
    | `chat.${
        | `clear`
        | "clear_user_messages"
        | "message"
        | "message_delete"
        | "notification"}`}`,
  version: "1",
  session_id: string,
) => {
  try {
    const subEventURL = `${TWITCH_ENVIRONMENT.TWITCH_EVENTSUB_HTTP_URL}/eventsub/subscriptions`;
    let response = await fetch(subEventURL, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + entity.refreshToken,
        "Client-Id": TWITCH_ENVIRONMENT.TWITCH_CLIENT_ID,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: type,
        version: version,
        condition: {
          broadcaster_user_id: TWITCH_BROADCASTER.TWITCH_BROADCASTER_ID,
          user_id: TWITCH_BOT.TWITCH_BOT_ID,
        },
        transport: {
          method: "websocket",
          session_id,
        },
      }),
    });

    const result = (await response.json()) as unknown as {
      message: string;
      data: Array<{
        type: string;
        id: string;
      }>;
    };

    Logger.withMetadata({
      import: import.meta.filename,
      result,
    }).info("Register event sub result");

    const isStatus401 = response.status === 401;
    const isInvalidToken = result.message === "Invalid Oauth token";

    Logger.metadataOnly({
      isStatus401,
      isInvalidToken,
    });

    if (response.ok) {
      return Logger.withMetadata({
        id: result.data[0].id,
        type: result.data[0].type,
      }).info(`Subscribed`);
    }

    if (isStatus401 && isInvalidToken) {
      // await entity.routes();
    } else {
      Logger.withMetadata({
        status: response.status,
        message: result.message,
      }).info(`Register event subs error`);
    }
  } catch (e) {
    Logger.withError(e).error(`Register event subs exceptional error`);
  }
};
