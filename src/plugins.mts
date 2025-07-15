import VError from "verror";
import EventEmitter from "node:events";
import { readdirSync, existsSync } from "node:fs";
import { ProgramSignals } from "./signals.mjs";

export type PluginDescriptor = {
  path: string;
  name: string;
  active: boolean;
};

export type PluginInstance = {
  path: string;
  name: string;
  initialize: () => Promise<void>;
  action: (action: unknown) => Promise<void>;
  read: () => unknown;
};

export class PluginCollection extends EventEmitter {
  plugins: PluginInstance[] = [];

  static filepath() {
    return `${ProgramSignals.directory()}/plugins`;
  }

  constructor() {
    super();
  }

  public get(name: string): PluginInstance | undefined {
    return this.plugins.find((plugin) => plugin.name === name) ?? undefined;
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
      initialize: async () => {
        state = await Promise.resolve(reducer(undefined, undefined));
      },
      action: async (action: unknown) => {
        state = await reducer(state, action);
      },
      read: () => {
        return state;
      },
    };

    this.plugins.push(instance);

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
              active: this.plugins.find((p) => p.name === plugin) !== undefined,
            });
            found = true;
          }
        }
      });
    }

    return plugins;
  };
}
