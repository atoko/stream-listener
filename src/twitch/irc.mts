import {
  TWITCH_BOT,
  TWITCH_BROADCASTER,
  TWITCH_ENVIRONMENT,
} from "../environment.mjs";
import { TwitchOIDC } from "./oidc.mjs";
import { Logger } from "../logging.mjs";
import VError from "verror";
import type { Container } from "../container.mjs";
import type { PluginCollection } from "../plugins.mjs";

const logger = Logger.child().withPrefix("[IRC]");

export class TwitchIrcClient {
  websocket: WebSocket | null = null;
  plugins: PluginCollection;
  private closed: boolean = false;

  constructor(
    protected oidc: TwitchOIDC,
    { plugins }: Pick<Container, "plugins">
  ) {
    this.plugins = plugins;
  }

  static WELCOME_MESSAGES = ["001", "002", "003", "004", "375", "372", "376"];

  static isWelcomeMessage(message: string) {
    return message.split("\n").every((line, index) => {
      return line.includes(this.WELCOME_MESSAGES[index]);
    });
  }

  static isPingMessage(message: string) {
    return message.startsWith("PING :tmi.twitch.tv");
  }

  static isAuthenticationError(message: string) {
    return message.includes(
      ":tmi.twitch.tv NOTICE * :Login authentication failed"
    );
  }

  async connect() {
    logger.info(`Connecting to Twitch IRC WebSocket`);
    this.websocket = new WebSocket(TWITCH_ENVIRONMENT.TWITCH_IRC_WEBSOCKET_URL);
    await new Promise((resolve) => {
      setTimeout(resolve, 750);
    });
  }

  subscribe() {
    if (!this.websocket) {
      throw new VError("WebSocket is not connected");
    }

    this.websocket.onclose = (event) => {
      logger
        .withMetadata({
          code: event.code,
          reason: event.reason,
          closed: this.closed,
        })
        .info(`WebSocket connection closed`);

      if (this.closed) {
        return;
      }

      setTimeout(async () => {
        logger.info("Reconnecting to IRC...");
        this.websocket = null;

        await this.connect();
        this.subscribe();
      }, 5000);
    };

    this.websocket.onopen = this.open;

    this.websocket.onmessage = (event: MessageEvent) => {
      const message = event.data
        .toString()
        .normalize("NFKC")
        .replace(/\uDB40\uDC00/g, "")
        .trim();

      if (TwitchIrcClient.isWelcomeMessage(message)) {
        logger
          .withMetadata({
            message: message.split("\n").pop(),
          })
          .info(`Received welcome message`);
      } else if (TwitchIrcClient.isPingMessage(message)) {
        logger
          .withMetadata({
            message,
          })
          .info(`Received PING message: ${message}`);
        this.websocket?.send("PONG :tmi.twitch.tv");
      } else if (TwitchIrcClient.isAuthenticationError(message)) {
        logger.info(`Received authentication failure message: ${message}`);

        TwitchOIDC.validate({
          accessToken: this.oidc.accessToken,
        }).then((response) => {
          if (response.type === "data") {
            logger.info("Access token is valid, re-subscribing...");

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
  public async close() {
    this.closed = true;
    this.websocket?.close(1012);
  }

  private async open() {
    if (this.closed) {
      logger.warn("Connection closed, skipping irc open()");
      return;
    }

    logger.info("Opening irc connection");
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(`PASS oauth:${this.oidc?.accessToken}`);
      this.websocket.send(`NICK ${TWITCH_BOT.TWITCH_BOT_NAME}`);
      this.websocket.send(
        `JOIN #${TWITCH_BROADCASTER.TWITCH_BROADCASTER_NAME}`
      );
      logger.debug("WebSocket connection opened");
    } else {
      logger.warn("Websocket not initialized, retrying");
      if (!this.closed) {
        await new Promise(() => {
          setTimeout(async () => {
            await this.open();
          }, 1000);
        });
      }
    }
  }
}
