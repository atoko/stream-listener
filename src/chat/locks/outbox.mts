export type LocksOutboxJoinCommand = {
  action: "join";
};
export type LocksOutboxChatCommand = {
  action: "chat";
  message: string;
};

export type LocksOutboxCommand =
  | LocksOutboxJoinCommand
  | LocksOutboxChatCommand;
