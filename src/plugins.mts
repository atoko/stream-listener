import VError from "verror";
import EventEmitter from "node:events";
import { readdirSync, existsSync } from "node:fs";
import { ProgramSignals } from "./signals.mjs";
import type { HttpServer } from "./http/server.mjs";
import type { ParsedMessage } from "./twitch/irc/parse/message.mjs";
import { IrcParseableCommandSet } from "./twitch/irc/parse/command.mjs";
import type { Container } from "./container.mjs";
import { Logger } from "./logging.mjs";

const logger = Logger.child().withPrefix("[PLUGIN]");

function replacer(key: unknown, value: unknown) {
  if (value instanceof Map) {
    return {
      dataType: "Map",
      value: Array.from(value.entries()), // or with spread: value: [...value]
    };
  } else {
    return value;
  }
}
function reviver(
  key: string,
  value: {
    dataType: string;
    value: Array<[string, string]>;
  }
) {
  if (typeof value === "object" && value !== null) {
    if (value.dataType === "Map") {
      return Object.fromEntries(value.value);
    }
  }
  return value;
}

export type PluginDescriptor = {
  path: string;
  name: string;
  active: boolean;
  reducer: "default";
};

export type PluginInstance = {
  path: string;
  name: string;
  reducer: "default";
  initialize: () => Promise<void>;
  action: (action: ParsedMessage) => Promise<void>;
  read: () => unknown;
  serialized: () => string;
};

export class PluginCollection extends EventEmitter {
  plugins: Record<string, PluginInstance> = {};

  static filepath() {
    return `${ProgramSignals.directory()}/plugins`;
  }

  static load(collection: PluginCollection, plugins: Array<PluginDescriptor>) {
    let errors: Array<PluginDescriptor> = [];
    plugins.forEach((plugin) => {
      try {
        collection.load(plugin.name, plugin.path, {
          reducer: plugin.reducer,
        });
      } catch (e) {
        errors.push(plugin);
      }
    });
  }

  static deserialize = (input: string) => {
    return JSON.parse(input, reviver);
  };

  constructor() {
    super();
  }

  public get(name: string): PluginInstance | undefined {
    return this.plugins[name] ?? undefined;
  }

  public load = async (
    name: string,
    path: string,
    imports: {
      reducer: string;
    }
  ) => {
    const imported = await import(path);
    const reducer = imported[imports.reducer ?? "default"];

    if (typeof reducer !== "function") {
      throw new VError(
        {
          info: {
            path,
            module,
          },
        },
        `Module is not a function`
      );
    }

    if (reducer.length < 2) {
      throw new VError(
        {
          info: {
            path,
          },
        },
        `Plugin reducer should be typed '(state, action) => state'`
      );
    }

    let state: unknown = await Promise.resolve(reducer(undefined, undefined));
    if (state === undefined || state === null) {
      throw new VError(
        {
          info: { path },
        },
        `Plugin reducer should not return a null/undefined value'`
      );
    }

    const instance: PluginInstance = {
      path,
      name,
      reducer: (imports.reducer as "default") ?? "default",
      initialize: async () => {
        state = await Promise.resolve(reducer(undefined, undefined));
      },
      action: async (action: unknown) => {
        state = await reducer(state, action);
      },
      read: () => {
        return state;
      },
      serialized: () => {
        return JSON.stringify(state, replacer);
      },
    };

    this.plugins[name] = instance;

    return instance;
  };

  public list = async () => {
    const directory = readdirSync(PluginCollection.filepath()).filter(
      (path) => !path.startsWith(".")
    );
    const plugins: PluginDescriptor[] = [];
    for (const plugin of directory) {
      let found = false;
      ["js", "mjs", "mts", "ts"].forEach((extension) => {
        if (!found) {
          const path = `${PluginCollection.filepath()}/${plugin}/index.${extension}`;
          const exists = existsSync(path);
          if (exists) {
            plugins.push({
              name: plugin,
              path,
              reducer: "default",
              active: plugin in this.plugins,
            });
            found = true;
          }
        }
      });
    }

    return plugins;
  };

  private onChatInput = (
    http: HttpServer,
    { worker }: Pick<Container, "worker">
  ) => {
    http.streams.irc.output.on("data", (chunk) => {
      const parsed = JSON.parse(chunk);
      if (typeof parsed === "string") {
        return;
      }

      const { command } = (parsed as ParsedMessage) ?? {};
      if (IrcParseableCommandSet.has(command?.command ?? "")) {
        Object.values(this.plugins).forEach((plugin) => {
          logger.trace(`Receiving event for ${plugin.name}@${plugin.path}`);
          plugin.action(parsed);
        });
      }
    });

    logger.debug("Subscribed to chat input");
  };

  public setupEventHandlers = (http: HttpServer, container: Container) => {
    logger.info("Setting up event handlers");
    this.onChatInput(http, { ...container });
  };
}
