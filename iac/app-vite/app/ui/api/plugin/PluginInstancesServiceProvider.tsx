import React, {
  createContext,
  PropsWithChildren,
  useContext,
  useMemo,
} from "react";
import { ApiContext } from "../ApiContextProvider";

export type PluginInstancesService = {
  list: () => Promise<
    Array<{
      name: string;
      path: string;
      active: string;
    }>
  >;
};

export const PluginInstancesServiceContext =
  createContext<PluginInstancesService>(undefined);

export const PluginInstancesServiceProvider = ({
  children,
}: PropsWithChildren) => {
  const { url } = useContext(ApiContext);
  const service = useMemo(() => {
    return {
      list: async () => {
        try {
          const response = await fetch(`${url}/plugins/?output=json`, {
            method: "GET",
          });

          if (response.ok) {
            return (await response.json()) as Awaited<
              ReturnType<PluginInstancesService["list"]>
            >;
          }
        } catch (error) {
          console.error(error);
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
