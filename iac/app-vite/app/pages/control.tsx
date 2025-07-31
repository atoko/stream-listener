import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Fragment } from "react";
import { PluginServiceContext } from "../ui/api/plugin/PluginServiceProvider";
import { clsx } from "clsx";
import { ApiContext } from "../ui/api/ApiContextProvider";

export const StartStopControls = () => {
  const pluginService = useContext(PluginServiceContext);
  const { url } = useContext(ApiContext);
  const [isLoading, setIsLoading] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  const ready = url !== undefined;

  const updateActive = useCallback(async () => {
    try {
      setIsLoading(true);
      const active = await pluginService.active();
      setIsActive(active);
      setHasLoaded(true);
    } finally {
      setIsLoading(false);
    }
  }, [ready, pluginService]);

  const onStartButton = useCallback(async () => {
    if (pluginService) {
      try {
        setIsLoading(true);
        await pluginService.start();
        await updateActive();
      } finally {
        setIsLoading(false);
      }
    } else {
      console.warn({
        RootIndexPage: "plugin service not initialized",
      });
    }
  }, [pluginService, setIsLoading]);

  const onStopButton = useCallback(async () => {
    if (pluginService) {
      try {
        setIsLoading(true);
        await pluginService.stop();
        await updateActive();
      } finally {
        setIsLoading(false);
      }
    } else {
      console.warn({
        RootIndexPage: "plugin service not initialized",
      });
    }
  }, [pluginService, setIsLoading]);

  useEffect(() => {
    if (ready) {
      updateActive().then();

      const interval = setInterval(async () => {
        await updateActive();
      }, 2000);

      return () => {
        clearInterval(interval);
      };
    }
  }, [updateActive, ready]);

  return (
    <Fragment>
      <div
        id="progress"
        style={{ visibility: isLoading ? "visible" : "hidden" }}
      >
        ...
      </div>
      <div
        id="controls"
        className="box"
        style={{
          display: "flex",
          justifyContent: "end",
          alignItems: "center",
          gap: "2em",
        }}
      >
        Chatbot
        <button
          id="start"
          className={clsx("button", isActive ? "is-light" : "", "is-primary")}
          disabled={isActive || !hasLoaded}
          onClick={onStartButton}
        >
          Start
        </button>
        <button
          id="stop"
          className={clsx("button", !isActive ? "is-light" : "", "is-primary")}
          disabled={!isActive || !hasLoaded}
          onClick={onStopButton}
        >
          Stop
        </button>
      </div>
    </Fragment>
  );
};
