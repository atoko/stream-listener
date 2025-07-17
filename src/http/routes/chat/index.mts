import type { ServerResponse } from "node:http";
import type { ChatInputMessage } from "../../../twitch/irc.mjs";
import type { Readable } from "node:stream";
import type { DuplexStream } from "../../server.mjs";
import { IrcParseableCommands } from "../../../twitch/irc/parse/command.js";
import type { ParsedMessage } from "../../../twitch/irc/parse/message.js";
import { javascript } from "../../html.mjs";

export const chatStream =
  (res: ServerResponse) =>
  ({ ircDuplex }: { ircDuplex: DuplexStream }) => {
    res.setHeaders(
      new Headers({
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      })
    );
    res.writeHead(200);
    const writeChunk = (chunk: any) => {
      const parsed = JSON.parse(chunk);
      if (typeof parsed === "string") {
        res.write(`data: ${chunk} \n\n`);
        return;
      }

      const { command } = (parsed as ParsedMessage) ?? {};
      if (command ?? "" in IrcParseableCommands) {
        res.write(`data: ${JSON.stringify(parsed)} \n\n`);
      }
    };
    ircDuplex.output.on("data", writeChunk);
    res.on("close", () => {
      ircDuplex.output.removeListener("data", writeChunk);
    });
    return;
  };

export const chatInput =
  (res: ServerResponse) =>
  async ({
    chatDuplex,
    readable,
  }: {
    readable: Readable;
    chatDuplex: DuplexStream;
  }) => {
    const json = Promise.withResolvers<string>();
    const chunks: Array<string> = [];
    readable.on("readable", () => {
      let chunk;
      while (null !== (chunk = readable.read())) {
        chunks.push(chunk);
      }
    });
    readable.on("end", () => {
      json.resolve(chunks.join(""));
    });

    const params = new URLSearchParams(await json.promise);
    const { message } = {
      message: params.get("message"),
    };

    chatDuplex.input.write(
      JSON.stringify({
        ChatInput: {
          message,
        },
      } as ChatInputMessage)
    );
    res.writeHead(201);
    res.end();
    return;
  };

export const chatPage = (res: ServerResponse) => async () => {
  res.writeHead(200, { "Content-Type": "text/html" });

  await javascript(
    function () {
      document.addEventListener("readystatechange", () => {
        if (window._chat_event_source) {
          return;
        }
        const stream = document.getElementById("stream");
        const source = new EventSource("/chat/stream");
        source.onmessage = (event) => {
          const element = document.createElement("div");
          stream?.appendChild(element);
          element.textContent = event.data;
        };

        window._chat_event_source = source;
      });
    },
    { async: true, defer: true }
  )(res);

  await javascript(
    function () {
      document.addEventListener("readystatechange", () => {
        const form = document.getElementById("chat_form");
        const input = document.getElementById("message");
        if (form) {
          form.onsubmit = (event) => {
            event.preventDefault();
            fetch("/chat/input", {
              method: "POST",
              body: new URLSearchParams({
                // @ts-ignore
                message: input.value,
              }).toString(),
            });
            // @ts-ignore
            input.value = "";
          };
        }
      });
    },
    { async: true, defer: true }
  )(res);

  return res.end(`
            <h1>Chat</h1>
            <div>
                <pre id="stream" />            
            </div>
            <form
                id="chat_form"
            >
                
                <input
                    id="message"
                    name="message"
                    type="text"
                />
                <button
                    type="submit"
                >Send</button>
            </form>
          `);
};
