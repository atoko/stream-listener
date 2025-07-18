import { BroadcastChannel } from "node:worker_threads";

export class ProgramSignals {
  static directory = () => {
    return `${process.cwd()}/runtime`;
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
