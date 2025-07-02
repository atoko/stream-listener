import type { IncomingMessage, ServerResponse } from "node:http";
import { EnvironmentSignals, TWITCH_ENVIRONMENT } from "../../environment.mjs";
import { TwitchIrcClient } from "../../twitch/irc.mjs";
import { TwitchCasterClient } from "../../twitch/caster.mjs";
import VError from "verror";
import type { Readable } from "node:stream";
import { ConfigurationLoader } from "../../configuration.mjs";
import { URLSearchParams } from "node:url";
import type { WorkerContext } from "../../worker.mjs";

type OidcConfigurationPost = {
  clientId?: string;
  clientSecret?: string;
};
const OidcConfigurationName: Record<keyof OidcConfigurationPost, string> = {
  clientId: "twitch_client_id",
  clientSecret: "twitch_client_secret",
};

const alphanumeric = new RegExp("^[a-zA-Z0-9_]*$");
type PostValidation<Body extends {}> = {
  result: Body | undefined;
  errors?: Array<[string, string | undefined]>; // message, Field, value
};
const isValidOidcConfigurationPost = (
  body: unknown
): PostValidation<OidcConfigurationPost> => {
  const validations = [
    // Alphanumeric check
    (s: string | undefined, optional: boolean = true) => {
      if (optional) {
        return true;
      }
      return s !== undefined && alphanumeric.test(s);
    },
    // Length check
    (s: string | undefined, optional: boolean = true) => {
      if (optional) {
        return true;
      }
      return s !== undefined && s.length > 0 && s.length < 40;
    },
  ];
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
      clientId: params.get(OidcConfigurationName.clientId) ?? undefined,
      clientSecret: params.get(OidcConfigurationName.clientSecret) ?? undefined,
    };
    const { clientId, clientSecret } = result;

    const fieldset: Array<[string, string | undefined]> = [
      ["Client ID", clientId],
      ["Client Secret", clientSecret],
    ] as const;

    const errors = fieldset.filter(([label, value]) => {
      return validations.filter(
        (validation) => value !== "undefined" && validation(value)
      );
    });

    return {
      result,
      errors,
    };
  } catch (e) {
    throw new VError(
      {
        info: { body },
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
        >
            <h2>OIDC</h2>
            <fieldset
                class={["flex"].join(" ")}
            > 
                <div>
                  <input 
                      name=${OidcConfigurationName.clientId}
                      type="text"
                      value="${TWITCH_ENVIRONMENT.TWITCH_CLIENT_ID}"
                  >
                      <label>
                          Client ID
                      </label>
                  </input>           
                </div>
                 <div>
                  <input 
                    name=${OidcConfigurationName.clientSecret}
                    type="password"
                    value=${TWITCH_ENVIRONMENT.TWITCH_CLIENT_SECRET}
                  >
                      <label>
                          Client Secret
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
