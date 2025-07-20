import type { IncomingMessage, ServerResponse } from "node:http";
import {
  coalesce,
  ConfigurationEvents,
  SERVICE_ENVIRONMENT,
} from "../../../configuration.mjs";
import VError from "verror";
import type { Readable } from "node:stream";
import { ConfigurationLoader } from "../../../loader.mjs";
import { URLSearchParams } from "node:url";
import type { WorkerContext } from "../../../worker.mjs";
import { deserializeError } from "serialize-error";
import { javascript } from "../../html.mjs";
import type { Sec } from "../../server.mjs";

type ConfigurationServicePost = {
  readonly serverPort?: number;
  readonly serverListen?: string;
};

const ConfigurationServiceLabel: Record<
  keyof ConfigurationServicePost,
  string
> = {
  serverPort: "Server port",
  serverListen: "Server listen address",
};

const ConfigurationServiceAside: Partial<
  Record<keyof ConfigurationServicePost, Array<string>>
> = {
  serverListen: ["Defaults to localhost"],
};

const ConfigurationServiceName: Record<keyof ConfigurationServicePost, string> =
  {
    serverPort: "server_port",
    serverListen: "server_listen",
  };

const regexp = { alphanumeric: new RegExp("^[a-zA-Z0-9_]*$") };
type PostValidation<Body extends {}> = {
  result: Body | undefined;
  errors?: Array<Readonly<[string, string | number | undefined]>>; // message, Field, value
};
const isValidServerConfigurationPost = (
  body: unknown
): PostValidation<ConfigurationServicePost> => {
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
      "Invalid ServerConfigurationPost"
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
      serverPort:
        Number(params.get(ConfigurationServiceName.serverPort)) ?? undefined,
      serverListen:
        params.get(ConfigurationServiceName.serverListen) ?? undefined,
    } as const;
    const { serverPort, serverListen } = result;

    const fieldset: Array<
      [
        string,
        string | number | undefined,
        Array<(s: any | undefined) => boolean>
      ]
    > = [
      [ConfigurationServiceName.serverPort, serverPort, [alphanumeric, length]],
      [
        ConfigurationServiceName.serverListen,
        serverListen,
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
        info: {
          body,
          configure: "server",
        },
        cause: deserializeError(e),
      },
      "Error parsing configuration"
    );
  }
};

/**
 *  Configuration page - Service
 */
export const service =
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
    res.writeHead(200, { "Content-Type": "text/html" });

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

        const { result } = isValidServerConfigurationPost(await json.promise);
        const SERVER_URL = `${coalesce(
          result?.serverListen,
          "localhost"
        )}:${coalesce(
          String(result?.serverPort),
          String(SERVICE_ENVIRONMENT.SERVER_PORT)
        )}`;

        configuration.onServiceEnvironment({
          SERVER_URL,
        });
        await ConfigurationLoader.saveAll(loader);
        // Only reload the server if the request is from this configuration page
        if (sec.fetchDest !== "iframe") {
          await loader.onSave(worker);
        } else {
          // Otherwise, send a message to the configure page
          await javascript(() => {
            window.parent.postMessage(
              JSON.stringify({
                change: "configure_service",
              })
            );
          })(res);

          worker.configuration = {
            open: true,
          };
        }
      case "GET":
        res.end(`
    <div>
        <form
            method="POST"
            autocomplete="off"
        >
            <h2>Service</h2>
            <fieldset> 
                <h3>HTTP</h3>
                <div>
                      <label>
                          ${ConfigurationServiceLabel.serverPort}
                      <input 
                          type="text"
                          name=${ConfigurationServiceName.serverPort}
                          value="${SERVICE_ENVIRONMENT.SERVER_PORT}"
                      />
                      </label>

                  </input>           
                </div>
                 <div>
                      <label>
                          ${ConfigurationServiceLabel.serverListen}
                                            <input 
                    type="text"
                    name=${ConfigurationServiceName.serverListen}
                    value=${
                      new URL(SERVICE_ENVIRONMENT.SERVER_REDIRECT_URL).hostname
                    }
                  >
                      <span
                      >
                          ${ConfigurationServiceAside.serverListen}
                      </span>
                  </input>

                      </label>
                 
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
