import type { ParsedCommand } from "./parameters.mjs";

const IrcParseableCommands = [
  "JOIN",
  "PART",
  "NOTICE",
  "CLEARCHAT",
  "HOSTTARGET",
  "PRIVMSG",
  "PING",
  "CAP",
  "GLOBALUSERSTATE",
] as const;
export const IrcParseableCommandSet = new Set(
  IrcParseableCommands as ReadonlyArray<string>
);
export type IrcParseableCommand = (typeof IrcParseableCommands)[number];

/**
 * Parses an IRC message and returns a JSON object with the message's
 * component parts (tags, source (nick and host), command, parameters).
 * Expects the caller to pass a single message. (Remember, the Twitch
 * IRC server may send one or more IRC messages in a single message.)
 * @param rawCommandComponent
 */
export function parseCommand(
  rawCommandComponent: string
): ParsedCommand | null {
  // takes the component and parses it to different command components
  // rawCommandComponet = JOIN #bar
  let parsedCommand = null as ParsedCommand | null;
  let commandParts = rawCommandComponent.split(" "); // [JOIN, #bar]

  switch (commandParts[0]) {
    case "JOIN":
    case "PART":
    case "NOTICE":
    case "CLEARCHAT":
    case "HOSTTARGET":
    case "PRIVMSG":
      parsedCommand = {
        type: "chat",
        command: commandParts[0],
        channel: commandParts[1],
      }; // {command: JOIN, channel: #bar}
      break;
    case "PING":
      parsedCommand = {
        type: "chat",
        command: commandParts[0],
      };
      break;
    case "CAP":
      parsedCommand = {
        type: "chat",
        command: commandParts[0],
      };
      break;
    case "GLOBALUSERSTATE": // Included only if you request the /commands capability.
      // But it has no meaning without also including the /tags capability.
      parsedCommand = {
        type: "chat",
        command: commandParts[0],
      };
      break;
    case "USERSTATE": // Included only if you request the /commands capability.
    case "ROOMSTATE": // But it has no meaning without also including the /tags capabilities.
      parsedCommand = {
        type: "chat",
        command: commandParts[0],
        channel: commandParts[1],
      };
      break;
    case "RECONNECT":
      console.log(
        "The Twitch IRC server is about to terminate the connection for maintenance."
      );
      parsedCommand = {
        type: "chat",
        command: commandParts[0],
      };
      break;
    case "421":
      return null;
    case "001": // Logged in (successfully authenticated).
      break;
    case "002": // Ignoring all other numeric messages.
    case "003":
    case "004":
    case "353": // Tells you who else is in the chat room you're joining.
    case "366":
    case "372":
    case "375":
    case "376":
      return null;
    default:
      return null;
  }

  return parsedCommand; //{command: JOIN, channel: #bar}
}
