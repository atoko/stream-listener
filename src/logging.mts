import { Context, Effect } from "effect";
import {
  ConfigureLoggingPlugins,
  LoggingContext,
  UnixtimeLogPlugin,
  withStructuredLogging,
} from "@levicape/loglayer-effect";
import { WorkerContext } from "./worker.mjs";

const context = new WorkerContext();

export const Logger = await Effect.runPromise(
  Effect.provide(
    Effect.gen(function* () {
      const logging = yield* LoggingContext;
      ConfigureLoggingPlugins([
        UnixtimeLogPlugin,
        {
          onBeforeDataOut: ({ data }) => {
            if (data) {
              delete data.rootId;
              delete data.loggerId;
              (data as unknown as Record<"thread", string>).thread =
                context.thread;
            }

            return data;
          },
        },
      ]);

      return yield* logging.logger;
    }),
    Context.empty().pipe(withStructuredLogging({}))
  )
);
