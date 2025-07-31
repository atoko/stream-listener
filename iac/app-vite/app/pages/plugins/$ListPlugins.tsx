import React, {
  FormEvent,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  PluginInstancesServiceContext,
  PluginInstancesServicePlugin,
} from "../../ui/api/plugin/PluginInstancesServiceProvider";

export const ListPlugins = () => {
  const { isReady, list } = useContext(PluginInstancesServiceContext);
  const [plugins, setPlugins] = useState<
    Array<PluginInstancesServicePlugin> | undefined
  >(undefined);

  useEffect(() => {
    if (isReady) {
      list().then((plugins) => {
        setPlugins(plugins);
      });
    }
  }, [list, isReady]);

  const activatePlugin = useCallback(
    (plugin: PluginInstancesServicePlugin) => (e: FormEvent) => {
      console.log("activatePlugin", plugin);
      e.preventDefault();
    },
    []
  );

  return (
    <main>
      <h1>Plugins</h1>
      <section>
        {plugins?.map((plugin) => {
          return (
            <form
              className={"box"}
              style={{
                minHeight: "10rem",
                minWidth: "10rem",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
              key={plugin.name}
              onSubmit={activatePlugin(plugin)}
            >
              <h2>{plugin.name}</h2>
              <button>{plugin.active ? "Unload" : "Load"}</button>
            </form>
          );
        })}
      </section>
    </main>
  );
};
