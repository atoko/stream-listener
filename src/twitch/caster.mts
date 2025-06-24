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

const logger = Logger.child().withPrefix("[CASTER]");

export class TwitchCasterClient extends EventEmitter {
  websocket: WS | null = null;
  delay: number = 5000;
  last: number;

  constructor(
    private oidc: TwitchOIDC | null = null,
    public readonly irc: TwitchIrcClient,
    private readonly server: ReturnType<typeof websocketServer>,
  ) {
    super();
  }

  async connect() {
    logger.info("Connecting to Twitch Eventsub");
    this.websocket = new WS(TWITCH_ENVIRONMENT.TWITCH_EVENTSUB_WEBSOCKET_URL);
  }

  async subscribe() {
    const { websocket } = this;

    if (!websocket) {
      throw new VError("Eventsub is not connected");
    }

    websocket.onerror = (e) => {
      logger
        .withMetadata({
          error: serializeError(e),
        })
        .error(`Eventsub error occurred`);
    };

    websocket.onopen = () => {
      logger.debug(`Eventsub websocket onopen`);
      this.delay = Math.max(this.delay / 3, 5000);
    };

    websocket.onclose = (event) => {
      logger
        .withMetadata({
          event: {
            type: event.type,
            code: event.code,
            reason: event.reason,
          },
        })
        .info(`Eventsub connection closed`);

      this.delay = this.delay * 2;
      setTimeout(() => {
        logger.info(`Reconnecting Eventsub`);
        this.websocket = null;

        this.connect();
        this.subscribe();
      }, this.delay);
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
            textData,
          );
        }
      }

      const data = JSON.parse(
        event.data.toString(),
      ) as unknown as EventsubMessage;

      switch (data.metadata.message_type) {
        case "session_welcome":
          const session_welcome = data as EventsubWelcomeMessage;

          logger
            .withMetadata({
              session_welcome,
            })
            .info(`Session Welcome`);

          // const { payload } = session_welcome;
          if (!this.oidc) {
            throw new VError("Oidc not initialized");
          }

          // const oidc = this.oidc;
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

          // const parsedSubscription = {
          //   ...notification.payload,
          // };

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
