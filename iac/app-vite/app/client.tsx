import React from "react";
import { ApplicationRouter } from "./routes";
import { createRoot } from "react-dom/client";
import { ApiContextProvider } from "./ui/api/ApiContextProvider";
import { PluginInstancesServiceProvider } from "./ui/api/plugin/PluginInstancesServiceProvider";
import { PluginServiceProvider } from "./ui/api/plugin/PluginServiceProvider";
import { ConfigurationServiceProvider } from "./ui/api/configuration/ConfigurationServiceProvider";

const root = createRoot(document.getElementById("root"));
root.render(
  <ApiContextProvider>
    <PluginServiceProvider>
      <ConfigurationServiceProvider>
        <PluginInstancesServiceProvider>
          <ApplicationRouter />
        </PluginInstancesServiceProvider>
      </ConfigurationServiceProvider>
    </PluginServiceProvider>
  </ApiContextProvider>
);
