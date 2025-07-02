import { env } from "node:process";
import EventEmitter from "events";

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
} as const;

export abstract class TwitchEnvironment {
  static isClientSecretSet() {
    return TWITCH_ENVIRONMENT.TWITCH_CLIENT_SECRET.trim() === "";
  }
}

export const SERVER_ENVIRONMENT = {
  SERVER_PORT: Number(env.SERVER_PORT ?? "3133"),
  SERVER_REDIRECT_URL:
    env.SERVER_REDIRECT_URL || `http://localhost:${env.SERVER_PORT}/authorize`,
  SERVER_CONFIGURATION_URL:
    env.SERVER_CONFIGURATION_URL ||
    `http://localhost:${env.SERVER_PORT}/configure`,
} as const;

export const TWITCH_BROADCASTER = {
  TWITCH_BROADCASTER_ID: env.TWITCH_BROADCASTER_ID || "",
  TWITCH_BROADCASTER_NAME: env.TWITCH_BROADCASTER_NAME || "broadcaster",
} as const;

export const TWITCH_BOT = {
  TWITCH_BOT_ID: env.TWITCH_BOT_ID || "twitch_bot",
  TWITCH_BOT_NAME: env.TWITCH_BOT_NAME || "twitch_bot",
} as const;

export const OIDC_CONFIGURATION = {
  OIDC_AUTHORIZE_LINK: env.OIDC_AUTHORIZE_LINK,
};
export abstract class OidcConfiguration {
  static isOidcHeadless = () => {
    return OIDC_CONFIGURATION.OIDC_AUTHORIZE_LINK !== undefined;
  };
}

export const CONFIGURATIONS = [
  "TWITCH",
  "CASTER",
  "BOT",
  "SERVER",
  "OIDC",
] as const;

export type Configuration = (typeof CONFIGURATIONS)[number];
export type ConfigurationData =
  | typeof TWITCH_ENVIRONMENT
  | typeof TWITCH_BROADCASTER
  | typeof TWITCH_BOT
  | typeof SERVER_ENVIRONMENT
  | typeof OIDC_CONFIGURATION;

export class EnvironmentSignals extends EventEmitter {
  public onTwitchEnvironment(input: Partial<typeof TWITCH_ENVIRONMENT>) {
    const clientId =
      input.TWITCH_CLIENT_ID !== TWITCH_ENVIRONMENT.TWITCH_CLIENT_ID;
    const clientSecret =
      input.TWITCH_CLIENT_SECRET !== TWITCH_ENVIRONMENT.TWITCH_CLIENT_SECRET;
    const changed = [clientId, clientSecret].some((change) => change);
    if (changed) {
      Object.assign(TWITCH_ENVIRONMENT, input);
    }
  }

  public onServerEnvironment(envs: Partial<typeof SERVER_ENVIRONMENT>) {
    Object.assign(SERVER_ENVIRONMENT, envs);
  }

  public onBroadcasterEnvironment(envs: Partial<typeof TWITCH_BROADCASTER>) {
    Object.assign(TWITCH_BROADCASTER, envs);
  }

  public onBotEnvironment(envs: typeof TWITCH_BROADCASTER) {
    Object.assign(TWITCH_BOT, envs);
  }
}
