import type { WorkerContext } from "./worker.mjs";
import type { ProgramSignals } from "./signals.mjs";
import type { ConfigurationEvents } from "./environment.mjs";
import type { Plugin } from "./chat/Plugin.mjs";
import type { ConfigurationLoader } from "./loader.mjs";

export class Container {
  constructor(
    public worker: WorkerContext,
    public program: ProgramSignals,
    public configuration: ConfigurationEvents,
    public loader: ConfigurationLoader,
    public plugin: Plugin[]
  ) {}
}
