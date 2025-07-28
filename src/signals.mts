import { BroadcastChannel } from "node:worker_threads";
import { RUNTIME_CONFIGURATION } from "./configuration.mjs";

export class ProgramSignals {
  static applicationDirectory = () => {
    return RUNTIME_CONFIGURATION.DATA_DIRECTORY;
  };

  static runtimeDirectory = () => {
    return `${this.applicationDirectory()}/runtime`;
  };

  exit: BroadcastChannel = new BroadcastChannel("exit");
  onExit: Promise<void>;

  constructor() {
    const exit = Promise.withResolvers<void>();
    this.onExit = exit.promise;
    this.exit.onmessage = async () => {
      exit.resolve();
      process.exit(1);
    };
  }
}
