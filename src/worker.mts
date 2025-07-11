import { getEnvironmentData, setEnvironmentData } from "node:worker_threads";

export class WorkerContext {
  private get ordinal(): number {
    return Number(getEnvironmentData("ordinal") ?? 1);
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
