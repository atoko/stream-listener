import type { ServerResponse } from "node:http";
import type { ConfigurationLoader } from "../../../loader.mjs";
import { javascript } from "../../html.mjs";

declare global {
  interface Window {
    configure_twitch?: Window;
    configure_service?: Window;
  }
}

export const ConfigurePageIds = {
  restartButton: "configure_restart_button",
} as const;

export const frontend =
  (res: ServerResponse) =>
  async ({
    endpoint,
    method,
    loader,
  }: {
    endpoint: string;
    method: "GET" | "POST";
    loader: ConfigurationLoader;
  }) => {
    if (endpoint.trim().length > 0) {
      res.writeHead(301, { Location: "/configure" });
      return res.end();
    } else {
      switch (method) {
        // @ts-ignore Fallthrough case in switch
        case "POST":
          await loader.onSave();
          break;
        case "GET":
          res.writeHead(200, { "Content-Type": "text/html" });
          await javascript(() => {
            window.addEventListener("message", (raw) => {
              try {
                const message = JSON.parse(raw.data);
                if (message?.change !== undefined) {
                  const button = document.getElementById("#restart_button");
                  button?.removeAttribute("disabled");
                }
              } catch (error) {
                console.error({
                  message: "Could not parse window message",
                  error,
                  raw,
                });
              }
            });
          })(res, {
            "#restart_button": ConfigurePageIds.restartButton,
          });
          return res.end(`
      <iframe 
        name="configure_twitch"
        src="/configure/twitch" 
      ></iframe>
      <iframe
        name="configure_service" 
        src="/configure/service" 
      ></iframe>        
    <form
    >
      <button
        id="${ConfigurePageIds.restartButton}"
        disabled
      >Restart server</button>
</form>

`);
      }
    }
  };
