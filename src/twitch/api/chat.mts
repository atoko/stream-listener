export const ChatCommands = ["message", "join"];

export type ActionCommandMessage = {
  action: (typeof ChatCommands)[number];
};
