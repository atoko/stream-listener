import React, { useCallback, useContext, useRef, useState } from "react";
import { Fragment } from "react";
import { PluginServiceContext } from "../ui/api/plugin/PluginServiceProvider";
import { clsx } from "clsx";

export const StartStopControls = () => {
  const pluginService = useContext(PluginServiceContext);
  const [isLoading, setIsLoading] = useState(false);
  const [isActive, setIsActive] = useState(false);

  const updateActive = useCallback(async () => {
    try {
      setIsLoading(true);
      const active = await pluginService.active();
      setIsActive(active);
    } finally {
      setIsLoading(false);
    }
  }, [pluginService]);

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
          visibility: isLoading ? "hidden" : "visible",
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
          disabled={isActive}
          onClick={onStartButton}
        >
          Start
        </button>
        <button
          id="stop"
          className={clsx("button", !isActive ? "is-light" : "", "is-primary")}
          disabled={!isActive}
          onClick={onStopButton}
        >
          Stop
        </button>
      </div>
    </Fragment>
  );
};
