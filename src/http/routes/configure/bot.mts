import type { IncomingMessage, ServerResponse } from "node:http";
import { ConfigurationEvents, TWITCH_BOT } from "../../../environment.mjs";
import VError from "verror";
import type { Readable } from "node:stream";
import { ConfigurationLoader } from "../../../loader.mjs";
import { URLSearchParams } from "node:url";
import type { WorkerContext } from "../../../worker.mjs";
import { deserializeError } from "serialize-error";
import { javascript } from "../../html.mjs";
import type { Sec } from "../../server.mjs";

type TwitchId = string;

type ConfigurationBotPost = {
  botId?: TwitchId;
  botName?: string;
  botScope?: string;
  botChannel?: string;
};

const ConfigurationBotHeadings = {
  title: {
    "#title": "Bot",
  },
} as const;

const ConfigurationBotLabel: Record<keyof ConfigurationBotPost, string> = {
  botId: "Bot ID",
  botName: "Bot Name",
  botScope: "Bot scope",
  botChannel: "Stream to join",
};

const ConfigurationBotName: Record<keyof ConfigurationBotPost, string> = {
  botId: "twitch_bot_id",
  botName: "twitch_bot_name",
  botScope: "twitch_bot_scope",
  botChannel: "twitch_bot_channel",
};

const regexp = { alphanumeric: new RegExp("^[a-zA-Z0-9_]*$") };
type PostValidation<Body extends {}> = {
  result: Body | undefined;
  errors?: Array<Readonly<[string, string | number | undefined]>>; // message, Field, value
};
const isValidBotConfigurationPost = (
  body: unknown
): PostValidation<ConfigurationBotPost> => {
  const alphanumeric = // Alphanumeric check
    (s: string | undefined, optional: boolean = true) => {
      if (optional) {
        return true;
      }
      return s !== undefined && regexp.alphanumeric.test(s);
    };

  const length = // Length check
    (s: string | undefined) => {
      return s !== undefined && s.length > 0 && s.length < 40;
    };

  if (typeof body !== "string") {
    throw new VError(
      {
        info: { body },
      },
      "Invalid BotConfigurationPost"
    );
  }

  if (body.trim() === "") {
    return {
      result: undefined,
      errors: [],
    };
  }

  try {
    let params = new URLSearchParams(decodeURI(body));
    const result = {
      botId: params.get(ConfigurationBotName.botId) ?? undefined,
      botName: params.get(ConfigurationBotName.botName) ?? undefined,
      botScope: params.get(ConfigurationBotName.botScope) ?? undefined,
      botChannel: params.get(ConfigurationBotName.botChannel) ?? undefined,
    };
    const { botId, botName, botScope, botChannel } = result;

    const fieldset: Array<
      [
        string,
        string | number | undefined,
        Array<(s: any | undefined) => boolean>
      ]
    > = [
      [ConfigurationBotLabel.botId, botId, [alphanumeric, length]],
      [ConfigurationBotLabel.botName, botName, [alphanumeric, length]],
      [ConfigurationBotLabel.botName, botScope, [length]],
      [ConfigurationBotLabel.botName, botChannel, [length]],
    ] as const;

    const errors = fieldset
      .filter(([_, value, validations]) => {
        return validations.filter(
          (validation) => value !== undefined && validation(value)
        );
      })
      .map(([label, value]) => [label, value] as const);

    return {
      result,
      errors,
    };
  } catch (e) {
    throw new VError(
      {
        info: { body },
        cause: deserializeError(e),
      },
      "Error parsing configuration"
    );
  }
};

/**
 *  Configuration page
 */
export const bot =
  (res: ServerResponse<IncomingMessage>) =>
  async ({
    readable,
    method,
    sec,
    configuration,
    loader,
    worker,
  }: {
    readable: Readable;
    method: "POST" | "GET";
    sec: Partial<Sec>;
    configuration: ConfigurationEvents;
    loader: ConfigurationLoader;
    worker: WorkerContext;
  }) => {
    switch (method) {
      // @ts-ignore
      case "POST":
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

        const { result } = isValidBotConfigurationPost(await json.promise);
        configuration.onBotEnvironment({
          TWITCH_BOT_NAME: result?.botName ?? TWITCH_BOT.TWITCH_BOT_NAME,
          TWITCH_BOT_ID: result?.botId ?? TWITCH_BOT.TWITCH_BOT_ID,
          TWITCH_BOT_CHANNEL:
            result?.botChannel ?? TWITCH_BOT.TWITCH_BOT_CHANNEL,
          TWITCH_BOT_SCOPE: result?.botScope ?? TWITCH_BOT.TWITCH_BOT_SCOPE,
        });

        await ConfigurationLoader.saveAll(loader);

        // Only reload the server if the request is from this configuration page
        if (sec.fetchDest === "iframe") {
          await loader.onSave(worker);
        } else {
          // Otherwise, send a message to the configure page
          await javascript(() => {
            window.parent.postMessage(
              JSON.stringify({
                change: "configure_bot",
              })
            );
          })(res);

          worker.configuration = {
            open: true,
          };
        }
      case "GET":
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`
    <div>
        <form
            method="POST"
            autocomplete="off"
        >
            <fieldset
                class={["flex"].join(" ")}
            > 
                      <h2
                      id={Object.keys(ConfigurationBotHeadings)[0]}
                  >${ConfigurationBotHeadings.title["#title"]}</h2>
                  <div>
                      <label>
                          ${ConfigurationBotLabel.botId}
                  <input 
                      type="text"
                      name=${ConfigurationBotName.botId}
                      value="${TWITCH_BOT.TWITCH_BOT_ID}"
                  >
                      </label>
                  </input>           
                </div>
                 <div>
                      <label>
                          ${ConfigurationBotLabel.botName}
                  <input 
                    type="text"
                    name=${ConfigurationBotName.botName}
                    value=${TWITCH_BOT.TWITCH_BOT_NAME}
                  >
                      </label>
                  </input>
                </div>    
                 <div>
                      <label>
                          ${ConfigurationBotLabel.botScope}
                  <input 
                    type="text"
                    name=${ConfigurationBotName.botScope}
                    value=${TWITCH_BOT.TWITCH_BOT_SCOPE}
                  >
                      </label>
                  </input>
                </div>    
                 <div>
                      <label>
                          ${ConfigurationBotLabel.botChannel}
                  <input 
                    type="text"
                    name=${ConfigurationBotName.botChannel}
                    value=${TWITCH_BOT.TWITCH_BOT_CHANNEL}
                  >
                      </label>
                  </input>
                </div>                                    
            </fieldset>             
            <button        
              type="submit"
            >
                    Save
            </button>
        </form>
    </div>
`);
    }
  };
