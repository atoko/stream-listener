import { Context, Effect } from "effect";
import {
  LoggingContext,
  withStructuredLogging,
} from "@levicape/loglayer-effect";

export const Logger = await Effect.runPromise(
  Effect.provide(
    Effect.gen(function* () {
      const logging = yield* LoggingContext;
      return yield* logging.logger;
    }),
    Context.empty().pipe(withStructuredLogging({}))
  )
);
