import { createServer } from "http";
import { TwitchOIDC } from "../twitch/oidc.mts";
import { extname, join, dirname } from "path";
import { readFile, stat } from "fs";
import { authorize } from "./routes/oidc/authorize.mjs";
import { parseURL } from "ufo";
import { Logger } from "../logging.mjs";
import { twitch } from "./routes/configure/twitch.mjs";
import {
  OidcConfiguration,
  PLUGIN_CONFIGURATION,
  SERVICE_ENVIRONMENT,
} from "../configuration.mjs";
import open from "open";
import type { Container } from "../container.mjs";
import { service } from "./routes/configure/service.mjs";
import { configure } from "./routes/configure/index.mjs";
import { broadcaster } from "./routes/configure/broadcaster.mjs";
import { bot } from "./routes/configure/bot.mjs";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { instance, plugincollection } from "./routes/plugins/index.mjs";
import { randomUUID } from "node:crypto";
import { duplexPair } from "node:stream";
import { chatInput, chatPage, chatStream } from "./routes/chat/index.mjs";
import { PluginCollection } from "../plugins.mjs";

declare global {
  interface Window {
    _chat_event_source: EventSource;
  }
}

const rl = createInterface({
  input,
  output,
});

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

export type HttpServer = ReturnType<typeof httpServer>;

const createDuplex = () => {
  const duplex = duplexPair();
  return {
    input: duplex[0],
    output: duplex[1],
  };
};

export type DuplexStream = ReturnType<typeof createDuplex>;

export function httpServer({ entities, container }: HttpServerOptions) {
  const { worker } = container;

  // Outgoing
  const irc = createDuplex();
  // Incoming
  const chat = createDuplex();

  const server = createServer(async (readable, res) => {
    const url = new URL(readable.url!, `http://${readable.headers.host}`);
    const sec = {
      fetchDest: readable.headers["sec-fetch-dest"] as Sec["fetchDest"],
    };
    res.setHeaders(
      new Headers({
        "Access-Control-Allow-Origin": "*",
      })
    );

    const method = readable.method as "POST" | "GET";
    const { pathname, search } = parseURL(url.href);

    if (pathname === ".well-known/healthcheck") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      return res.end("OK");
    }

    const requestLogger = logger.child().withPrefix("[REQUEST]").withContext({
      requestId: randomUUID(),
      method,
      url,
    });

    const state = url.searchParams.get("state");
    const userId = state?.split("-")[1];
    const code = url.searchParams.get("code");

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
        logger: requestLogger,
      });
    }

    if (
      pathname.startsWith("/plugins") &&
      (method === "POST" || method === "GET")
    ) {
      const endpoint = pathname.split("/").at(2) ?? "";

      switch (endpoint) {
        case "start":
          if (method === "POST") {
            await PluginCollection.load(
              container.plugins,
              PLUGIN_CONFIGURATION.PLUGIN_ACTIVE_LIST
            );
            res.writeHead(200, {
              "Content-Type": "application/json",
            });
            return res.end(
              JSON.stringify({
                plugins: {
                  active: await container.plugins.isActive(),
                },
              })
            );
          } else {
            res.writeHead(405);
            return res.end(
              JSON.stringify({
                error: "Method not allowed",
              })
            );
          }
        case "stop":
          if (method === "POST") {
            await PluginCollection.unload(container.plugins);
            res.writeHead(200, {
              "Content-Type": "application/json",
            });
            return res.end(
              JSON.stringify({
                plugins: {
                  active: await container.plugins.isActive(),
                },
              })
            );
          } else {
            res.writeHead(405);
            return res.end(
              JSON.stringify({
                error: "Method not allowed",
              })
            );
          }
        case "active":
          res.writeHead(200, {
            "Content-Type": "application/json",
          });
          return res.end(
            JSON.stringify({
              plugins: {
                active: await container.plugins.isActive(),
              },
            })
          );
        case "instances":
          return instance(res)({
            readable,
            method,
            pathname,
            search,
            logger: requestLogger,
            ...container,
          });
        default:
          return plugincollection(res)({
            readable,
            sec,
            method,
            pathname,
            search,
            ...container,
          });
      }
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
          return configure(res)({
            endpoint,
            method,
            ...container,
          });
      }
    }

    if (pathname.startsWith("/chat")) {
      const endpoint = pathname.split("/").at(2) ?? "";
      switch (endpoint) {
        case "stream":
          return chatStream(res)({
            ircDuplex: irc,
          });
        case "input":
          return await chatInput(res)({
            readable,
            chatDuplex: chat,
          });
        default:
          return await chatPage(res)();
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
      }
    },
    configuration: {
      open: async (prompt: string) => {
        const url = SERVICE_ENVIRONMENT.SERVER_CONFIGURATION_URL;
        const { open: configurationOpened } = worker;

        if (configurationOpened || OidcConfiguration.isOidcHeadless()) {
          logger.info(`Please configure at the following link: ${url}`);
        } else {
          logger.debug("Opening configuration");
          await new Promise((resolve) => {
            setTimeout(resolve, 2000);
          });

          const response = await rl.question(prompt);
          if (response.trim() === "") {
            await open(url);
          } else {
            throw new Error("Press enter to proceed");
          }
        }
      },
    },
    streams: {
      irc,
      chat,
    },
  };
}
