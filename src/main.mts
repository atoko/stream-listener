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
import { Logger } from "./logging.mjs";

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

let logger = Logger.child();

if (isMainThread) {
  logger = logger.withContext({
    thread: "eventsub",
  });

  logger.info("Waiting for caster authentication");
  http.listen();
  Object.values(oidc).forEach((entity) => {
    entity.emit("listening");
  });
  logger.debug("Http server started. Emitted 'listening' event");

  let isWorkerStarted = false;
  for await (const _ of on(oidc.caster, "authenticated")) {
    logger.info("Caster connecting");
    await caster.connect();
    await caster.subscribe();
    logger.debug("Caster subscribed");

    if (!isWorkerStarted) {
      logger.info("Starting worker thread");
      await once(oidc.bot, "authenticated");
      new Worker(new URL(import.meta.url));
      isWorkerStarted = true;
      logger.debug("Worker thread started");
    }
  }
} else {
  logger = logger.withContext({
    thread: "irc",
  });

  wss.withIrc(caster.irc);
  logger.info("Waiting for bot authentication");
  oidc.bot.emit("listening");
  logger.debug("Emitted server ready");

  while (true) {
    await once(oidc.bot, "authenticated");
    logger.info("Connecting bot");
    caster.irc.connect();
    await caster.irc.subscribe();
    logger.debug("Bot subscribed");
  }
}
