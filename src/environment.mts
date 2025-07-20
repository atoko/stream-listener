import { env } from "node:process";

export const TWITCH_ENVIRONMENT = {
  TWITCH_CLIENT_ID: env.TWITCH_CLIENT_ID || "",
  TWITCH_CLIENT_SECRET: env.TWITCH_CLIENT_SECRET || "",
  TWITCH_IRC_WEBSOCKET_URL:
    env.TWITCH_IRC_WEBSOCKET_URL || "wss://irc-ws.chat.twitch.tv:443",
  TWITCH_EVENTSUB_KEEPALIVE_TIMEOUT_MS:
    Number(env.TWITCH_EVENTSUB_KEEPALIVE_TIMEOUT_MS) || 6000,
  TWITCH_EVENTSUB_WEBSOCKET_URL:
    `wss://eventsub.wss.twitch.tv/ws?keepalive_timeout_seconds=${
      env.TWITCH_EVENTSUB_KEEPALIVE_TIMEOUT_SECONDS || 60
    }` as string,
  TWITCH_EVENTSUB_HTTP_URL: `https://api.twitch.tv/helix` as string,
} as const;

export abstract class TwitchEnvironment {
  static isClientSecretEmpty() {
    return TWITCH_ENVIRONMENT.TWITCH_CLIENT_SECRET.trim() === "";
  }
}

export const SERVICE_ENVIRONMENT = {
  SERVER_PORT: Number(
    process.env.SERVER_PORT === "" ? "3133" : env.SERVER_PORT ?? "3133"
  ),
  SERVER_REDIRECT_URL:
    env.SERVER_REDIRECT_URL ||
    `http://localhost:${env.SERVER_PORT}/~oidc/authorize`,
  SERVER_CONFIGURATION_URL:
    env.SERVER_CONFIGURATION_URL ||
    `http://localhost:${env.SERVER_PORT}/server/configure`,
} as const;

export const TWITCH_BROADCASTER = {
  TWITCH_BROADCASTER_ID: env.TWITCH_BROADCASTER_ID || "",
  TWITCH_BROADCASTER_NAME: env.TWITCH_BROADCASTER_NAME || "broadcaster",
  TWITCH_BROADCASTER_SCOPE:
    env.TWITCH_BROADCASTER_SCOPE || "chat:read chat:edit",
} as const;

export const TWITCH_BOT = {
  TWITCH_BOT_ID: env.TWITCH_BOT_ID || "",
  TWITCH_BOT_NAME: env.TWITCH_BOT_NAME || "twitch_bot",
  TWITCH_BOT_SCOPE: env.TWITCH_BOT_SCOPE || "chat:read chat:edit",
  TWITCH_BOT_CHANNEL: env.TWITCH_BOT_CHANNEL || "",
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
  "SERVICE",
  "OIDC",
] as const;

export type Configuration = (typeof CONFIGURATIONS)[number];
export type ConfigurationData =
  | typeof TWITCH_ENVIRONMENT
  | typeof TWITCH_BROADCASTER
  | typeof TWITCH_BOT
  | typeof SERVICE_ENVIRONMENT
  | typeof OIDC_CONFIGURATION;

export const coalesce = (varchar: string | null | undefined, value: string) => {
  if (!varchar || varchar.trim().length === 0) {
    return value;
  }
  return varchar;
};

export class ConfigurationEvents {
  public onTwitchEnvironment(input: Partial<typeof TWITCH_ENVIRONMENT>) {
    const clientId =
      input.TWITCH_CLIENT_ID !== TWITCH_ENVIRONMENT.TWITCH_CLIENT_ID;
    const clientSecret =
      input.TWITCH_CLIENT_SECRET !== TWITCH_ENVIRONMENT.TWITCH_CLIENT_SECRET;
    const esHttpUrl =
      input.TWITCH_EVENTSUB_HTTP_URL !==
      TWITCH_ENVIRONMENT.TWITCH_EVENTSUB_HTTP_URL;
    const esWebSocketUrl =
      input.TWITCH_EVENTSUB_WEBSOCKET_URL !==
      TWITCH_ENVIRONMENT.TWITCH_EVENTSUB_WEBSOCKET_URL;
    const esKeepaliveMs =
      input.TWITCH_EVENTSUB_KEEPALIVE_TIMEOUT_MS !==
      TWITCH_ENVIRONMENT.TWITCH_EVENTSUB_KEEPALIVE_TIMEOUT_MS;
    const ircWebsocketUrl =
      input.TWITCH_IRC_WEBSOCKET_URL !==
      TWITCH_ENVIRONMENT.TWITCH_IRC_WEBSOCKET_URL;

    const changed = [
      clientId,
      clientSecret,
      esHttpUrl,
      esWebSocketUrl,
      esKeepaliveMs,
      ircWebsocketUrl,
    ].some((change) => change);
    if (changed) {
      Object.assign(TWITCH_ENVIRONMENT, input);
    }
  }
  public onServiceEnvironment(input: { SERVER_URL: string | undefined }) {
    const serverUrl = `http://${coalesce(input.SERVER_URL, "localhost:3133")}`;
    const redirectUrl =
      SERVICE_ENVIRONMENT.SERVER_REDIRECT_URL !== `${serverUrl}/oidc/authorize`
        ? `${serverUrl}/oidc/authorize`
        : SERVICE_ENVIRONMENT.SERVER_REDIRECT_URL;
    const configurationUrl =
      SERVICE_ENVIRONMENT.SERVER_CONFIGURATION_URL !== `${serverUrl}/configure`
        ? `${serverUrl}/configure`
        : SERVICE_ENVIRONMENT.SERVER_CONFIGURATION_URL;

    Object.assign(SERVICE_ENVIRONMENT, {
      SERVER_PORT: new URL(serverUrl).port,
      SERVER_REDIRECT_URL: redirectUrl,
      SERVER_CONFIGURATION_URL: configurationUrl,
    });
  }

  public onBroadcasterEnvironment(input: Partial<typeof TWITCH_BROADCASTER>) {
    Object.assign(TWITCH_BROADCASTER, {
      TWITCH_BROADCASTER_ID: input.TWITCH_BROADCASTER_ID,
      TWITCH_BROADCASTER_NAME: input.TWITCH_BROADCASTER_NAME,
      TWITCH_BROADCASTER_SCOPE: input.TWITCH_BROADCASTER_SCOPE,
    });
  }

  public onBotEnvironment(input: Partial<typeof TWITCH_BOT>) {
    Object.assign(TWITCH_BOT, {
      TWITCH_BOT_ID: input.TWITCH_BOT_ID,
      TWITCH_BOT_NAME: input.TWITCH_BOT_NAME,
      TWITCH_BOT_SCOPE: input.TWITCH_BOT_SCOPE,
      TWITCH_BOT_CHANNEL: input.TWITCH_BOT_CHANNEL,
    });
  }
}
