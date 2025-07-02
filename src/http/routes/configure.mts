import type { IncomingMessage, ServerResponse } from "node:http";
import { EnvironmentSignals, TWITCH_ENVIRONMENT } from "../../environment.mjs";
import { TwitchIrcClient } from "../../twitch/irc.mjs";
import { TwitchCasterClient } from "../../twitch/caster.mjs";
import VError from "verror";
import type { Readable } from "node:stream";
import { ConfigurationLoader } from "../../configuration.mjs";
import { URLSearchParams } from "node:url";
import type { WorkerContext } from "../../worker.mjs";
import { deserializeError } from "serialize-error";

type ConfigurationTwitchPost = {
  clientId?: string;
  clientSecret?: string;
  esHttpUrl?: string;
  esWebSocketUrl?: string;
  esKeepaliveMs?: number;
  ircWebSocketUrl?: string;
};

const ConfigurationTwitchLabel: Record<keyof ConfigurationTwitchPost, string> =
  {
    clientId: "Client ID",
    clientSecret: "Client Secret",
    esHttpUrl: "Eventsub HTTP URL",
    esWebSocketUrl: "Eventsub Websocket URL",
    esKeepaliveMs: "Eventsub Keepalive (ms)",
    ircWebSocketUrl: "IRC WebSocket URL",
  };

const ConfigurationTwitchName: Record<keyof ConfigurationTwitchPost, string> = {
  clientId: "twitch_client_id",
  clientSecret: "twitch_client_secret",
  esHttpUrl: "twitch_eventsub_http_url",
  esWebSocketUrl: "twitch_eventsub_websocket_url",
  esKeepaliveMs: "twitch_eventsub_keepalive_ms",
  ircWebSocketUrl: "twitch_irc_websocket_url",
};

