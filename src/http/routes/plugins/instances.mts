import type { IncomingMessage, ServerResponse } from "node:http";
import type { Readable } from "node:stream";
import { PluginCollection, type PluginInstance } from "../../../plugins.mjs";
import type { ILogLayer } from "loglayer";
import { ConfigurationEvents } from "../../../configuration.mjs";
import { ConfigurationLoader } from "../../../loader.mjs";
import { URLSearchParams } from "node:url";
import { serializeError } from "serialize-error";

const instanceWithoutNameRegex = new RegExp(`/plugins/instances(/?(.*)/?)?`);
export const pluginsInstances =
  (res: ServerResponse<IncomingMessage>) =>
  async ({
    method,
    pathname,
    search,
    logger,
    configuration,
    loader,
    plugins,
  }: {
    readable: Readable;
    pathname: string;
    method: "POST" | "GET";
    search: string;
    plugins: PluginCollection;
    logger: ILogLayer;
    configuration: ConfigurationEvents;
    loader: ConfigurationLoader;
  }) => {
    let name: string | undefined = undefined;
    let reducer: PluginInstance | undefined;

    const saveConfiguration = async () => {
      configuration.onPluginEnvironment({
        PLUGIN_ACTIVE_LIST: Object.values(plugins?.plugins).map(
          ({ name, path, reducer }) => {
            return {
              name,
              path,
              active: true,
              reducer,
            };
          }
        ),
      });

      await ConfigurationLoader.saveAll(loader);
    };

    switch (method) {
      // @ts-ignore
      case "POST":
        let body = new URLSearchParams(search);
        const result = {
          name: body.get("name") ?? undefined,
          path: body.get("path") ?? undefined,
          reducer: body.get("reducer") ?? undefined,
        };
        let { path, reducer: reducerParam } = result;
        name = result.name;

        if (name === undefined) {
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(
            JSON.stringify({ error: "Form input 'name' is required" })
          );
        }

        if (path === undefined) {
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(
            JSON.stringify({ error: "Form input 'filepath' is required" })
          );
        }

        if (!reducerParam) {
          res.writeHead(400, { "Content-Type": "application/json" });
          return res.end(
            JSON.stringify({ error: "Search param 'reducer' is required" })
          );
        }

        try {
          reducer = plugins.get(name);
          if (!reducer) {
            reducer = await plugins.load(name, path, {
              reducer: reducerParam,
            });
            await saveConfiguration();
          }
          res.writeHead(301, { Location: `/plugins/instances/${name}/` });
          return res.end();
        } catch (err) {
          logger
            .withMetadata({ error: serializeError(err) })
            .error("Error loading plugin");
          res.writeHead(301, {
            Location: `/plugins?${new URLSearchParams({
              error: "Internal server error",
            }).toString()}`,
          });
          return res.end();
        }
      case "GET":
        const matches = instanceWithoutNameRegex.exec(pathname);
        if ((matches?.at(2) ?? "") === "") {
          res.writeHead(301, {
            Location: `/plugins`,
          });
          return res.end();
        }

        name = (() => {
          return pathname.split("/").at(-2)?.trim() ?? "";
        })();
        reducer = plugins.get(name);
    }
    if (!reducer) {
      res.writeHead(301, {
        Location: `/plugins?${new URLSearchParams({
          error: "Plugin not found",
        }).toString()}`,
      });
      return res.end();
    }

    const serialized = reducer.serialized();

    res.writeHead(200, {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
    });
    return res.end(
      JSON.stringify({ state: PluginCollection.deserialize(serialized) })
    );
  };
