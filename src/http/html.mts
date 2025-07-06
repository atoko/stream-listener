import type { IncomingMessage, ServerResponse } from "node:http";

export const javascript =
  (fn: Function) =>
  async (
    res: ServerResponse<IncomingMessage>,
    templateStrings?: Record<string, string>
  ) => {
    const { promise: headHtml, resolve } = Promise.withResolvers<void>();
    let serialized: string;
    if (templateStrings) {
      serialized = Object.entries(templateStrings).reduce<string>(
        (func, [template, value]) => {
          return func.replaceAll(template, value);
        },
        fn.toString()
      );
    } else {
      serialized = fn.toString();
    }

    res.write(
      `<script
                type="text/javascript"
            >
                (${serialized})()
            </script>`,
      (_) => {
        resolve();
      }
    );
    return headHtml;
  };
