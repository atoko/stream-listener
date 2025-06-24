import { TwitchOIDC } from "../../twitch/oidc.mjs";
import { TWITCH_ENVIRONMENT } from "../../twitch/environment.mjs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Logger } from "../../logging.mjs";

export const authorize =
  (res: ServerResponse<IncomingMessage>) =>
  async ({
    code,
    userId,
    entities,
    scope,
  }: {
    code: string | null;
    userId?: string;
    entities?: TwitchOIDC[];
    scope?: string;
  }) => {
    if (code && entities) {
      Logger.withMetadata({
        userId,
        code,
      }).debug(`[SERVER] Twitch authentication code received`);

      const token = await TwitchOIDC.token({
        code,
        redirect_uri: TWITCH_ENVIRONMENT.SERVER_REDIRECT_URL,
      });

      if (token.type === "data") {
        Logger.withMetadata({
          userId,
        }).info(`[SERVER] Twitch access token received`);
        const validation = await TwitchOIDC.validate({
          accessToken: token.data.access_token,
        });

        Logger.withMetadata({
          userId,
          validation,
        }).info(`[SERVER] Access token is valid`);

        if (validation.type === "data") {
          let success = false;
          await Promise.all(
            entities.map(async (oidc) => {
              if (oidc.entity.id === userId) {
                Logger.withMetadata({
                  entity: oidc.entity,
                }).info(`[SERVER] Access token is valid, resubscribing`);

                success = true;

                const { type, filepath } = oidc.write({
                  access: token.data.access_token,
                  refresh: token.data.refresh_token,
                });

                oidc.onAuthenticate();

                Logger.withMetadata({
                  type,
                  filepath,
                }).debug(`[SERVER] Tokens successfully written`);

                return;
              }
            }),
          );

          if (success) {
            res.writeHead(200, { "Content-Type": "text/html" });
            return res.end(`
                <h1>Authentication successful</h1>
                <p>You may close this window. It will close automatically in <span id="timer">5</span> seconds</p>
                <script>
                    let t = 5; 
                    const timer = document.getElementById("timer");
                    setInterval(() => { 
                        if (t <= 0) {                      
                            window?.close();   
                        } else {
                            t -= 1;
                            timer.innerText = t;
                        }
                    }, 1000);
                </script>
            `);
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
                  .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
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

    return undefined;
  };
