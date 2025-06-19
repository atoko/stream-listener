import { on, once } from "node:events";
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
import { isMainThread, Worker } from "node:worker_threads";

const oidc = {
  caster: await TwitchOIDC.load({
    kind: "caster",
    id: TWITCH_BROADCASTER.TWITCH_BROADCASTER_ID,
    name: TWITCH_BROADCASTER.TWITCH_BROADCASTER_NAME,
    scope: "channel:manage:redemptions channel:read:redemptions",
  }),
  bot: await TwitchOIDC.load({
    kind: "bot",
    id: TWITCH_BOT.TWITCH_BOT_ID,
    name: TWITCH_BOT.TWITCH_BOT_NAME,
    scope: "chat:read chat:edit",
  }),
};

const plugin = new PluginInstance();
const http = httpServer({
  port: TWITCH_ENVIRONMENT.SERVER_PORT,
  entities: Object.values(oidc),
  plugin,
});

const wss = websocketServer({ http });

const caster = new TwitchCasterClient(
  oidc.caster,
  new TwitchIrcClient(oidc.bot),
  wss
);
http.listen();

if (isMainThread) {
  let isWorkerStarted = false;
  for await (const _ of on(oidc.caster, "authenticated")) {
    await caster.connect();
    await caster.subscribe();

    if (!isWorkerStarted) {
      await once(oidc.bot, "authenticated");
      new Worker(new URL(import.meta.url));
      isWorkerStarted = true;
    }
  }
} else {
  wss.withIrc(caster.irc);
  for await (const _ of on(oidc.bot, "authenticated")) {
    caster.irc.connect();
    await caster.irc.subscribe();
  }
}
