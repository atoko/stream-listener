import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  jest,
  test,
} from "@jest/globals";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach } from "node:test";
import { TWITCH_ENVIRONMENT } from "./environment.mts";

const mockedOpen = jest.fn();
const mockedWriteFileSync = jest.fn();

jest.unstable_mockModule("open", () => {
  return {
    __esModule: true,
    default: mockedOpen,
  };
});

jest.unstable_mockModule("fs", () => {
  return {
    __esModule: true,
    writeFileSync: mockedWriteFileSync,
  };
});

const open = await import("open");
const { TwitchOIDC } = await import("./oidc.mts");

describe("TwitchOIDC", () => {
  let tempdir: string;
  let fetch = globalThis.fetch;

  beforeAll(() => {
    tempdir = join(tmpdir(), "TwitchOIDC-bot");
    mkdirSync(tempdir, { recursive: true });
  });

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = fetch;
  });

  afterAll(() => {
    rmSync(tempdir, { recursive: true });
  });

  const setup = ({ scope }: { scope?: string } = {}) => {
    const mockState = `123456789-${scope}`;
    jest.spyOn(TwitchOIDC, "state").mockReturnValue(mockState);
    jest.spyOn(TwitchOIDC, "nonce").mockReturnValue("123456789");

    const oidc = new TwitchOIDC({
      kind: "bot",
      id: "123456789",
      name: "test-bot",
      scope: "chat:read chat:edit",
    });

    return {
      oidc,
      state: TwitchOIDC.state({
        userId: oidc.entity.id,
        scope: oidc.entity.scope,
      }),
      nonce: TwitchOIDC.nonce(),
    };
  };

  describe("Static methods", () => {
    test("filepath", () => {
      setup();
      const filepath = TwitchOIDC.filepath("bot");
      expect(filepath).toBe("./data/bot.json");
    });

    test("state", () => {
      const userId = "123456789";
      const scope = "chat:read chat:edit";

      const state = TwitchOIDC.state({
        userId,
        scope,
      });
      expect(state).toMatch(new RegExp(`^[a-z0-9]{9}-${userId}-${scope}$`));
    });

    test("nonce", () => {
      const nonce = TwitchOIDC.nonce();
      expect(nonce).toMatch(/^[a-z0-9]{9}$/);
    });
  });

  test("authorize", async () => {
    const client_id = TWITCH_ENVIRONMENT.TWITCH_CLIENT_ID;
    const redirect_uri = TWITCH_ENVIRONMENT.SERVER_REDIRECT_URL;
    const { oidc, state, nonce } = setup();
    await oidc.authorize();

    const url = `https://id.twitch.tv/oauth2/authorize?${Object.entries({
      client_id,
      response_type: "token",
      redirect_uri,
      state,
      nonce,
      scope: oidc.entity.scope,
    })
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join("&")}`;

    expect(open.default).toHaveBeenCalledWith(url);
  });

  describe("read", () => {
    test("read - success", async () => {
      const tempfile = join(tempdir, "TwitchOIDC-bot.json");
      jest.spyOn(TwitchOIDC, "filepath").mockReturnValue(tempfile);

      const access_token = "test-access-token";
      const refresh_token = "test-refresh-token";

      writeFileSync(
        tempfile,
        JSON.stringify({
          access_token,
          refresh_token,
        }),
      );

      const { oidc } = setup();
      const tokens = (await oidc.read()).default;

      expect(tokens).toMatchObject({
        access_token,
        refresh_token,
      });
    });

    test("read - throws", async () => {
      const tempfile = join(tempdir, "TwitchOIDC-bot.json");
      jest.spyOn(TwitchOIDC, "filepath").mockImplementation(() => {
        return tempfile;
      });

      const access_token = "test-access-token";
      const refresh_token = "test-refresh-token";

      writeFileSync(
        tempfile,
        JSON.stringify({
          access_token,
          refresh_token,
        }),
      );

      const { oidc } = setup();
      const tokens = (await oidc.read()).default;

      expect(tokens).toMatchObject({
        access_token,
        refresh_token,
      });
    });
  });

  describe("refresh", () => {
    test("refresh fails without refresh token", async () => {
      const { oidc } = setup();
      oidc.refreshToken = undefined;

      expect(await oidc.refresh()).toMatchObject({
        type: "error" as const,
        error: {
          message: "No refresh token available",
        } as const,
      });
    });

    test("refresh - response ok", async () => {
      const access_token = "abcd123";
      const refresh_token = "efgh456";

      const data = {
        access_token,
        refresh_token,
        expires_in: 9999,
      };

      // @ts-ignore
      globalThis.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(data),
        }),
      );

      const { oidc } = setup();
      oidc.accessToken = access_token;
      oidc.refreshToken = refresh_token;

      const url = [
        `https://id.twitch.tv/oauth2/token`,
        `?grant_type=refresh_token`,
        `&refresh_token=${oidc.refreshToken}`,
        `&client_id=${TWITCH_ENVIRONMENT.TWITCH_CLIENT_ID}`,
        `&client_secret=${TWITCH_ENVIRONMENT.TWITCH_CLIENT_SECRET}`,
      ].join("");

      const response = await oidc.refresh();

      expect(globalThis.fetch).toHaveBeenCalledWith(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      expect(response).toMatchObject({
        type: "data" as const,
        data,
        message: "Access token refreshed successfully",
      });
    });

    test("refresh - response 400", async () => {
      const access_token = "abcd123";
      const refresh_token = "efgh456";
      const data = {
        access_token,
        refresh_token,
        expires_in: 9999,
      };

      // @ts-ignore
      globalThis.fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          status: 400,
          json: () => Promise.resolve(data),
        }),
      );

      const { oidc } = setup();
      oidc.accessToken = access_token;
      oidc.refreshToken = refresh_token;

      const url = [
        `https://id.twitch.tv/oauth2/token`,
        `?grant_type=refresh_token`,
        `&refresh_token=${oidc.refreshToken}`,
        `&client_id=${TWITCH_ENVIRONMENT.TWITCH_CLIENT_ID}`,
        `&client_secret=${TWITCH_ENVIRONMENT.TWITCH_CLIENT_SECRET}`,
      ].join("");

      const response = await oidc.refresh();

      expect(globalThis.fetch).toHaveBeenCalledWith(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      expect(response).toMatchObject({
        type: "error" as const,
        known: "invalid_refresh_token" as const,
      });
    });

    test("refresh - response unknown", async () => {
      const access_token = "abcd123";
      const refresh_token = "efgh456";
      const data = {
        message: "known-error",
      };

      // @ts-ignore
      globalThis.fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          status: 405,
          json: () => Promise.resolve(data),
        }),
      );

      const { oidc } = setup();
      oidc.accessToken = access_token;
      oidc.refreshToken = refresh_token;

      const url = [
        `https://id.twitch.tv/oauth2/token`,
        `?grant_type=refresh_token`,
        `&refresh_token=${oidc.refreshToken}`,
        `&client_id=${TWITCH_ENVIRONMENT.TWITCH_CLIENT_ID}`,
        `&client_secret=${TWITCH_ENVIRONMENT.TWITCH_CLIENT_SECRET}`,
      ].join("");

      const response = await oidc.refresh();

      expect(globalThis.fetch).toHaveBeenCalledWith(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      expect(response).toMatchObject({
        type: "error" as const,
        unknown: data,
      });
    });

    test("refresh - unknown error", async () => {
      const access_token = "abcd123";
      const refresh_token = "efgh456";
      const data = {
        message: "unknown-error",
      };

      // @ts-ignore
      globalThis.fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          status: 405,
          json: () => Promise.reject(data),
        }),
      );

      const { oidc } = setup();
      oidc.accessToken = access_token;
      oidc.refreshToken = refresh_token;

      const url = [
        `https://id.twitch.tv/oauth2/token`,
        `?grant_type=refresh_token`,
        `&refresh_token=${oidc.refreshToken}`,
        `&client_id=${TWITCH_ENVIRONMENT.TWITCH_CLIENT_ID}`,
        `&client_secret=${TWITCH_ENVIRONMENT.TWITCH_CLIENT_SECRET}`,
      ].join("");

      const response = await oidc.refresh();

      expect(globalThis.fetch).toHaveBeenCalledWith(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      });

      expect(response).toMatchObject({
        type: "error" as const,
        error: { message: `Refresh token error: ${JSON.stringify(data)}` },
      });
    });
  });

  describe("TwitchOIDC.validate", () => {
    test("validate - 200 response", async () => {
      // @ts-ignore
      globalThis.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(data),
        }),
      );

      const data = {
        login: "abcd",
        scopes: ["chat:read", "chat:edit"],
        userId: "string",
      };

      // @ts-ignore
      globalThis.fetch = jest.fn(() =>
        Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(data),
        }),
      );

      const { oidc } = setup();
      oidc.accessToken = "test-access-token";
      oidc.refreshToken = "test-refresh-token";

      const response = await TwitchOIDC.validate({
        accessToken: oidc.accessToken,
      });

      expect(response).toMatchObject({
        type: "data" as const,
        data,
        message: `${data.login} with ${JSON.stringify(data.scopes)} scopes was successfully validated`,
      });
    });

    test("validate - invalid access token", async () => {
      const data = {
        message: "invalid access token",
      };

      // @ts-ignore
      globalThis.fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          status: 402,
          json: () => Promise.resolve(data),
        }),
      );

      const { oidc } = setup();
      oidc.accessToken = "test-access-token";
      oidc.refreshToken = "test-refresh-token";

      const response = await TwitchOIDC.validate({
        accessToken: oidc.accessToken,
      });

      expect(response).toMatchObject({
        type: "error" as const,
        known: "invalid_access_token" as const,
      });
    });

    test("validate - missing authorization token", async () => {
      const data = {
        message: "missing authorization token",
      };

      // @ts-ignore
      globalThis.fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          status: 404,
          json: () => Promise.resolve(data),
        }),
      );

      const { oidc } = setup();
      oidc.accessToken = "test-access-token";
      oidc.refreshToken = "test-refresh-token";

      const response = await TwitchOIDC.validate({
        accessToken: oidc.accessToken,
      });

      expect(response).toMatchObject({
        type: "error" as const,
        known: "missing_authorization_token" as const,
      });
    });

    test("validate - unknown error", async () => {
      const data = {
        message: "Invalid access token",
      };

      // @ts-ignore
      globalThis.fetch = jest.fn(() =>
        Promise.resolve({
          ok: false,
          status: 402,
          json: () => Promise.reject(data),
        }),
      );

      const { oidc } = setup();
      oidc.accessToken = "test-access-token";
      oidc.refreshToken = "test-refresh-token";

      const response = await TwitchOIDC.validate({
        accessToken: oidc.accessToken,
      });

      expect(response).toMatchObject({
        type: "error" as const,
        error: { message: `Validated token error: ${JSON.stringify(data)}` },
      });
    });
  });

  describe("write", () => {
    test("write - success", async () => {
      const tempfile = join(tempdir, "TwitchOIDC-bot.json");
      mockedWriteFileSync.mockImplementation(() => {
        return;
      });

      const access_token = "test-access-token";
      const refresh_token = "test-refresh-token";

      const { oidc } = setup();
      oidc.accessToken = access_token;
      oidc.refreshToken = refresh_token;

      const response = await oidc.write({
        access: oidc.accessToken,
        refresh: oidc.refreshToken,
      });

      expect(mockedWriteFileSync).toHaveBeenCalledWith(
        tempfile,
        JSON.stringify(
          {
            access_token: oidc.accessToken,
            refresh_token: oidc.refreshToken,
          },
          null,
          4,
        ),
      );

      expect(response).toMatchObject({
        type: "data",
        message: `${oidc.entity.kind} tokens successfully written to auth.json`,
      });
    });

    test("write - error", async () => {
      const tempfile = join(tempdir, "TwitchOIDC-bot.json");
      mockedWriteFileSync.mockImplementation(() => {
        throw new Error("Failed to write file");
      });

      const access_token = "test-access-token";
      const refresh_token = "test-refresh-token";

      const { oidc } = setup();
      oidc.accessToken = access_token;
      oidc.refreshToken = refresh_token;

      const response = await oidc.write({
        access: oidc.accessToken,
        refresh: oidc.refreshToken,
      });

      expect(mockedWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining(tempfile),
        expect.stringContaining(access_token),
      );

      expect(response).toMatchObject({
        type: "error",
      });
    });
  });
});
