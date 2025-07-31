import type { IncomingMessage, ServerResponse } from "node:http";
import { PluginCollection } from "../../../plugins.mjs";
import type { TwitchIrcClient } from "../../../twitch/irc.mjs";

export const pluginsActive =
  (res: ServerResponse<IncomingMessage>) =>
  async ({
    plugins,
    irc,
  }: {
    plugins: PluginCollection;
    irc: TwitchIrcClient | undefined;
  }) => {
    res.writeHead(200, {
      "Content-Type": "application/json",
    });
    return res.end(
      JSON.stringify({
        plugins: {
          active: await plugins.isActive(),
          ...(irc
            ? {
                irc: {
                  opened: irc?.opened,
                  closed: irc?.closed,
                },
              }
            : {}),
        },
      })
    );
  };
