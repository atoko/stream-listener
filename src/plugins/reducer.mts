import VError from "verror";

export class PluginInstance {
  public reducer?: Awaited<ReturnType<typeof PluginInstance.load>>;

  static load = async (
    path: string,
    imports: {
      reducer: string;
    },
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
        `Module is not a function`,
      );
    }

    if (reducer.length !== 2) {
      throw new VError(
        {
          info: {
            path,
          },
        },
        `Plugin reducer should be typed '(state, action) => state'`,
      );
    }

    let state: unknown = await Promise.resolve(reducer(undefined, undefined));
    if (state === undefined || state === null) {
      throw new VError(
        {
          info: { path },
        },
        `Plugin reducer should not return a null/undefined value'`,
      );
    }

    return {
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
  };
}
