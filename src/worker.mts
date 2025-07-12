import {
  getEnvironmentData,
  setEnvironmentData,
  Worker,
} from "node:worker_threads";

export class WorkerContext {
  public workers: Array<Worker> = [];

  fork(scriptURL: string | URL, kind: "main" | "worker") {
    const current = this.thread;
    this.thread = kind;
    const worker = new Worker(scriptURL);
    this.workers.push(worker);
    worker.on("exit", (w) => {
      this.workers = this.workers.filter(({ threadId }) => {
        return threadId !== worker.threadId;
      });
    });

    if (current.startsWith("main")) {
      this.ordinal -= 1;
    }
    this.thread = current.split("-")[0] as "main" | "worker";
  }

  private get ordinal(): number {
    return Number(getEnvironmentData("ordinal") ?? 0);
  }

  private set ordinal(to: number) {
    setEnvironmentData("ordinal", to);
  }

  get thread(): string {
    try {
      return [String(getEnvironmentData("thread")), this.ordinal].join("-");
    } catch (e) {
      return "main-0";
    }
  }
  set thread(thread: "main" | "worker") {
    if (thread.startsWith("main")) {
      this.ordinal += 1;
    }
    setEnvironmentData("thread", thread);
  }

  set configuration({ open }: { open?: boolean }) {
    if (open) {
      setEnvironmentData("configuration.open", open);
    }
  }

  get open() {
    return getEnvironmentData("open") ?? false;
  }
}
