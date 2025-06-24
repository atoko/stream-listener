import { WebSocketServer } from "ws";
import type { LocksActionCommandMessage } from "../chat/locks/receiver.mts";
import { chatReceiver } from "../chat/receiver.mts";
import { httpServer } from "./server.mts";
import type { TwitchIrcClient } from "../twitch/irc.mts";
import { Logger } from "../logging.mjs";

export type WebSocketServerProps = {
  http: ReturnType<typeof httpServer>;
  ircClient?: TwitchIrcClient;
};

export function websocketServer(props: WebSocketServerProps) {
  const { http } = props;
  const { server } = http;
  let { ircClient } = props;
  const wss = new WebSocketServer({ server });
  wss.on("connection", (ws) => {
    Logger.info("WebSocket connection established");

    ws.on("message", (message) => {
      const command: LocksActionCommandMessage = JSON.parse(
        message.toString(),
      ) as unknown as LocksActionCommandMessage;
      const outbox = chatReceiver(command);
      if (ircClient && Array.isArray(outbox)) {
        ircClient.private(JSON.stringify(outbox));
      }
    });
  });

  return {
    clients: () => wss.clients,
    withIrc: (irc: TwitchIrcClient) => {
      ircClient = irc;
    },
  };
}
