import React, { Fragment, useContext, useEffect, useState } from "react";
import { PluginInstancesServiceContext } from "../../ui/api/plugin/PluginInstancesServiceProvider";

export const ListPlugins = () => {
  const pluginInstancesService = useContext(PluginInstancesServiceContext);
  const [plugins, setPlugins] = useState<
    | Array<{
        name: string;
        path: string;
        active: string;
      }>
    | undefined
  >(undefined);

  useEffect(() => {
    pluginInstancesService.list().then((list) => {
      setPlugins(list);
    });

    return () => {};
  }, [pluginInstancesService]);

  return (
    <Fragment>
      <main>
        Plugins
        {plugins?.map((plugin) => {
          return (
            <Fragment>
              {plugin.name}
              {plugin.path}
              {plugin.active}
            </Fragment>
          );
        })}
      </main>
    </Fragment>
  );
};
