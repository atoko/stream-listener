import type { IncomingMessage, ServerResponse } from "node:http";
import { PluginCollection } from "../../../plugins.mjs";
import { URLSearchParams } from "node:url";

export const pluginCollectionIndex =
  (res: ServerResponse<IncomingMessage>) =>
  async ({
    plugins,
    search,
  }: {
    pathname: string;
    method: "POST" | "GET";
    plugins: PluginCollection;
    search: string;
  }) => {
    const params = new URLSearchParams(search);
    const outputParam = params.get("output");
    const installed = await plugins.list();
    if (outputParam === "json") {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({
          plugins: installed.map((plugin) => {
            const { name, path, active } = plugin;
            return {
              name,
              path,
              active,
            };
          }),
        })
      );
    } else {
      res.writeHead(200, { "Content-Type": "text/html" });
      return res.end(`
    <h2>Plugins</h2>   
    ${installed.map((plugin) => {
      const { name, path, active } = plugin;
      return `<form!
            method="POST"
        action="/plugins/instances?${new URLSearchParams({
          name,
          path,
          reducer: "default",
        }).toString()}"
            >
          <fieldset>
              <a
                href="/plugins/instances/${name}"
              >
                  <input 
                      id="name"
                      name="name"
                      type="text" 
                      value="${name}"
                      disabled
                  />  
              </a>
          </fieldset>    
          <label>
              <input 
                  id="filepath"
                  name="filepath"
                  type="text" 
                  value="${path}"
                  disabled
                  hidden
              />
        </label>
          <input 
              id="reducer"
              name="reducer"
              type="text" 
              value="default"
              disabled
              hidden
          />          
          <label>
              <input 
                  id="active"
                  name="active"
                  type="text" 
                  value="${active}"
                  disabled
              />
          </label>
          <button type="submit">Add Plugin</button>
        </form>`;
    })}
</fieldset>
`);
    }
  };
