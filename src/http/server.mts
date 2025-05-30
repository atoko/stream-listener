import { createServer } from "http";
import { TwitchOIDC } from "../twitch/oidc.mts";
import { TWITCH_ENVIRONMENT } from "../twitch/environment.mts";
import { extname, join, dirname } from "path";
import { readFile, stat } from "fs";

const PUBLIC_DIR = join(dirname(import.meta.url), "..", "..", "public");
const INDEX_FILE = join(PUBLIC_DIR, "index.html");

export function httpServer({
  port,
  entities,
}: {
  port: number;
  entities: TwitchOIDC[];
}) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url!, `http://${req.headers.host}`);
    const pathname = url.pathname;
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const userId = state?.split("-")[1];
    const scope = state?.split("-")[2];

    if (pathname === "/" && code) {
      console.log(
        `[SERVER] ${userId}: Twitch authentication code received ${code}`,
      );
    }

    if (pathname === ".well-known/healthcheck") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      return res.end("OK");
    }

    if (pathname === "/authorize") {
      if (code) {
        console.log(
          `[SERVER] ${userId}: Twitch authentication code received ${code}`,
        );

        const token = await TwitchOIDC.token({
          code,
          redirect_uri: TWITCH_ENVIRONMENT.SERVER_REDIRECT_URL,
        });

        if (token.type === "data") {
          console.log(
            `[SERVER] ${userId}: Twitch access token received ${token.data.access_token}`,
          );
          const validation = await TwitchOIDC.validate({
            accessToken: token.data.access_token,
          });

          console.log(
            `[SERVER] ${userId}: Access token is valid, ${validation.type}`,
          );
          if (validation.type === "data") {
            let success = false;
            await Promise.all(
              entities.map(async (oidc) => {
                if (oidc.entity.id === userId) {
                  console.log(
                    `[SERVER] ${oidc.entity.id}: Access token is valid, resubscribing`,
                  );

                  success = true;
                  const response = await oidc.write({
                    access: token.data.access_token,
                    refresh: token.data.refresh_token,
                  });
                  console.debug(`${JSON.stringify(response)}`);
                }
              }),
            );

            if (success) {
              res.writeHead(200, { "Content-Type": "text/html" });
              return res.end(
                "<h1>Authentication successful</h1><p>You can close this window.</p>",
              );
            } else {
              res.writeHead(400, { "Content-Type": "text/html" });
              const url = [
                `https://id.twitch.tv/oauth2/authorize`,
                encodeURIComponent(
                  Object.entries({
                    client_id: TWITCH_ENVIRONMENT.TWITCH_CLIENT_ID,
                    redirect_uri: TWITCH_ENVIRONMENT.SERVER_REDIRECT_URL,
                    force_verify: true,
                    scope: scope ?? "",
                    response_type: "token",
                    state: TwitchOIDC.state({ userId, scope }),
                    nonce: TwitchOIDC.nonce(),
                  })
                    .map(
                      ([key, value]) => `${key}=${encodeURIComponent(value)}`,
                    )
                    .join("&"),
                ),
              ].join("?");

              return res.end(`
                  <!DOCTYPE html>
                  <html lang="en">
                  <head>
                      <meta charset="UTF-8">
                      <title>Authentication</title>
                  </head>
                  <body>
                      <script defer>
                          if (window.confirm('Please authenticate with user id : ${userId}. Reauthenticate with the correct user id account?')) {
                              window.location.href = "${url}"
                          } else {
                              const p = document.createElement("p");
                              const h1 = document.createElement("h1");
                              h1.textContent = "Authentication failed";
                              p.textContent = "Hope you are able to try again some other time.";

                              document.body.appendChild(h1, p);
                          }
                      </script>
                  </body>
                  </html>
              `);
            }
          }
        } else {
          res.writeHead(400, { "Content-Type": "text/html" });
          return res.end(
            "<h1>Missing authentication code</h1><p>Please try again.</p>",
          );
        }
      } else {
        res.writeHead(400);
        return res.end("Something went wrong with authorization: Missing code");
      }
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
        console.log(`[SERVER] HTTP server listening on port ${port}`);
      });
    },
  };
}
