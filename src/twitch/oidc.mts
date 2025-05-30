import open from "open";
import { TWITCH_ENVIRONMENT } from "./environment.mts";
import { writeFileSync } from "fs";
import { inspect } from "util";
import EventEmitter from "events";
import { existsSync, mkdirSync } from "node:fs";

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

  constructor(public entity: TwitchOIDCEntity) {
    super();
  }

  static filepath(entity: TwitchOIDCEntityKind) {
    return `${process.cwd()}/data/${entity}.json`;
  }

  static state({ userId, scope }: { userId?: string; scope?: string }) {
    return `${Math.random().toString(36).substring(2, 4)}-${userId ?? "unknown"}-${scope ?? "unknown"}`;
  }

  static nonce() {
    return Math.random().toString(36).substring(2, 15);
  }

  static async load(entity: TwitchOIDCEntity) {
    const oidc = new TwitchOIDC(entity);
    await oidc.read();

    if (!oidc.accessToken) {
      console.error("[OIDC] No access token found, authorizing");
      await oidc.authorize();
      return oidc;
    }

    const validation = await TwitchOIDC.validate({
      accessToken: oidc.accessToken,
    });

    if (validation.type === "error") {
      if (validation.known === "invalid_access_token") {
        console.warn("[OIDC] Invalid access token, refreshing");
        const refresh = await oidc.refresh();
        if (
          refresh.type === "error" &&
          refresh.known === "invalid_refresh_token"
        ) {
          console.error("[OIDC] Authorizing access token");
          await oidc.authorize();
        } else if (refresh.type === "data") {
          console.log("[OIDC] Access token refreshed successfully");
          if (refresh.data?.access_token) {
            oidc.accessToken = refresh.data.access_token;
          } else {
            console.error("[OIDC] No access token in refresh response");
          }
          oidc.refreshToken = refresh.data?.refresh_token;
        } else {
          console.warn(
            `[OIDC] Unknown error during refresh ${inspect(validation)}`,
          );
        }
      }
    }
    return oidc;
  }

  async read() {
    try {
      const data = await import(TwitchOIDC.filepath(this.entity.kind));
      this.accessToken = data.access_token;
      this.refreshToken = data.refresh_token;
      return data;
    } catch (e) {
      console.error(`[OIDC] No Twitch OIDC data: ${e}`);
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
        .join("&")}`,
    );
  }

  static async validate({ accessToken }: { accessToken: string }) {
    try {
      const response = await fetch("https://id.twitch.tv/oauth2/validate", {
        method: "GET",
        headers: { Authorization:  `OAuth ${accessToken}` },
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
          message: `${data.login} with ${JSON.stringify(data.scopes)} scopes was successfully validated`,
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
        },
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

  async write({ refresh, access }: { refresh?: string; access?: string }) {
    try {
      this.accessToken = access || this.accessToken;
      this.refreshToken = refresh || this.refreshToken;

      console.log(`[OIDC] Writing Twitch OIDC data: ${JSON.stringify(this)}`);
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
          4,
        ),
      );

      return {
        type: "data",
        access,
        refresh,
        message: `${this.entity.kind} tokens successfully written to auth.json`,
      };
    } catch (e) {
      return {
        type: "error",
        error: { message: `Write error: ${JSON.stringify(e)}` },
      };
    }
  }
}
