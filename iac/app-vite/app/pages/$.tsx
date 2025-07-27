import React, { useCallback, useContext, useRef, useState } from "react";
import { Fragment } from "react";
import { PluginServiceContext } from "../ui/api/plugin/PluginServiceProvider";

export const RootIndexPage = () => {
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
      <h1>Chat Listener</h1>
      <p>Welcome to the chat listener application.</p>
      <div
        id="progress"
        style={{ visibility: isLoading ? "visible" : "hidden" }}
      >
        ...
      </div>
      <fieldset
        id="controls"
        style={{ visibility: isLoading ? "hidden" : "visible" }}
      >
        <button id="start" disabled={isActive} onClick={onStartButton}>
          Start
        </button>
        <button id="stop" disabled={!isActive} onClick={onStopButton}>
          Stop
        </button>
      </fieldset>
    </Fragment>
  );
};
