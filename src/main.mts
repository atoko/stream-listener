import { on, once } from "node:events";
import { httpServer } from "./http/server.mts";
import { websocketServer } from "./http/websocket.mts";
import { TwitchCasterClient } from "./twitch/caster.mts";
import {
  ConfigurationEvents,
  PLUGIN_CONFIGURATION,
  TWITCH_BOT,
  TWITCH_BROADCASTER,
  TwitchEnvironment,
} from "./configuration.mts";
import { TwitchIrcClient } from "./twitch/irc.mts";
import { TwitchOIDC } from "./twitch/oidc.mts";
import { isMainThread, parentPort } from "node:worker_threads";
import { Logger } from "./logging.mjs";
import {
  ConfigurationLoader,
  type ConfigurationLoaderMessage,
} from "./loader.mjs";
import { ProgramSignals } from "./signals.mjs";
import { WorkerContext } from "./worker.mjs";
import { Container } from "./container.mjs";
import { PluginCollection } from "./plugins.mjs";

const logger = Logger.child().withPrefix("[MAIN]");

const container = new Container(
  new WorkerContext(),
  new ProgramSignals(),
  new ConfigurationEvents(),
  new ConfigurationLoader(),
  new PluginCollection()
);

const { loader, worker, plugins } = container;

if (isMainThread) {
  container.worker.thread = "main";
}

ConfigurationLoader.loadAll(loader);
await (async () => {
  const oidc = {
    caster: TwitchOIDC.load(
      new TwitchOIDC({
        id: TWITCH_BROADCASTER.TWITCH_BROADCASTER_ID,
        name: TWITCH_BROADCASTER.TWITCH_BROADCASTER_NAME,
        scope: TWITCH_BROADCASTER.TWITCH_BROADCASTER_SCOPE,
      })
    ),
    bot: TwitchOIDC.load(
      new TwitchOIDC({
        id: TWITCH_BOT.TWITCH_BOT_ID,
        name: TWITCH_BOT.TWITCH_BOT_NAME,
        scope: TWITCH_BOT.TWITCH_BOT_SCOPE,
      })
    ),
  };
  const http = httpServer({
    entities: Object.values(oidc),
    container,
  });

  const wss = websocketServer({ http });
  const irc = new TwitchIrcClient(oidc.bot, http, container);
  const caster = new TwitchCasterClient(oidc.caster, irc, container.plugins);

  const restart = async () => {
    logger
      .withMetadata({
        ConfigurationLoader: "save",
      })
      .info("Closing event listeners");

    {
      await Promise.allSettled([http.close(), wss.close()]);
      logger.debug("HTTP closed");
    }
    {
      await Promise.allSettled([irc.close(), caster.close()]);
      logger.debug("Websockets closed");
    }
    {
      Object.values(oidc).forEach((oidc) => {
        oidc.close("authenticated");
        oidc.close("listening");
      });
      logger.debug("Oidc closed");
    }
    {
      loader.close("load");
      loader.close("save");
      logger.debug("ConfigurationLoader closed");
    }

    if (worker.thread.startsWith("main")) {
      worker.fork(new URL(import.meta.url), "main");
    }
  };

  once(loader, "save").then(restart);
  parentPort?.on(
    "message",
    async (message: Partial<ConfigurationLoaderMessage>) => {
      const { ConfigurationLoader } = message ?? {};
      if (ConfigurationLoader === "save") {
        await restart();
      }
    }
  );

  if (worker.thread.startsWith(`main`)) {
    logger.info("Waiting for caster authentication");
    once(loader, "load").then(async () => {
      logger.debug("Starting HTTP server");
      http.listen();

      if (TwitchEnvironment.isClientSecretEmpty()) {
        logger.warn("Client Secret is empty. Configure the server to proceed");

        await http.configuration.open(`
          \n Press enter to open configuration, any other key to exit
        `);
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
          worker.fork(new URL(import.meta.url), "worker");
          isWorkerStarted = true;
          irc.setupEventHandlers();
          plugins.setupEventHandlers(http, container);
          logger.debug("Worker thread started");
        }
      }
    });
  } else {
    irc.setupEventHandlers();

    once(loader, "load").then(async () => {
      once(oidc.bot, "authenticated").then(async () => {
        logger.info("Connecting irc");
        await irc.connect();
        irc.subscribe();
        logger.debug("irc subscribed");
      });

      logger.debug("Listening to authentication events");

      logger.info("Waiting for bot authentication");
      oidc.bot.onListen();
      logger.debug("Emitted server ready");
    });
  }

  ConfigurationLoader.loadAll(loader);
})();

if (isMainThread) {
  await container.program.onExit;
}
