import React, {
  createContext,
  FC,
  PropsWithChildren,
  useContext,
  useMemo,
} from "react";
import { ApiContext } from "../ApiContextProvider";

type PluginServiceState = {
  active: () => Promise<boolean>;
  start: () => Promise<void>;
  stop: () => Promise<void>;
};

export const PluginServiceContext = createContext<
  PluginServiceState | undefined
>(undefined);

export const PluginServiceProvider: FC<PropsWithChildren> = ({
  children,
}: PropsWithChildren) => {
  const { url } = useContext(ApiContext);
  const service = useMemo(() => {
    return {
      active: async () => {
        try {
          const response = await fetch(`${url}/plugins/active`, {
            method: "POST",
          });

          if (response.ok) {
            const json = (await response.json()) as {
              plugins?: {
                active?: boolean;
                irc?: {
                  opened?: boolean;
                  closed?: boolean;
                };
              };
            };

            return json.plugins.active && json.plugins.irc.opened === true;
          }
        } catch (error) {
          console.error(error);
        }
      },
      start: async () => {
        try {
          const response = await fetch(`${url}/plugins/start`, {
            method: "POST",
          });

          if (!response.ok) {
            throw {
              status: response.status,
              url: response.url,
            };
          }
        } catch (error) {
          console.error(error);
        }
      },
      stop: async () => {
        try {
          const response = await fetch(`${url}/plugins/stop`, {
            method: "POST",
          });

          if (!response.ok) {
            throw {
              status: response.status,
              url: response.url,
            };
          }
        } catch (error) {
          console.error(error);
        }
      },
    };
  }, [url]);

  return (
    <PluginServiceContext.Provider value={service}>
      {children}
    </PluginServiceContext.Provider>
  );
};
