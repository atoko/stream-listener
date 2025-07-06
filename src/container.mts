import type { WorkerContext } from "./worker.mjs";
import type { ProcessSignals } from "./signals.mjs";
import type { EnvironmentSignals } from "./environment.mjs";
import type { PluginInstance } from "./chat/PluginInstance.mjs";
import type { ConfigurationLoader } from "./loader.mjs";

export class Container {
  constructor(
    public worker: WorkerContext,
    public signals: ProcessSignals,
    public environment: EnvironmentSignals,
    public plugin: PluginInstance,
    public loader: ConfigurationLoader
  ) {}
}
