import React, { createContext, ReactNode, useEffect, useMemo } from "react";

export type ApiContextState = {
  port?: number;
  url?: string;
};

export const ApiContext = createContext<ApiContextState>({});

export const ApiContextProvider = ({ children }: { children: ReactNode }) => {
  const [port, setPort] = React.useState<number | undefined>(
    Number(sessionStorage.getItem("port") ?? undefined)
  );
  useEffect(() => {
    window.electron.onPort(async (port) => {
      sessionStorage.setItem("port", String(port));
      setPort(port);
    });
  }, [port]);

  const api = useMemo(() => {
    return {
      port,
      url: port ? `http://localhost:${port}` : undefined,
    };
  }, [port]);

  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>;
};
