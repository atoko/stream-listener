import React, {
  FormEvent,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { ConfigureServiceContext } from "../../ui/api/configuration/ConfigurationServiceProvider";
import { ApiContext } from "../../ui/api/ApiContextProvider";

export const TwitchConfiguration = () => {
  const { isReady, twitch, bot, save } = useContext(ConfigureServiceContext);
  const { url } = useContext(ApiContext);
  const [loading, setLoading] = useState(true);
  const refs = {
    clientId: useRef<HTMLInputElement>(null),
    clientSecret: useRef<HTMLInputElement>(null),
    name: useRef<HTMLInputElement>(null),
    id: useRef<HTMLInputElement>(null),
  };

  const onSaveSubmit = useCallback((e: FormEvent) => {
    e.preventDefault();
    Promise.allSettled([
      twitch({
        twitch_client_id: refs.clientId?.current?.value,
        twitch_client_secret: refs.clientSecret?.current?.value,
      }),
      bot({
        twitch_bot_id: refs.id?.current?.value,
        twitch_bot_name: refs.name?.current?.value,
      }),
    ]).then(async () => {
      setTimeout(async () => {
        await save();
      }, 1500);
    });
  }, []);

  useEffect(() => {
    if (isReady) {
      twitch().then((configuration) => {
        const clientIdInput = refs.clientId?.current;
        if (clientIdInput) {
          clientIdInput.value = configuration.twitch_client_id;
        }
        const clientSecretInput = refs.clientSecret?.current;
        if (clientSecretInput) {
          clientSecretInput.value = configuration.twitch_client_secret;
        }

        setLoading(false);
      });

      bot().then((configuration) => {
        const botIdInput = refs.id?.current;
        if (botIdInput) {
          botIdInput.value = configuration.twitch_bot_id;
        }
        const botNameInput = refs.name?.current;
        if (botNameInput) {
          botNameInput.value = configuration.twitch_bot_name;
        }

        setLoading(false);
      });
    }
  }, [isReady]);

  const isDataLoading = loading || !isReady;

  return (
    <section>
      <aside className={"has-text-right"}>
        <small>
          <a href={`${url}/configure`}>{url}/configure</a>
        </small>
      </aside>
      <div>
        <div className="field">
          <label className="label">Client ID</label>
          <div className="control">
            <input
              ref={refs.clientId}
              className="input"
              type="text"
              placeholder="123563474745..."
              disabled={isDataLoading}
            />
          </div>
        </div>
        <div className="field">
          <label className="label">Client Secret</label>
          <div className="control">
            <input
              ref={refs.clientSecret}
              className="input"
              type="password"
              placeholder="*********"
              disabled={isDataLoading}
            />
          </div>
        </div>
        <div className="field">
          <label className="label">Twitch Name</label>
          <div className="control">
            <input
              ref={refs.name}
              className="input"
              type="text"
              placeholder="Twitchbot_M4"
              disabled={isDataLoading}
            />
          </div>
        </div>
        <div className="field">
          <label className="label">Twitch Id</label>
          <div className="control">
            <input
              ref={refs.id}
              className="input"
              type="text"
              placeholder="123563474745"
              disabled={isDataLoading}
            />
          </div>
        </div>
        <form onSubmit={onSaveSubmit}>
          <div className="field">
            <button className="button" type="submit" disabled={isDataLoading}>
              Save
            </button>
          </div>
        </form>
      </div>
    </section>
  );
};
