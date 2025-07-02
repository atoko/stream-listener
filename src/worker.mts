import { getEnvironmentData, setEnvironmentData } from "node:worker_threads";

export class WorkerContext {
  get thread(): string {
    try {
      return String(getEnvironmentData("thread")) ?? "main";
    } catch (e) {
      return "main";
    }
  }
  set thread(thread: "main" | "worker") {
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
