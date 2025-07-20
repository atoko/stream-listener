import {
  TWITCH_BOT,
  TWITCH_BROADCASTER,
  TWITCH_ENVIRONMENT,
} from "../configuration.mjs";
import { TwitchOIDC } from "./oidc.mjs";
import { Logger } from "../logging.mjs";
import VError from "verror";
import type { Container } from "../container.mjs";
import type { PluginCollection } from "../plugins.mjs";
import type { HttpServer } from "../http/server.mjs";
import { parentPort } from "node:worker_threads";
import type { WorkerContext } from "../worker.mjs";
import { type ParsedMessage, parseIrcMessage } from "./irc/parse/message.mjs";

const logger = Logger.child().withPrefix("[IRC]");

export type IrcInputMessage = { IrcInput: { message?: ParsedMessage } };
export type ChatInputMessage = { ChatInput: { message?: string } };

export class TwitchIrcClient {
  websocket: WebSocket | null = null;
  plugins: PluginCollection;
  worker: WorkerContext;

  private opened: boolean = false;
  private closed: boolean = false;

  constructor(
    protected oidc: TwitchOIDC,
    protected http: HttpServer,
    { plugins, worker }: Pick<Container, "plugins" | "worker">
  ) {
    this.plugins = plugins;
    this.worker = worker;
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
    return (
      message.includes(
        ":tmi.twitch.tv NOTICE * :Login authentication failed"
      ) || message.includes(":tmi.twitch.tv NOTICE * :Login unsuccessful")
    );
  }

  private onHttpOutput() {
    this.http.streams.chat.output.on("data", (data) => {
      const parsed = JSON.parse(data);
      if (typeof parsed === "string") {
        return;
      }

      const { ChatInput } = (parsed as ChatInputMessage) ?? {};

      if (ChatInput && ChatInput.message) {
        if (this.worker.thread.startsWith("main")) {
          this.worker.workers.forEach((worker) => {
            worker?.postMessage({
              ChatInput: ChatInput,
            } as ChatInputMessage);
          });
        } else if (this.worker.thread.startsWith("worker")) {
          this.private(ChatInput.message);
          parentPort?.postMessage({
            IrcInput: {
              message: {
                command: {
                  type: "chat",
                  command: "PRIVMSG",
                },
                source: {
                  nick: TWITCH_BOT.TWITCH_BOT_NAME,
                  host: `${TWITCH_BOT.TWITCH_BOT_NAME}@${TWITCH_BROADCASTER.TWITCH_BROADCASTER_NAME}.tmi.twitch.tv`,
                },
                parameters: ChatInput.message,
                tags: {},
              },
            },
          } as IrcInputMessage);
        }
      }
    });
  }

  private onWorkerMessage() {
    const writeToInput = (data: unknown) => {
      const IrcInputMessage = (data as Partial<IrcInputMessage>).IrcInput;
      const { message: input } = IrcInputMessage ?? {};
      if (input) {
        this.http.streams.irc.input.write(JSON.stringify(input));
      }

      const output = (data as Partial<ChatInputMessage>) ?? {};
      if (output.ChatInput) {
        this.http.streams.chat.input.write(JSON.stringify(output));
      }
    };

    parentPort?.on("message", writeToInput);

    this.worker.workers.forEach((worker) => {
      worker.on("message", writeToInput);
    });
  }

  setupEventHandlers() {
    this.onHttpOutput();
    this.onWorkerMessage();
  }

  async connect() {
    logger.info(`Connecting to Twitch IRC WebSocket`);
    this.opened = false;
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
        logger.info("Reconnecting to IRC");
        this.websocket = null;
        this.opened = false;

        await this.connect();
        this.subscribe();
      }, 5000);
    };

    this.websocket.onmessage = (event: MessageEvent) => {
      (async () => {
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

          const response = await TwitchOIDC.validate({
            accessToken: await this.oidc.readAccessToken(),
          });
          if (response.type !== "data") {
            logger.info(
              "Access token is no longer valid, requesting new token and subscribing"
            );
            const token = await this.oidc.refresh();
            if (token.data) {
              this.oidc.write({
                access: token.data.access_token,
                refresh: token.data.refresh_token,
              });
            } else {
              logger
                .withMetadata({
                  token,
                })
                .warn("Could not retrieve token");
            }
          }
          logger.info("Resubscribing websocket handlers");
          this.subscribe();
        } else {
          const parsed = parseIrcMessage(message);
          if (this.worker.thread.startsWith("main")) {
            this.worker.workers.forEach((worker) => {
              worker.postMessage({
                IrcInput: {
                  message: parsed,
                },
              } as IrcInputMessage);
            });
          } else {
            parentPort?.postMessage({
              IrcInput: {
                message: parsed,
              },
            } as IrcInputMessage);
            this.http.streams.irc.input.write(JSON.stringify(parsed));
          }
        }
      })().then();
    };

    logger.debug("Subscribed event handlers");

    if (this.websocket.readyState === WebSocket.OPEN) {
      this.open().then();
    }
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

    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      this.websocket.send(`PRIVMSG ${target} :${message}`);
    } else {
      logger
        .withMetadata({
          target,
        })
        .warn(`Websocket not connected while sending message`);
    }
  }
  public async close() {
    this.closed = true;
    this.websocket?.close(1012);
  }

  private async open() {
    if (this.closed) {
      logger.warn("Connection closed, skipping irc open");
      return;
    }

    if (this.opened) {
      return;
    }

    logger.info("Opening irc connection");
    if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
      let channel = TWITCH_BOT.TWITCH_BOT_CHANNEL;
      if (channel.trim().length === 0) {
        channel = TWITCH_BOT.TWITCH_BOT_NAME;
      }

      this.websocket.send(`PASS oauth:${await this.oidc.readAccessToken()}`);
      this.websocket.send(`NICK ${TWITCH_BOT.TWITCH_BOT_NAME}`);
      this.websocket.send(`CAP REQ :twitch.tv/tags`);
      await new Promise<void>((resolve) => {
        setTimeout(async () => {
          resolve();
        }, 500 + Math.random() * 200);
      });
      this.websocket.send(`JOIN #${channel}`);
      this.opened = true;
      logger.debug("WebSocket connection opened");
    } else {
      logger.warn("Websocket not initialized, retrying");
      if (!this.closed) {
        await new Promise<void>((resolve) => {
          setTimeout(async () => {
            resolve();
          }, Math.random() * 500 + 400);
        });
        await this.open();
      }
    }
  }
}
