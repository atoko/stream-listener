import { TWITCH_ENVIRONMENT } from "../configuration.mts";
import { TwitchOIDC } from "./oidc.mjs";
import type { TwitchIrcClient } from "./irc.mts";
import EventEmitter from "events";
import { WebSocket as WS } from "ws";
import { Logger } from "../logging.mjs";
import { serializeError } from "serialize-error";
import VError from "verror";
import type {
  EventsubMessage,
  EventsubWelcomeMessage,
} from "./api/eventsub.mjs";
import type { PluginCollection } from "../plugins.mjs";

const logger = Logger.child().withPrefix("[CASTER]");

export class TwitchCasterClient extends EventEmitter {
  websocket: WS | null = null;
  delay: number = 5000;
  last: number;
  closed: boolean = false;

  constructor(
    private oidc: TwitchOIDC | null = null,
    public readonly irc: TwitchIrcClient, // private readonly server: ReturnType<typeof websocketServer>,
    public readonly plugins: PluginCollection | null = null
  ) {
    super();
  }

  async connect() {
    logger.info("Connecting to Twitch Eventsub");
    this.websocket = new WS(TWITCH_ENVIRONMENT.TWITCH_EVENTSUB_WEBSOCKET_URL);

    await new Promise((resolve) => {
      setTimeout(resolve, 750);
    });
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
          closed: this.closed,
        })
        .info(`Eventsub connection closed`);

      if (this.closed) {
        return;
      }

      this.delay = this.delay * 2;
      setTimeout(async () => {
        logger.info(`Reconnecting Eventsub`);
        this.websocket = null;

        await this.connect();
        await this.subscribe();
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

          logger
            .withMetadata({
              session_welcome,
            })
            .info(`Session Welcome`);

          const { payload } = session_welcome;
          if (!this.oidc) {
            throw new VError("Oidc not initialized");
          }

          const oidc = this.oidc;

          break;
        case "session_keepalive":
          break;
        case "notification":
          // const notification = data as EventsubNotificationMessage;

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

  async close() {
    this.closed = true;
    this.websocket?.close(1012);
  }
}
