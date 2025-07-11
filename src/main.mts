import { on, once } from "node:events";
import { httpServer } from "./http/server.mts";
import { websocketServer } from "./http/websockets.mts";
import { TwitchCasterClient } from "./twitch/caster.mts";
import {
  EnvironmentSignals,
  TWITCH_BOT,
  TWITCH_BROADCASTER,
  TwitchEnvironment,
} from "./environment.mts";
import { TwitchIrcClient } from "./twitch/irc.mts";
import { TwitchOIDC } from "./twitch/oidc.mts";
import { PluginInstance } from "./chat/PluginInstance.mjs";
import { isMainThread, Worker } from "node:worker_threads";
import { Logger } from "./logging.mjs";
import { ConfigurationLoader } from "./loader.mjs";
import { ProcessSignals } from "./signals.mjs";
import { WorkerContext } from "./worker.mjs";
import { Container } from "./container.mjs";

if (isMainThread) {
  new WorkerContext().thread = "main";
}

const logger = Logger.child().withPrefix("[MAIN]");

const container = new Container(
  new WorkerContext(),
  new ProcessSignals(),
  new EnvironmentSignals(),
  new PluginInstance(),
  new ConfigurationLoader()
);

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
    entities: Object.values(oidc),
    container,
  });

  const wss = websocketServer({ http });
  const irc = new TwitchIrcClient(oidc.bot);
  const caster = new TwitchCasterClient(oidc.caster, irc, wss);
  const { thread } = container.worker;

  once(container.loader, "save").then(() => {
    logger.debug("Closing http and wss");
    Promise.allSettled([
      http.close(),
      wss.close(),
      async () => {
        Object.values(oidc).forEach((oidc) => {
          oidc.close("authenticated");
          oidc.close("listening");
        });
      },
      async () => {
        container.loader.close("load");
        container.loader.close("save");
      },
    ]).then(() => {
      container.worker.thread = "main";
      new Worker(new URL(import.meta.url));
      logger.info("wss closed, new thread started");
    });
  });

  if (thread.startsWith(`main`)) {
    logger.info("Waiting for caster authentication");
    once(container.loader, "load").then(async () => {
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
          container.worker.thread = "worker";
          new Worker(new URL(import.meta.url));
          isWorkerStarted = true;
          logger.debug("Worker thread started");
        }
      }
    });
  } else {
    wss.withIrc(irc);

    once(container.loader, "load").then(async () => {
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
    });
  }

  ConfigurationLoader.loadAll(container.loader);
})();

if (isMainThread) {
  await container.signals.onExit;
}
