import type { IncomingMessage, ServerResponse } from "node:http";
import { TWITCH_ENVIRONMENT } from "../../environment.mjs";
import { TwitchIrcClient } from "../../twitch/irc.mjs";
import { TwitchCasterClient } from "../../twitch/caster.mjs";
import VError from "verror";
import type { Readable } from "node:stream";

type OidcConfigurationPost = {
  clientId?: string;
  clientSecret?: string;
};

const alphanumeric = new RegExp("^[a-zA-Z0-9_]*$");
type PostValidation<Body extends {}> = {
  result: Body;
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
  let result = JSON.parse(body) as OidcConfigurationPost;
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
};

/**
 *  Configuration page
 */
export const configure =
  (res: ServerResponse<IncomingMessage>) =>
  async ({
    readable,
    method,
  }: {
    readable: Readable;
    method: "POST" | "GET";
    caster?: TwitchCasterClient;
    irc?: TwitchIrcClient;
  }) => {
    switch (method) {
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
        Object.assign(TWITCH_ENVIRONMENT, {
          TWITCH_CLIENT_ID:
            result.clientId ?? TWITCH_ENVIRONMENT.TWITCH_CLIENT_ID,
          TWITCH_CLIENT_SECRET:
            result.clientSecret ?? TWITCH_ENVIRONMENT.TWITCH_CLIENT_SECRET,
        });
      // @ts-ignore
      case "GET":
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`<h1>Configuration</h1>
    <div>
        <form
            method="POST"
        >
            <h2>OIDC</h2>
            <fieldset> 
                <input 
                    id="twitch_client_id" 
                    type="text"
                    value="${TWITCH_ENVIRONMENT.TWITCH_CLIENT_ID}">
                    <label>
                        Client ID
                    </label>
                </input>            
                <input 
                    id="twitch_client_secret" 
                    type="hidden"
                    value=${TWITCH_ENVIRONMENT.TWITCH_CLIENT_SECRET}
                    >
                    <label>
                        Client Secret
                    </label>
                </input>
            </fieldset>
            <button        
                type="submit">
                    Save
            </button>
        </form>
    </div>
`);
    }
  };
