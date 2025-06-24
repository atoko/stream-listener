import { Context, Effect } from "effect";
import {
  ConfigureLoggingPlugins,
  LoggingContext,
  UnixtimeLogPlugin,
  withStructuredLogging,
} from "@levicape/loglayer-effect";
import { isMainThread } from "node:worker_threads";

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
            }

            return data;
          },
        },
      ]);

      return (yield* logging.logger).withContext({
        thread: `${isMainThread ? `Main` : `Worker`}`,
      });
    }),
    Context.empty().pipe(withStructuredLogging({})),
  ),
);
