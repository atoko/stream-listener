import { WebSocketServer } from "ws";
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
    ws.on("message", (message) => {});
  });

  return {
    clients: () => wss.clients,
    close: async () => {
      wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.close(1000);
        }
      });
      wss.close();
    },
    withIrc: (irc: TwitchIrcClient) => {
      ircClient = irc;
    },
  };
}
