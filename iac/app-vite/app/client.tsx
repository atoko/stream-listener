import React from "react";
import { ApplicationRouter } from "./routes";
import { createRoot } from "react-dom/client";
import { ApiContextProvider } from "./ui/api/ApiContextProvider";
import { PluginInstancesServiceProvider } from "./ui/api/plugin/PluginInstancesServiceProvider";
import { PluginServiceProvider } from "./ui/api/plugin/PluginServiceProvider";

const root = createRoot(document.getElementById("root"));
root.render(
  <ApiContextProvider>
    <PluginServiceProvider>
      <PluginInstancesServiceProvider>
        <ApplicationRouter />
      </PluginInstancesServiceProvider>
    </PluginServiceProvider>
  </ApiContextProvider>
);
