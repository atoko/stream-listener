import type { IncomingMessage, ServerResponse } from "node:http";
import {
  ConfigurationEvents,
  TWITCH_BROADCASTER,
} from "../../../environment.mjs";
import VError from "verror";
import type { Readable } from "node:stream";
import { ConfigurationLoader } from "../../../loader.mjs";
import { URLSearchParams } from "node:url";
import type { WorkerContext } from "../../../worker.mjs";
import { deserializeError } from "serialize-error";
import { javascript } from "../../html.mjs";
import type { Sec } from "../../server.mjs";

type TwitchId = string;

type ConfigurationBroadcasterPost = {
  broadcasterId?: TwitchId;
  broadcasterName?: string;
};

const ConfigurationBroadcasterHeadings = {
  title: {
    "#title": "Broadcaster",
  },
} as const;

const ConfigurationBroadcasterLabel: Record<
  keyof ConfigurationBroadcasterPost,
  string
> = {
  broadcasterId: "Broadcaster ID",
  broadcasterName: "Broadcaster Name",
};

const ConfigurationBroadcasterName: Record<
  keyof ConfigurationBroadcasterPost,
  string
> = {
  broadcasterId: "twitch_broadcaster_id",
  broadcasterName: "twitch_broadcaster_name",
};

const regexp = { alphanumeric: new RegExp("^[a-zA-Z0-9_]*$") };
type PostValidation<Body extends {}> = {
  result: Body | undefined;
  errors?: Array<Readonly<[string, string | number | undefined]>>; // message, Field, value
};
const isValidBroadcasterConfigurationPost = (
  body: unknown
): PostValidation<ConfigurationBroadcasterPost> => {
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
      "Invalid BroadcasterConfigurationPost"
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
      broadcasterId:
        params.get(ConfigurationBroadcasterName.broadcasterId) ?? undefined,
      broadcasterName:
        params.get(ConfigurationBroadcasterName.broadcasterName) ?? undefined,
    };
    const { broadcasterId, broadcasterName } = result;

    const fieldset: Array<
      [
        string,
        string | number | undefined,
        Array<(s: any | undefined) => boolean>
      ]
    > = [
      [
        ConfigurationBroadcasterLabel.broadcasterId,
        broadcasterId,
        [alphanumeric, length],
      ],
      [
        ConfigurationBroadcasterLabel.broadcasterName,
        broadcasterName,
        [alphanumeric, length],
      ],
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
export const broadcaster =
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

        const { result } = isValidBroadcasterConfigurationPost(
          await json.promise
        );
        configuration.onBroadcasterEnvironment({
          TWITCH_BROADCASTER_NAME:
            result?.broadcasterId ?? TWITCH_BROADCASTER.TWITCH_BROADCASTER_ID,
          TWITCH_BROADCASTER_ID:
            result?.broadcasterName ??
            TWITCH_BROADCASTER.TWITCH_BROADCASTER_NAME,
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
                change: "configure_broadcaster",
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
                      id={Object.keys(ConfigurationBroadcasterHeadings)[0]}
                  >${ConfigurationBroadcasterHeadings.title["#title"]}</h2>
                  <div>
                      <label>
                          ${ConfigurationBroadcasterLabel.broadcasterId}
                  <input 
                      type="text"
                      name=${ConfigurationBroadcasterName.broadcasterId}
                      value="${TWITCH_BROADCASTER.TWITCH_BROADCASTER_ID}"
                  >
                  </input>           
                      </label>
                </div>
                 <div>
                      <label>
                          ${ConfigurationBroadcasterLabel.broadcasterName}
                  <input 
                    type="text"
                    name=${ConfigurationBroadcasterName.broadcasterName}
                    value=${TWITCH_BROADCASTER.TWITCH_BROADCASTER_NAME}
                  />
                  </input>
                      </label>
                </div>    
            </fieldset>             
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
