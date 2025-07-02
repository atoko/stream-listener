import { on, once } from "node:events";
import { httpServer } from "./http/server.mts";
import { websocketServer } from "./http/websockets.mts";
import { TwitchCasterClient } from "./twitch/caster.mts";
import {
  EnvironmentSignals,
  SERVER_ENVIRONMENT,
  TWITCH_BOT,
  TWITCH_BROADCASTER,
  TwitchEnvironment,
} from "./environment.mts";
import { TwitchIrcClient } from "./twitch/irc.mts";
import { TwitchOIDC } from "./twitch/oidc.mts";
import { PluginInstance } from "./chat/PluginInstance.mjs";
import {
  BroadcastChannel,
  getEnvironmentData,
  isMainThread,
  setEnvironmentData,
  Worker,
} from "node:worker_threads";
import { Logger } from "./logging.mjs";
import { ConfigurationLoader } from "./configuration.mjs";

const logger = Logger.child().withPrefix("[MAIN]");
class ProcessSignals {
  exit: BroadcastChannel = new BroadcastChannel("exit");
  constructor() {
    this.exit.onmessage = async () => {
      process.exit(1);
    };
  }
}

new ProcessSignals();
const environment = new EnvironmentSignals();
const plugin = new PluginInstance();
const loader = new ConfigurationLoader();

await (async () => {
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
  const http = httpServer({
    port: SERVER_ENVIRONMENT.SERVER_PORT,
    entities: Object.values(oidc),
    plugin,
    environment,
    loader,
  });
  const wss = websocketServer({ http });
  const irc = new TwitchIrcClient(oidc.bot);
  const caster = new TwitchCasterClient(oidc.caster, irc, wss);
  const context = getEnvironmentData("context");

  once(loader, "save").then(() => {
    logger.debug("Closing http and wss");
    Promise.allSettled([http.close(), wss.close()]).then(() => {
      setEnvironmentData("context", "main");
      new Worker(new URL(import.meta.url));
      logger.info("wss closed, new thread started");
    });
  });

  if (isMainThread || context !== "worker") {
    logger.info("Waiting for caster authentication");
    http.listen();

    once(loader, "load").then(async () => {
      if (TwitchEnvironment.isClientSecretSet()) {
        logger.info("Server configuration not found");
        await http.configuration.open();
        return;
      }

      oidc.caster.onListen();
      logger.debug("Http server started. Emitted 'listening' event");

      let isWorkerStarted = false;
      for await (const _ of on(oidc.caster, "authenticated")) {
        logger.info("Caster connecting");
        await caster.connect();
        await caster.subscribe();
        logger.debug("Caster subscribed");

        if (!isWorkerStarted) {
          logger.info("Starting worker thread");
          setEnvironmentData("context", "worker");
          new Worker(new URL(import.meta.url));
          isWorkerStarted = true;
          logger.debug("Worker thread started");
        }
      }
    });

    ConfigurationLoader.loadAll(loader);
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
})();
