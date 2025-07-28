import { dir, DirectoryTypes } from "@cross/dir";
import Admzip from "adm-zip";
import { existsSync } from "node:fs";

export const DataDirectory = dir(DirectoryTypes.data).then(
  (directory: string) => {
    return `${directory}/twitch-chat-listener`;
  }
);

export const ExtractPluginPackages = async (
  directory: string
): Promise<void> => {
  const zip = new Admzip(`${process.resourcesPath}/plugins.zip`);
  zip.extractAllTo(directory);
};

export const InstallPlugins = async (): Promise<string> => {
  const directory = await DataDirectory;
  const pluginPath = `${directory}/plugins`;
  if (!existsSync(pluginPath)) {
    await ExtractPluginPackages(directory);
  }
  return directory;
};
