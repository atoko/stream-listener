import React from "react";
import { HashRouter, Route, Routes } from "react-router-dom";
import { RootIndexPage } from "./pages/$";
import { Layout } from "./ui/theme/Layout";
import { ListPlugins } from "./pages/plugins/$list";

export const ApplicationRouter = () => {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<RootIndexPage />} />
          <Route path={"/plugins"} element={<ListPlugins />} />
        </Route>
      </Routes>
    </HashRouter>
  );
};
