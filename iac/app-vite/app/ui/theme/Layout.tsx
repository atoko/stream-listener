import React, { Fragment, type ReactNode, useContext } from "react";
import { ErrorBoundary, FallbackProps } from "react-error-boundary";
import { Link, Outlet, useNavigate, useNavigation } from "react-router-dom";
import { serializeError } from "serialize-error";

export const ErrorPage = (props?: Partial<FallbackProps>) => {
  const navigate = useNavigate();
  navigate("/error-boundary");
  return (
    <main>
      <h1>Oh no! An error happened</h1>
      {props?.error !== undefined ? (
        <summary>{JSON.stringify(serializeError(props?.error))}</summary>
      ) : undefined}
      <Link to="/">Navigate to Home page</Link>
    </main>
  );
};

export const Layout = () => {
  return (
    <Fragment>
      <div>
        <ErrorBoundary fallback={<ErrorPage />}>
          <Outlet />
        </ErrorBoundary>
      </div>
    </Fragment>
  );
};
