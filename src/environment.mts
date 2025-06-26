import { env } from "node:process";

export const TWITCH_ENVIRONMENT = {
  TWITCH_CLIENT_ID: env.TWITCH_CLIENT_ID || "",
  TWITCH_CLIENT_SECRET: env.TWITCH_CLIENT_SECRET || "",
  TWITCH_IRC_WEBSOCKET_URL:
    env.TWITCH_IRC_WEBSOCKET_URL || "wss://irc-ws.chat.twitch.tv:443",
  TWITCH_EVENTSUB_KEEPALIVE_TIMEOUT_MS:
    Number(env.TWITCH_EVENTSUB_KEEPALIVE_TIMEOUT_MS) || 6000,
  TWITCH_EVENTSUB_WEBSOCKET_URL: `wss://eventsub.wss.twitch.tv/ws?keepalive_timeout_seconds=${
    env.TWITCH_EVENTSUB_KEEPALIVE_TIMEOUT_SECONDS || 60
  }`,
  TWITCH_EVENTSUB_HTTP_URL: `https://api.twitch.tv/helix`,
  SERVER_PORT: Number(env.SERVER_PORT ?? "3133"),
  SERVER_REDIRECT_URL:
    env.SERVER_REDIRECT_URL ||
    `http://localhost:${env.SERVER_PORT ?? "3133"}/authorize`,
};

export const TWITCH_BROADCASTER = {
  TWITCH_BROADCASTER_ID: env.TWITCH_BROADCASTER_ID || "",
  TWITCH_BROADCASTER_NAME: env.TWITCH_BROADCASTER_NAME || "broadcaster",
};

export const TWITCH_BOT = {
  TWITCH_BOT_ID: env.TWITCH_BOT_ID || "twitch_bot",
  TWITCH_BOT_NAME: env.TWITCH_BOT_NAME || "twitch_bot",
};

export const CONFIGURATION = {
  OIDC_AUTHORIZE_LINK: env.OIDC_AUTHORIZE_LINK || "false",
};
