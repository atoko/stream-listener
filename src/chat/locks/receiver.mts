export const LocksChatCommands = ["message", "join"];

export type LocksActionCommandMessage = {
  action: (typeof LocksChatCommands)[number];
};
export function isLocksActionCommand(
  message: any,
): message is LocksActionCommandMessage {
  return (
    typeof message === "object" &&
    typeof message.action === "string" &&
    LocksChatCommands.includes(message.action)
  );
}

export function LocksReceiver(message: LocksActionCommandMessage) {
  if (message.action === "message") {
    console.log("Action: message");
  } else if (message.action === "join") {
    console.log("Action: join");
  } else {
    console.error("Unknown action command:", message);
  }

  return [];
}
