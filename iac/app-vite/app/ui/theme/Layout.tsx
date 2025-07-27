import React, { Fragment, type ReactNode } from "react";
import { Link, Outlet } from "react-router-dom";

export const Layout = () => {
  return (
    <Fragment>
      <menu>
        <ul>
          <li>
            <Link to={"/plugins"}>Plugins</Link>
          </li>
        </ul>
      </menu>
      <Outlet />
    </Fragment>
  );
};
