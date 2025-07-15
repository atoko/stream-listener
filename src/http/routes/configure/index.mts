import type { ServerResponse } from "node:http";
import type { ConfigurationLoader } from "../../../loader.mjs";
import { javascript } from "../../html.mjs";
import type { WorkerContext } from "../../../worker.mjs";

declare global {
  interface Window {
    configure_twitch?: Window;
    configure_service?: Window;
  }
}

export const ConfigurePageIds = {
  restartButton: "configure_restart_button",
} as const;

export const configure =
  (res: ServerResponse) =>
  async ({
    endpoint,
    method,
    loader,
    worker,
  }: {
    endpoint: string;
    method: "GET" | "POST";
    loader: ConfigurationLoader;
    worker: WorkerContext;
  }) => {
    if (endpoint.trim().length > 0) {
      res.writeHead(301, { Location: "/configure" });
      return res.end();
    } else {
      switch (method) {
        // @ts-ignore Fallthrough case in switch
        case "POST":
          await loader.onSave(worker);
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
      <section>
    </section>
    <section>
      <iframe 
        name="configure_twitch"
        src="/configure/twitch" 
      ></iframe>
      <iframe
        name="configure_broadcaster" 
        src="/configure/broadcaster" 
      ></iframe>
      <iframe
        name="configure_broadcaster" 
        src="/configure/bot" 
      ></iframe>                   
      <iframe
        name="configure_service" 
        src="/configure/service" 
      ></iframe>          
</section>

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
