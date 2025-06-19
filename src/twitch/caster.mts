import { TWITCH_ENVIRONMENT } from "./environment.mts";
import { TwitchOIDC } from "./oidc.mjs";
import type { TwitchIrcClient } from "./irc.mts";
import type { websocketServer } from "../http/websockets.mts";
import EventEmitter from "events";
import { WebSocket as WS } from "ws";
import { Logger } from "../logging.mjs";
import { serializeError } from "serialize-error";
import VError from "verror";
import type {
  EventsubMessage,
  EventsubNotificationMessage,
  EventsubWelcomeMessage,
} from "./api/eventsub.mjs";

export class TwitchCasterClient extends EventEmitter {
  websocket: WS | null = null;
  interval: number;

  constructor(
    private oidc: TwitchOIDC | null = null,
    public readonly irc: TwitchIrcClient,
    private readonly server: ReturnType<typeof websocketServer>
  ) {
    super();
  }

  async connect() {
    Logger.info("[CASTER] Connecting to Twitch Eventsub");
    this.websocket = new WS(TWITCH_ENVIRONMENT.TWITCH_EVENTSUB_WEBSOCKET_URL);
  }

  async keepalive(interval?: number) {
    if (interval) {
      // this.interval = setTimeout(() => {});
    }
  }

  async subscribe() {
    const { websocket } = this;

    if (!websocket) {
      throw new VError("[CASTER] Eventsub is not connected");
    }

    websocket.onerror = (e) => {
      Logger.withMetadata({
        error: serializeError(e),
      }).error(`[CASTER] Eventsub error occurred`);
    };

    websocket.onopen = function (event) {
      Logger.debug(`[CASTER] Eventsub websocket onopen`);
    };

    websocket.onclose = (event) => {
      Logger.withMetadata({
        event,
      }).info(`[CASTER] Eventsub connection closed`);

      setTimeout(() => {
        Logger.withMetadata({
          event,
        }).info(`[CASTER] Websocket closed, reconnecting Eventsub`);
        this.websocket = null;

        this.connect();
        this.subscribe();
      }, 2500);
    };

    websocket.onmessage = (event) => {
      const textData = event.data.toString();
      if (textData.includes("NOTICE")) {
        if (textData.includes("Login authentication failed")) {
          throw new VError(
            {
              info: {
                textData,
              },
            },
            textData
          );
        }
      }

      const data = JSON.parse(
        event.data.toString()
      ) as unknown as EventsubMessage;

      switch (data.metadata.message_type) {
        case "session_welcome":
          const session_welcome = data as EventsubWelcomeMessage;

          Logger.withMetadata({
            session_welcome,
          }).info(`[CASTER] Session Welcome`);

          const { payload } = session_welcome;
          // this.keepalive(
          //   session_welcome.payload.session.keepalive_timeout_seconds,
          // );

          if (!this.oidc) {
            throw new VError("[CASTER] Oidc not initialized");
          }

          const oidc = this.oidc;
          // setTimeout(() => {
          //   subscribe(
          //     oidc,
          //     "channel.channel_points_custom_reward_redemption.add",
          //     "1",
          //     payload.session.id,
          //   );
          // }, 9000);
          break;
        case "session_keepalive":
          break;
        case "notification":
          const notification = data as EventsubNotificationMessage;

          const parsedSubscription = {
            ...notification.payload,
          };

          // await subscriptionsHandler(
          //   data.metadata.subscription_type,
          //   parsedSubscription,
          //   this.irc,
          //   this.server
          // );

          break;
      }
    };
  }
}
