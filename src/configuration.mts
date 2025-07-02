import {
  type Configuration,
  type ConfigurationData,
  CONFIGURATIONS,
  OIDC_CONFIGURATION,
  SERVER_ENVIRONMENT,
  TWITCH_BOT,
  TWITCH_BROADCASTER,
  TWITCH_ENVIRONMENT,
} from "./environment.mjs";
import EventEmitter from "events";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { Logger } from "./logging.mjs";

const logger = Logger.child().withPrefix("[LOADER]");

export class ConfigurationLoader extends EventEmitter {
  static filepath = (key: Configuration) => {
    return `${process.cwd()}/data/${key.toLowerCase()}.json`;
  };

  static loadAll(loader: ConfigurationLoader): ConfigurationLoader {
    CONFIGURATIONS.map((config) => {
      const data = loader.load(config);
      let other: Object | undefined;
      if (data) {
        switch (config) {
          case "BOT":
            other = TWITCH_BOT;
            break;
          case "CASTER":
            other = TWITCH_BROADCASTER;
            break;
          case "TWITCH":
            other = TWITCH_ENVIRONMENT;
            break;
          case "SERVER":
            other = SERVER_ENVIRONMENT;
            break;
          case "OIDC":
            other = OIDC_CONFIGURATION;
            break;
        }
      }

      if (other) {
        Object.assign(other, data);
      }
    });

    loader.onLoad();
    return loader;
  }

  static saveAll(loader: ConfigurationLoader) {
    CONFIGURATIONS.map((config) => {
      let other: ConfigurationData | undefined;
      switch (config) {
        case "BOT":
          other = TWITCH_BOT;
          break;
        case "CASTER":
          other = TWITCH_BROADCASTER;
          break;
        case "TWITCH":
          other = TWITCH_ENVIRONMENT;
          break;
        case "SERVER":
          other = SERVER_ENVIRONMENT;
          break;
        case "OIDC":
          other = OIDC_CONFIGURATION;
          break;
      }
      if (other) {
        loader.save(config, other);
      }
    });

    loader.onSave();
    return loader;
  }

  public onLoad() {
    this.emit("load");
  }

  public onSave() {
    this.emit("save");
  }

  public load(key: Configuration) {
    const filepath = ConfigurationLoader.filepath(key);
    try {
      const file = readFileSync(filepath, "utf8");
      return JSON.parse(file);
    } catch (e) {
      logger
        .withMetadata({
          filepath,
        })
        .warn(`No ${key} data`);
    }
  }

  public save(key: Configuration, data: ConfigurationData) {
    const filepath = ConfigurationLoader.filepath(key);
    try {
      const folderpath = filepath.split("/");
      folderpath.pop();
      mkdirSync(folderpath.join("/"), {
        recursive: true,
      });
    } catch (e) {}

    writeFileSync(filepath, JSON.stringify(data, null, 4));
  }
}
