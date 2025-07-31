import React from "react";
import { HashRouter, Route, Routes } from "react-router-dom";
import { RootIndexPage } from "./pages/$";
import { Layout } from "./ui/theme/Layout";
import { ListPlugins } from "./pages/plugins/$ListPlugins";
import { TwitchConfiguration } from "./pages/configuration/$TwitchConfiguration";

export const ApplicationRouter = () => {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<RootIndexPage />} />
          <Route
            path={"/configuration/twitch"}
            element={<TwitchConfiguration />}
          />
          <Route path={"/plugins/list"} element={<ListPlugins />} />
        </Route>
      </Routes>
    </HashRouter>
  );
};