const regexp = { alphanumeric: new RegExp("^[a-zA-Z0-9_]*$") };
type PostValidation<Body extends {}> = {
  result: Body | undefined;
  errors?: Array<Readonly<[string, string | number | undefined]>>; // message, Field, value
};
const isValidOidcConfigurationPost = (
  body: unknown
): PostValidation<ConfigurationTwitchPost> => {
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

  const numeric = // Length check
    (n: number | undefined) => {
      return n !== undefined && Number.isInteger(n);
    };

  if (typeof body !== "string") {
    throw new VError(
      {
        info: { body },
      },
      "Invalid OidcConfigurationPost"
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
      clientId: params.get(ConfigurationTwitchName.clientId) ?? undefined,
      clientSecret:
        params.get(ConfigurationTwitchName.clientSecret) ?? undefined,
      esHttpUrl: params.get(ConfigurationTwitchName.esHttpUrl) ?? undefined,
      esWebSocketUrl:
        params.get(ConfigurationTwitchName.esWebSocketUrl) ?? undefined,
      esKeepaliveMs:
        Number(params.get(ConfigurationTwitchName.esKeepaliveMs)) ?? undefined,
      ircWebSocketUrl:
        params.get(ConfigurationTwitchName.ircWebSocketUrl) ?? undefined,
    };
    const {
      clientId,
      clientSecret,
      esHttpUrl,
      esWebSocketUrl,
      esKeepaliveMs,
      ircWebSocketUrl,
    } = result;

    const fieldset: Array<
      [
        string,
        string | number | undefined,
        Array<(s: any | undefined) => boolean>
      ]
    > = [
      [ConfigurationTwitchLabel.clientId, clientId, [alphanumeric, length]],
      [
        ConfigurationTwitchLabel.clientSecret,
        clientSecret,
        [alphanumeric, length],
      ],
      [ConfigurationTwitchLabel.esHttpUrl, esHttpUrl, [alphanumeric, length]],
      [
        ConfigurationTwitchLabel.esWebSocketUrl,
        esWebSocketUrl,
        [alphanumeric, length],
      ],
      [ConfigurationTwitchLabel.esKeepaliveMs, esKeepaliveMs, [numeric]],
      [
        ConfigurationTwitchLabel.ircWebSocketUrl,
        ircWebSocketUrl,
        [alphanumeric, length],
      ],
    ] as const;

    const errors = fieldset
      .filter(([label, value, validations]) => {
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
export const configure =
  (res: ServerResponse<IncomingMessage>) =>
  async ({
    readable,
    method,
    environment,
    loader,
    worker,
  }: {
    readable: Readable;
    method: "POST" | "GET";
    environment: EnvironmentSignals;
    loader: ConfigurationLoader;
    worker: WorkerContext;
    caster?: TwitchCasterClient;
    irc?: TwitchIrcClient;
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

        const { result } = isValidOidcConfigurationPost(await json.promise);
        environment.onTwitchEnvironment({
          TWITCH_CLIENT_ID:
            result?.clientId ?? TWITCH_ENVIRONMENT.TWITCH_CLIENT_ID,
          TWITCH_CLIENT_SECRET:
            result?.clientSecret ?? TWITCH_ENVIRONMENT.TWITCH_CLIENT_SECRET,
          TWITCH_EVENTSUB_HTTP_URL:
            result?.esHttpUrl ?? TWITCH_ENVIRONMENT.TWITCH_EVENTSUB_HTTP_URL,
          TWITCH_EVENTSUB_WEBSOCKET_URL:
            result?.esWebSocketUrl ??
            TWITCH_ENVIRONMENT.TWITCH_EVENTSUB_WEBSOCKET_URL,
          TWITCH_EVENTSUB_KEEPALIVE_TIMEOUT_MS:
            result?.esKeepaliveMs ??
            TWITCH_ENVIRONMENT.TWITCH_EVENTSUB_KEEPALIVE_TIMEOUT_MS,
          TWITCH_IRC_WEBSOCKET_URL:
            result?.ircWebSocketUrl ??
            TWITCH_ENVIRONMENT.TWITCH_IRC_WEBSOCKET_URL,
        });

        ConfigurationLoader.saveAll(loader);
        worker.configuration = {
          open: true,
        };
      case "GET":
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`<h1>Configuration</h1>
    <div>
        <form
            method="POST"
            autocomplete="off"
        >
            <h2>Twitch</h2>
            <fieldset
                class={["flex"].join(" ")}
            > 
                <h3>Client</h3>
                <div>
                  <input 
                      type="text"
                      name=${ConfigurationTwitchName.clientId}
                      value="${TWITCH_ENVIRONMENT.TWITCH_CLIENT_ID}"
                  >
                      <label>
                          Client ID
                      </label>
                  </input>           
                </div>
                 <div>
                  <input 
                    type="password"
                    name=${ConfigurationTwitchName.clientSecret}
                    value=${TWITCH_ENVIRONMENT.TWITCH_CLIENT_SECRET}
                  >
                      <label>
                          Client Secret
                      </label>
                  </input>
                </div>    
            </fieldset>
            <fieldset>
                 <h3>Eventsub</h3>
                 <div>
                  <input 
                    type="text"
                    name=${ConfigurationTwitchName.esHttpUrl}
                    value=${TWITCH_ENVIRONMENT.TWITCH_EVENTSUB_HTTP_URL}
                  >
                      <label>
                          HTTP URL
                      </label>
                  </input>
                </div>         
                
                 <div>
                  <input 
                    type="text"
                    name=${ConfigurationTwitchName.esWebSocketUrl}
                    value=${TWITCH_ENVIRONMENT.TWITCH_EVENTSUB_WEBSOCKET_URL}
                  >
                      <label>
                          Websocket URL
                      </label>
                  </input>
                </div>

                 <div>
                  <input 
                    type="number"
                    name=${ConfigurationTwitchName.esKeepaliveMs}
                    value=${TWITCH_ENVIRONMENT.TWITCH_EVENTSUB_KEEPALIVE_TIMEOUT_MS}
                  >
                      <label>
                          Keepalive Timeout (ms)
                      </label>
                  </input>
                </div>         
                
                 <div>
                  <input 
                    type="text"
                    name=${ConfigurationTwitchName.ircWebSocketUrl}
                    value=${TWITCH_ENVIRONMENT.TWITCH_IRC_WEBSOCKET_URL}
                  >
                      <label>
                          IRC URL
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
