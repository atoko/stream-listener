import type { IncomingMessage, ServerResponse } from "node:http";
import { PluginCollection } from "../../../plugins.mjs";
import { PLUGIN_CONFIGURATION } from "../../../configuration.mjs";

export const pluginsStart =
  (res: ServerResponse<IncomingMessage>) =>
  async ({
    plugins,
    method,
  }: {
    pathname: string;
    method: "POST" | "GET";
    plugins: PluginCollection;
    search: string;
  }) => {
    if (method === "POST") {
      await PluginCollection.load(
        plugins,
        PLUGIN_CONFIGURATION.PLUGIN_ACTIVE_LIST
      );
      res.writeHead(200, {
        "Content-Type": "application/json",
      });
      return res.end(
        JSON.stringify({
          plugins: {
            active: await plugins.isActive(),
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
  };
