import open from "open";
import { TWITCH_ENVIRONMENT } from "./environment.mts";
import { writeFileSync } from "fs";
import EventEmitter from "events";
import { mkdirSync } from "node:fs";
import { Logger } from "../logging.mjs";
import { MessageChannel } from "node:worker_threads";
import { once } from "node:events";

export const TwitchOIDCEntityKinds = ["bot", "caster"] as const;
export type TwitchOIDCEntityKind = (typeof TwitchOIDCEntityKinds)[number];
export type TwitchOIDCEntity = {
  kind: TwitchOIDCEntityKind;
  id: string;
  name: string;
  scope: string;
};
export type TwitchOIDCAuthenticateEvent = {
  access: string;
  refresh: string;
};

export class TwitchOIDC extends EventEmitter {
  public accessToken: string;
  public refreshToken: string | undefined = undefined;
  public messageChannel: MessageChannel = new MessageChannel();

  constructor(public entity: TwitchOIDCEntity) {
    super();
  }

  static filepath(entity: TwitchOIDCEntityKind) {
    return `${process.cwd()}/data/${entity}.json`;
  }

  static state({ userId, scope }: { userId?: string; scope?: string }) {
    return `${Math.random().toString(36).substring(0, 9)}-${
      userId ?? "unknown"
    }-${scope ?? "unknown"}`;
  }

  static nonce() {
    return Math.random().toString(36).substring(0, 15);
  }

  static async load(entity: TwitchOIDCEntity) {
    const oidc = new TwitchOIDC(entity);
    once(oidc, "listening").then(async () => {
      await oidc.read();

      if (!oidc.accessToken) {
        Logger.withMetadata({
          entity,
          oidc,
        }).error("[OIDC] No access token found, authorizing");

        await oidc.authorize();
        return;
      }

      const validation = await TwitchOIDC.validate({
        accessToken: oidc.accessToken,
      });

      if (validation.type === "error") {
        if (validation.known === "invalid_access_token") {
          Logger.withMetadata({
            validation,
          }).warn("[OIDC] Invalid access token, refreshing");

          const refresh = await oidc.refresh();

          if (
            refresh.type === "error" &&
            refresh.known === "invalid_refresh_token"
          ) {
            Logger.withMetadata({
              refresh,
            }).error("[OIDC] Invalid access token, refreshing");

            await oidc.authorize();
          } else if (refresh.type === "data") {
            Logger.info("[OIDC] Access token refreshed successfully");

            if (refresh.data?.access_token) {
              oidc.accessToken = refresh.data.access_token;
            } else {
              Logger.withMetadata({
                oidc,
              }).error("[OIDC] No access token in refresh response");
            }
            oidc.refreshToken = refresh.data?.refresh_token;
          } else {
            Logger.withMetadata({
              validation,
            }).warn(`[OIDC] Unknown error during refresh`);
          }
        }
      }
    });

    return oidc;
  }

  async read() {
    try {
      const data = await import(TwitchOIDC.filepath(this.entity.kind));
      this.accessToken = data.access_token;
      this.refreshToken = data.refresh_token;
      return data;
    } catch (e) {
      Logger.withError(e).error(`[OIDC] No Twitch OIDC data`);
    }
  }

  async authorize() {
    const userId = this.entity.id;

    const state = TwitchOIDC.state({ userId, scope: this.entity.scope });
    const nonce = TwitchOIDC.nonce();

    await open(
      `https://id.twitch.tv/oauth2/authorize?${Object.entries({
        client_id: TWITCH_ENVIRONMENT.TWITCH_CLIENT_ID,
        response_type: "code",
        redirect_uri: TWITCH_ENVIRONMENT.SERVER_REDIRECT_URL,
        state,
        nonce,
        scope: this.entity.scope,
      })
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join("&")}`
    );
  }

  static async validate({ accessToken }: { accessToken: string }) {
    try {
      const response = await fetch("https://id.twitch.tv/oauth2/validate", {
        method: "GET",
        headers: { Authorization: `OAuth ${accessToken}` },
      });

      const data = (await response.json()) as {
        login: string;
        scopes: string[];
        userId: string;
      } & { message?: string };

      if (response.ok) {
        return {
          type: "data" as const,
          data,
          message: `${data.login} with ${JSON.stringify(
            data.scopes
          )} scopes was successfully validated`,
        } as const;
      } else {
        const { message } = data;
        if (typeof message === "string") {
          if (message === "invalid access token") {
            return {
              type: "error" as const,
              known: "invalid_access_token" as const,
            } as const;
          }
          if (message === "missing authorization token") {
            return {
              type: "error" as const,
              known: "missing_authorization_token" as const,
            };
          }
        }
      }
      return { type: "error" as const, unknown: data } as const;
    } catch (e) {
      return {
        type: "error" as const,
        error: { message: `Validated token error: ${JSON.stringify(e)}` },
      } as const;
    }
  }

  static async token({
    code,
    redirect_uri,
  }: {
    code: string;
    redirect_uri: string;
  }) {
    const response = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: TWITCH_ENVIRONMENT.TWITCH_CLIENT_ID,
        client_secret: TWITCH_ENVIRONMENT.TWITCH_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri,
      }).toString(),
    });

    if (!response.ok) {
      const data = await response.json();
      return {
        type: "error" as const,
        unknown: data,
      };
    }

    const data = (await response.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    return {
      type: "data" as const,
      data,
    };
  }

  async refresh() {
    if (!this.refreshToken) {
      return {
        type: "error" as const,
        error: { message: "No refresh token available" } as const,
      } as const;
    }

    try {
      const response = await fetch(
        [
          `https://id.twitch.tv/oauth2/token`,
          `?grant_type=refresh_token`,
          `&refresh_token=${this.refreshToken}`,
          `&client_id=${TWITCH_ENVIRONMENT.TWITCH_CLIENT_ID}`,
          `&client_secret=${TWITCH_ENVIRONMENT.TWITCH_CLIENT_SECRET}`,
        ].join(""),
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
        }
      );

      const data = (await response.json()) as {
        access_token: string;
        refresh_token: string;
        expires_in: number;
      } & { message?: string };

      if (response.ok) {
        return {
          type: "data" as const,
          data,
          message: "Access token refreshed successfully",
        } as const;
      } else {
        if (response.status === 400) {
          return {
            type: "error" as const,
            known: "invalid_refresh_token" as const,
          };
        }

        return {
          type: "error",
          unknown: data,
        };
      }
    } catch (e) {
      return {
        type: "error" as const,
        error: { message: `Refresh token error: ${JSON.stringify(e)}` },
      } as const;
    }
  }

  public write = ({
    refresh,
    access,
  }: {
    refresh?: string;
    access?: string;
  }) => {
    try {
      this.accessToken = access || this.accessToken;
      this.refreshToken = refresh || this.refreshToken;

      Logger.info(`[OIDC] Writing Twitch OIDC data`);

      this.emit("authenticated", {
        access,
        refresh,
      });

      const filepath = TwitchOIDC.filepath(this.entity.kind);
      try {
        const folderpath = filepath.split("/");
        folderpath.pop();
        mkdirSync(folderpath.join("/"), {
          recursive: true,
        });
      } catch (e) {}

      writeFileSync(
        filepath,
        JSON.stringify(
          {
            access_token: this.accessToken,
            refresh_token: this.refreshToken,
          },
          null,
          4
        )
      );

      return {
        type: "data",
        access,
        refresh,
        filepath,
      };
    } catch (e) {
      return {
        type: "error",
        error: { message: `Write error: ${JSON.stringify(e)}` },
      };
    }
  };
}
