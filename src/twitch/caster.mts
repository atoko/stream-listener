import { inspect } from "util";
import { TWITCH_ENVIRONMENT } from "./environment.mts";
import { TwitchOIDC } from "./oidc.mjs";
import type { TwitchIrcClient } from "./irc.mts";
import type { websocketServer } from "../http/websockets.mts";
import EventEmitter from "events";
import { WebSocket as WS } from "ws";
import { subscribe } from "./api/eventSub.mjs";

export type EventsubWelcomeMessage = {
  metadata: {
    message_id: string;
    message_type: "session_welcome";
    message_timestamp: string;
  };
  payload: {
    session: {
      id: string;
      status: "connected";
      connected_at: string;
      keepalive_timeout_seconds: number;
      reconnect_url: null;
    };
  };
};

export type EventsubKeepaliveMessage = {
  metadata: {
    message_id: string;
    message_type: "session_keepalive";
    message_timestamp: string;
  };
  payload: {};
};

export type EventsubNotificationMessage = {
  metadata: {
    message_id: string;
    message_type: "notification";
    message_timestamp: string;
    subscription_type: "";
  };
  payload: never;
};

export type EventsubMessage =
  | EventsubKeepaliveMessage
  | EventsubWelcomeMessage
  | EventsubNotificationMessage;

export class TwitchCasterClient extends EventEmitter {
  websocket: WS | null = null;
  interval: number;

  constructor(
    private oidc: TwitchOIDC | null = null,
    public readonly irc: TwitchIrcClient,
    private readonly server: ReturnType<typeof websocketServer>,
  ) {
    super();
  }

  async connect() {
    console.log(`[CASTER] Connecting to Twitch Eventsub`);
    this.websocket = new WS(TWITCH_ENVIRONMENT.TWITCH_EVENTSUB_WEBSOCKET_URL);
  }

  async keepalive(interval?: number) {
    if (interval) {
      this.interval = interval;
    }

    setTimeout(() => {
      this.websocket?.close();
    }, this.interval + 250);
  }

  async subscribe() {
    const { websocket, oidc } = this;

    if (!websocket) {
      throw new Error("[CASTER] Eventsub is not connected");
    }

    websocket.onerror = (e) => {
      console.error(`[CASTER] Eventsub error occurred ${inspect(e.message)}`);
    };

    websocket.onopen = function (event) {
      console.debug(`[CASTER] Eventsub websocket onopen`);
    };

    websocket.onclose = (event) => {
      console.log(
        `[CASTER] Eventsub connection closed ${inspect({
          code: event.code,
          reason: event.reason,
        })}`,
      );

      // setTimeout(() => {
      //   console.log(`[CASTER] Websocket closed, reconnecting Twitch IRC WebSocket...`);
      //   this.websocket = null;
      //
      //   this.connect();
      //   this.subscribe();
      // }, 5000);
    };

    websocket.onmessage = (event) => {
      const textData = event.data.toString();
      if (textData.includes("NOTICE")) {
        if (textData.includes("Login authentication failed")) {
          throw new Error(textData);
        }
      }

      const data = JSON.parse(
        event.data.toString(),
      ) as unknown as EventsubMessage;

      switch (data.metadata.message_type) {
        case "session_welcome":
          const session_welcome = data as EventsubWelcomeMessage;

          console.log(
            `[CASTER] Session Welcome: ${session_welcome.payload.session.id}`,
          );

          const { payload } = session_welcome;
          this.keepalive(
            session_welcome.payload.session.keepalive_timeout_seconds,
          );
          if (!this.oidc) {
            throw new Error("[CASTER] Oidc not initialized");
          }

          subscribe(
            this.oidc,
            "channel.channel_points_custom_reward_redemption.add",
            "1",
            payload.session.id,
          );

          break;
        case "session_keepalive":
          break;
        case "notification":
          const notification = data as EventsubNotificationMessage;

          // const parsedSubscription = {
          //   ...notification.payload.event,
          //   sub_type: notification.payload.subscription.type,
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
