import React, {
  createContext,
  PropsWithChildren,
  useContext,
  useMemo,
} from "react";
import { ApiContext } from "../ApiContextProvider";

export type ConfigureServiceTwitch = {
  twitch_client_id: string;
  twitch_client_secret: string;
};

export type ConfigureServiceBot = {
  twitch_bot_id: string;
  twitch_bot_name: string;
};

export type ConfigureService = {
  isReady: boolean;
  twitch: (
    configuration?: Partial<ConfigureServiceTwitch>
  ) => Promise<ConfigureServiceTwitch>;
  bot: (
    configuration?: Partial<ConfigureServiceBot>
  ) => Promise<ConfigureServiceBot>;
  save: () => Promise<void>;
};

export const ConfigureServiceContext =
  createContext<ConfigureService>(undefined);

export const ConfigurationServiceProvider = ({
  children,
}: PropsWithChildren) => {
  const { url } = useContext(ApiContext);
  const service = useMemo(() => {
    return {
      isReady: url !== undefined,
      save: async () => {
        await fetch(`${url}/configure`, { method: "POST", redirect: "manual" });
      },
      twitch: async (configuration?: ConfigureServiceTwitch) => {
        try {
          const response = await fetch(
            `${url}/configure/twitch?output=json&reload=false`,
            {
              method: configuration ? "POST" : "GET",
              ...(configuration
                ? {
                    body: new URLSearchParams(configuration).toString(),
                  }
                : {}),
            }
          );

          if (response.ok) {
            const json = (await response.json()) as {
              configure: {
                twitch: ConfigureServiceTwitch;
              };
            };

            return json.configure.twitch;
          }
        } catch (error) {
          console.error(error);
          throw error;
        }
      },
      bot: async (configuration?: ConfigureServiceBot) => {
        try {
          const response = await fetch(
            `${url}/configure/bot?output=json&reload=false`,
            {
              method: configuration ? "POST" : "GET",
              ...(configuration
                ? {
                    body: new URLSearchParams(configuration).toString(),
                  }
                : {}),
            }
          );

          if (response.ok) {
            const json = (await response.json()) as {
              configure: {
                bot: ConfigureServiceBot;
              };
            };

            return json.configure.bot;
          }
        } catch (error) {
          console.error(error);
          throw error;
        }
      },
    };
  }, [url]);

  return (
    <ConfigureServiceContext.Provider value={service}>
      {children}
    </ConfigureServiceContext.Provider>
  );
};
