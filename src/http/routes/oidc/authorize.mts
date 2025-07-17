import { TwitchOIDC } from "../../../twitch/oidc.mjs";
import {
  SERVICE_ENVIRONMENT,
  TWITCH_ENVIRONMENT,
} from "../../../environment.mjs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Logger } from "../../../logging.mjs";
import type { ILogLayer } from "loglayer";

export const authorize =
  (res: ServerResponse<IncomingMessage>) =>
  async ({
    code,
    userId,
    entities,
    scope,
    logger,
  }: {
    code: string | null;
    userId?: string;
    entities?: TwitchOIDC[];
    scope?: string;
    logger: ILogLayer;
  }) => {
    if (code && entities) {
      logger
        .withMetadata({
          userId,
          code: code.length,
        })
        .debug(`Twitch authentication code received`);

      const token = await TwitchOIDC.token({
        code,
        redirect_uri: SERVICE_ENVIRONMENT.SERVER_REDIRECT_URL,
      });

      if (token.type === "data") {
        logger
          .withMetadata({
            userId,
          })
          .info(`Twitch access token received`);
        const validation = await TwitchOIDC.validate({
          accessToken: token.data.access_token,
        });

        logger
          .withMetadata({
            userId,
            validation,
          })
          .info(`Access token is valid`);

        if (validation.type === "data") {
          let success = false;
          await Promise.all(
            entities.map(async (oidc) => {
              if (oidc.entity.id === userId) {
                logger
                  .withMetadata({
                    entity: oidc.entity,
                  })
                  .info(`Access token is valid, resubscribing`);

                success = true;

                const { type, filepath } = oidc.write({
                  access: token.data.access_token,
                  refresh: token.data.refresh_token,
                });

                logger
                  .withMetadata({
                    type,
                    filepath,
                  })
                  .debug(`Tokens successfully written`);

                oidc.onAuthenticate();

                return;
              }
            })
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
                  redirect_uri: SERVICE_ENVIRONMENT.SERVER_REDIRECT_URL,
                  force_verify: true,
                  scope: scope ?? "",
                  response_type: "token",
                  state: TwitchOIDC.state({ userId, scope }),
                  nonce: TwitchOIDC.nonce(),
                })
                  .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
                  .join("&")
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

                              document.body.appendChild(h1);
                              document.body.appendChild(p);
                          }
                      </script>
                  </body>
                  </html>
              `);
          }
        } else {
          logger
            .withMetadata({
              token,
              userId,
            })
            .warn(`Twitch authorize failed`);

          res.writeHead(501, { "Content-Type": "text/html" });
          return res.end(
            "<h1>Internal Server Error</h1><p>Please try again.</p>"
          );
        }
      } else {
        res.writeHead(400, { "Content-Type": "text/html" });
        return res.end(
          "<h1>Missing authentication code</h1><p>Please try again.</p>"
        );
      }
    } else {
      res.writeHead(400);
      return res.end("Something went wrong with authorization: Missing code");
    }

    return undefined;
  };
