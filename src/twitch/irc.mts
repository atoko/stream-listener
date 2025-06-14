import { inspect } from "util";
import {
  TWITCH_BOT,
  TWITCH_BROADCASTER,
  TWITCH_ENVIRONMENT,
} from "./environment.mts";
import { TwitchOIDC } from "./oidc.mts";
import { WebSocket as WS } from "ws";
import VError from "verror";
import { Logger } from "../logging.mjs";

export class TwitchIrcClient {
  websocket: WebSocket | null = null;
  constructor(protected oidc: TwitchOIDC) {}

  connect() {
    console.log(`[IRC] Connecting to Twitch IRC WebSocket`);
    this.websocket = new WebSocket(TWITCH_ENVIRONMENT.TWITCH_IRC_WEBSOCKET_URL);
  }

  open(ev: Event) {
    console.log("[IRC] WebSocket connection established");
    if (this.websocket) {
      this.websocket.send(`PASS oauth:${this.oidc?.accessToken}`);
      this.websocket.send(`NICK ${TWITCH_BOT.TWITCH_BOT_NAME}`);
      this.websocket.send(
        `JOIN #${TWITCH_BROADCASTER.TWITCH_BROADCASTER_NAME}`
      );
    }
  }

  async subscribe() {
    if (!this.websocket) {
      throw new VError("WebSocket is not connected");
    }

    this.websocket.onclose = (event) => {
      Logger.withMetadata({
        code: event.code,
        reason: event.reason,
      }).info(`[IRC] WebSocket connection closed`);

      setTimeout(() => {
        console.log("[IRC] Reconnecting to Twitch IRC WebSocket...");
        this.websocket = null;

        this.connect();
        this.subscribe();
      }, 5000);
    };

    this.websocket.onopen = (event) => {
      this.open?.(event);
    };

    this.websocket.onmessage = (event: MessageEvent) => {
      const message = event.data
        .toString()
        .normalize("NFKC")
        .replace(/\uDB40\uDC00/g, "")
        .trim();

      if (message.startsWith("PING :tmi.twitch.tv")) {
        Logger.withMetadata({
          message,
        }).info(`Received PING message: ${message}`);
        this.websocket?.send("PONG :tmi.twitch.tv");
      } else if (
        message.includes(":tmi.twitch.tv NOTICE * :Login authentication failed")
      ) {
        Logger.withMetadata().info(
          `Received authentication failure message: ${message}`
        );

        TwitchOIDC.validate({
          accessToken: this.oidc.accessToken,
        }).then((response) => {
          if (response.type === "data") {
            Logger.withMetadata().info(
              "Access token is valid, re-subscribing..."
            );

            this.subscribe();
          }
        });
      }
    };
  }
  public private(
    message: string,
    receiver?:
      | {
          channel: string;
          tell?: never;
        }
      | {
          channel?: never;
          tell: string;
        }
      | undefined
  ) {
    const { channel, tell } = receiver ?? {};

    let target = channel ? `#${channel}` : `@${tell}`;
    if (tell === undefined && channel === undefined) {
      target = `#${TWITCH_BROADCASTER.TWITCH_BROADCASTER_NAME}`;
    }

    if (this.websocket) {
      this.websocket.send(`PRIVMSG ${target} :${message}`);
    }
  }
}
