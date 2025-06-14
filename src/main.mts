import { on } from "node:events";
import { httpServer } from "./http/server.mts";
import { websocketServer } from "./http/websockets.mts";
import { TwitchCasterClient } from "./twitch/caster.mts";
import {
  TWITCH_BOT,
  TWITCH_BROADCASTER,
  TWITCH_ENVIRONMENT,
} from "./twitch/environment.mts";
import { TwitchIrcClient } from "./twitch/irc.mts";
import { TwitchOIDC } from "./twitch/oidc.mts";
import { PluginInstance } from "./plugins/reducer.mjs";

const auth = {
  bot: await TwitchOIDC.load({
    kind: "bot",
    id: TWITCH_BOT.TWITCH_BOT_ID,
    name: TWITCH_BOT.TWITCH_BOT_NAME,
    scope: "chat:read chat:edit",
  }),
  caster: await TwitchOIDC.load({
    kind: "caster",
    id: TWITCH_BROADCASTER.TWITCH_BROADCASTER_ID,
    name: TWITCH_BROADCASTER.TWITCH_BROADCASTER_NAME,
    scope: "channel:manage:redemptions channel:read:redemptions",
  }),
};

const plugin = new PluginInstance();

const http = httpServer({
  port: TWITCH_ENVIRONMENT.SERVER_PORT,
  entities: [auth.caster],
  plugin,
});

const wss = websocketServer({ http });

http.listen();

const caster = new TwitchCasterClient(
  auth.caster,
  new TwitchIrcClient(auth.bot),
  wss
);

// wss.withIrc(caster.irc);

// const { IS_FORK } = env;
// new Worker(import.meta.filename, {
//   env: {
//     IS_FORK: "true",
//   },
// });

// if (IS_FORK) {
//   for await (const _ of on(auth.bot, "authenticated")) {
//     caster.irc.connect();
//     await caster.irc.subscribe();
//   }
// } else {
  for await (const _ of on(auth.caster, "authenticated")) {
    await caster.connect();
    await caster.subscribe();
  }
// }
