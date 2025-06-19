import { createServer } from "http";
import { TwitchOIDC } from "../twitch/oidc.mts";
import { extname, join, dirname } from "path";
import { readFile, stat } from "fs";
import { authorize } from "./routes/authorize.mjs";
import { PluginInstance } from "../plugins/reducer.mjs";
import { parsePath } from "ufo";
import VError from "verror";
import { URLSearchParams } from "node:url";
import { Logger } from "../logging.mjs";
import EventEmitter from "events";

const PUBLIC_DIR = join(dirname(import.meta.url), "..", "..", "public");
const INDEX_FILE = join(PUBLIC_DIR, "index.html");

export type HttpServerOptions = {
  port: number;
  entities: TwitchOIDC[];
  plugin: PluginInstance;
};

export function httpServer({ port, entities, plugin }: HttpServerOptions) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);

    const { pathname, search, hash } = parsePath(url.pathname);
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
      Logger.withMetadata({
        userId,
        code,
      }).info(`[SERVER] Twitch authentication code received`);

      return;
    }

    if (pathname === "/authorize") {
      const scope = state?.split("-")[2];

      return await authorize(res)({
        code,
        userId,
        entities,
        scope,
      });
    }

    let filePath =
      req.url === "/" ? INDEX_FILE : join(PUBLIC_DIR, req.url || "");
    const ext = extname(filePath);

    if (!filePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403, { "Content-Type": "text/html" });
      return res.end("<h1>403 Forbidden</h1>");
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
      server.listen(port ?? 3333, () => {
        Logger.withMetadata({
          port,
        }).info(`[SERVER] HTTP server listening on port`);

        entities.forEach((entity) => {
          entity.emit("listening");
        });
      });
    },
  };
}
