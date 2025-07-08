import { createServer } from "http";
import { TwitchOIDC } from "../twitch/oidc.mts";
import { extname, join, dirname } from "path";
import { readFile, stat } from "fs";
import { authorize } from "./routes/authorize.mjs";
import { PluginInstance } from "../chat/PluginInstance.mjs";
import { parsePath } from "ufo";
import VError from "verror";
import { URLSearchParams } from "node:url";
import { Logger } from "../logging.mjs";
import { twitch } from "./routes/configure/twitch.mjs";
import { OidcConfiguration, SERVICE_ENVIRONMENT } from "../environment.mjs";
import open from "open";
import type { Container } from "../container.mjs";
import { service } from "./routes/configure/service.mjs";
import { frontend } from "./routes/configure/index.mjs";
import { broadcaster } from "./routes/configure/broadcaster.mjs";
import { bot } from "./routes/configure/bot.mjs";

const PUBLIC_DIR = join(dirname(import.meta.url), "..", "..", "public");
const INDEX_FILE = join(PUBLIC_DIR, "index.html");

const logger = Logger.child().withPrefix("[SERVER]");

export type Sec = {
  fetchDest: "iframe" | "empty" | "script" | "worker";
};

export type HttpServerOptions = {
  entities: TwitchOIDC[];
  container: Container;
};

export function httpServer({ entities, container }: HttpServerOptions) {
  const { plugin, worker } = container;
  const server = createServer(async (readable, res) => {
    const url = new URL(readable.url!, `http://${readable.headers.host}`);
    const sec = {
      fetchDest: readable.headers["sec-fetch-dest"] as Sec["fetchDest"],
    };

    const method = readable.method as "POST" | "GET";
    const { pathname, search } = parsePath(url.pathname);
    const state = url.searchParams.get("state");
    const userId = state?.split("-")[1];
    const code = url.searchParams.get("code");

    if (pathname === ".well-known/healthcheck") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      return res.end("OK");
    }

    if (pathname.startsWith("/plugin/")) {
      const name = (() => {
        const path = pathname.split("/");
        path.shift();

        const plugin = path.shift();

        if (plugin === undefined) {
          throw new VError(
            {
              info: {
                url,
              },
            },
            "Plugin path undefined"
          );
        }
        return plugin;
      })();

      const params = new URLSearchParams(search);

      if (plugin.reducer === undefined) {
        plugin.reducer = await PluginInstance.load(name, {
          reducer:
            params.get("reducer") ??
            (() => {
              throw new VError(
                {
                  info: {
                    params,
                    name,
                    url,
                  },
                },
                "Search param 'reducer' is required"
              );
            })(),
        });

        await plugin.reducer.initialize();
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(plugin.reducer.read(), null, 4));
    }

    // Authentication
    if (pathname === "/" && code) {
      logger
        .withMetadata({
          userId,
          code,
        })
        .info(`[SERVER] Twitch authentication code received`);

      return;
    }

    if (pathname === "/oidc/authorize") {
      const scope = state?.split("-")[2];

      return await authorize(res)({
        code,
        userId,
        entities,
        scope,
      });
    }

    if (
      pathname.startsWith("/configure") &&
      (method === "POST" || method === "GET")
    ) {
      const endpoint = pathname.split("/").at(2) ?? "";
      switch (endpoint) {
        case "service":
          return await service(res)({
            method,
            readable,
            sec,
            ...container,
          });
        case "twitch":
          return await twitch(res)({
            method,
            readable,
            sec,
            ...container,
          });
        case "broadcaster":
          return await broadcaster(res)({
            method,
            readable,
            sec,
            ...container,
          });
        case "bot":
          return await bot(res)({
            method,
            readable,
            sec,
            ...container,
          });
        default:
          return frontend(res)({
            endpoint,
            method,
            ...container,
          });
      }
    }

    let filePath =
      readable.url === "/" ? INDEX_FILE : join(PUBLIC_DIR, readable.url || "");
    const ext = extname(filePath);

    if (!filePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403, { "Content-Type": "text/html" });
      return res.end(`<h1>403 Forbidden</h1>`);
    }

    return stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        res.writeHead(404, { "Content-Type": "text/html" });
        return res.end("<h1>404 Not Found</h1>");
      }

      const mimeTypes: { [key: string]: string } = {
        ".html": "text/html",
        ".js": "text/javascript",
        ".css": "text/css",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".gif": "image/gif",
        ".json": "application/json",
        ".ico": "image/x-icon",
      };

      const contentType = mimeTypes[ext] || "application/octet-stream";

      return readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(500, { "Content-Type": "text/html" });
          return res.end("<h1>500 Internal Server Error</h1>");
        }

        res.writeHead(200, { "Content-Type": contentType });
        return res.end(data);
      });
    });
  });

  return {
    server,
    listen: () => {
      const port = SERVICE_ENVIRONMENT.SERVER_PORT;
      server.listen(port, () => {
        logger
          .withMetadata({
            port,
          })
          .info("HTTP server listening");
      });
    },
    close: async () => {
      if (server.listening) {
        server.closeAllConnections();
        server.close();
      } else {
        throw new VError("HTTP server closed");
      }
    },
    configuration: {
      open: async () => {
        const url = SERVICE_ENVIRONMENT.SERVER_CONFIGURATION_URL;
        const { open: configurationOpened } = worker;

        if (configurationOpened || OidcConfiguration.isOidcHeadless()) {
          logger.info(`Please configure at the following link: ${url}`);
        } else {
          logger.debug("Opening configuration");
          await open(url);
        }
      },
    },
  };
}
