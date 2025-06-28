import { on, once } from "node:events";
import { httpServer } from "./http/server.mts";
import { websocketServer } from "./http/websockets.mts";
import { TwitchCasterClient } from "./twitch/caster.mts";
import {
  TWITCH_BOT,
  TWITCH_BROADCASTER,
  TWITCH_ENVIRONMENT,
} from "./environment.mts";
import { TwitchIrcClient } from "./twitch/irc.mts";
import { TwitchOIDC } from "./twitch/oidc.mts";
import { PluginInstance } from "./chat/reducer.mjs";
import { isMainThread, Worker } from "node:worker_threads";
import { Logger } from "./logging.mjs";

const logger = Logger.child().withPrefix("[MAIN]");

const oidc = {
  caster: TwitchOIDC.load(
    new TwitchOIDC({
      kind: "caster",
      id: TWITCH_BROADCASTER.TWITCH_BROADCASTER_ID,
      name: TWITCH_BROADCASTER.TWITCH_BROADCASTER_NAME,
      scope: "channel:manage:redemptions channel:read:redemptions",
    })
  ),
  bot: TwitchOIDC.load(
    new TwitchOIDC({
      kind: "bot",
      id: TWITCH_BOT.TWITCH_BOT_ID,
      name: TWITCH_BOT.TWITCH_BOT_NAME,
      scope: "chat:read chat:edit",
    })
  ),
};

const plugin = new PluginInstance();
const http = httpServer({
  port: TWITCH_ENVIRONMENT.SERVER_PORT,
  entities: Object.values(oidc),
  plugin,
});

const wss = websocketServer({ http });
const irc = new TwitchIrcClient(oidc.bot, plugin);
const caster = new TwitchCasterClient(oidc.caster, irc, wss);

if (isMainThread) {
  logger.info("Waiting for caster authentication");
  http.listen();
  await oidc.caster.onListen();
  logger.debug("Http server started. Emitted 'listening' event");

  let isWorkerStarted = false;
  for await (const _ of on(oidc.caster, "authenticated")) {
    logger.info("Caster connecting");
    await caster.connect();
    await caster.subscribe();
    logger.debug("Caster subscribed");

    if (!isWorkerStarted) {
      logger.info("Starting worker thread");
      new Worker(new URL(import.meta.url));
      isWorkerStarted = true;
      logger.debug("Worker thread started");
    }
  }
} else {
  wss.withIrc(irc);

  once(oidc.bot, "authenticated").then(async () => {
    logger.info("Connecting irc");
    irc.connect();
    irc.subscribe();
    logger.debug("irc subscribed");
  });
  logger.debug("Listening to authentication events");

  logger.info("Waiting for bot authentication");
  oidc.bot.onListen();
  logger.debug("Emitted server ready");
}
