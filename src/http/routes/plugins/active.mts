import type { IncomingMessage, ServerResponse } from "node:http";
import { PluginCollection } from "../../../plugins.mjs";

export const pluginsActive =
  (res: ServerResponse<IncomingMessage>) =>
  async ({ plugins }: { plugins: PluginCollection }) => {
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
  };
