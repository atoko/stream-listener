import React, {
  createContext,
  PropsWithChildren,
  useContext,
  useMemo,
} from "react";
import { ApiContext } from "../ApiContextProvider";

export type PluginInstancesServicePlugin = {
  name: string;
  path: string;
  active: string;
};

export type PluginInstancesService = {
  isReady: boolean;
  list: () => Promise<Array<PluginInstancesServicePlugin>>;
};

export const PluginInstancesServiceContext =
  createContext<PluginInstancesService>(undefined);

export const PluginInstancesServiceProvider = ({
  children,
}: PropsWithChildren) => {
  const { url } = useContext(ApiContext);
  const service = useMemo(() => {
    return {
      isReady: url !== undefined,
      list: async () => {
        try {
          const response = await fetch(`${url}/plugins/?output=json`, {
            method: "GET",
          });

          if (response.ok) {
            const json = (await response.json()) as {
              plugins: Array<PluginInstancesServicePlugin>;
            };

            return json.plugins;
          }
        } catch (error) {
          console.error(error);
          throw error;
        }
      },
      load: async (plugin: PluginInstancesServicePlugin) => {
        try {
          const { name, path, active } = plugin;
          const response = await fetch(`${url}/plugins/instances/`, {
            method: "POST",
          });

          if (response.ok) {
            const json = (await response.json()) as {
              plugins: Array<PluginInstancesServicePlugin>;
            };

            return json.plugins;
          }
        } catch (error) {
          console.error(error);
          throw error;
        }
      },
    };
  }, [url]);

  return (
    <PluginInstancesServiceContext.Provider value={service}>
      {children}
    </PluginInstancesServiceContext.Provider>
  );
};
