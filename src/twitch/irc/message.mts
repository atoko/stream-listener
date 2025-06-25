import VError from "verror";
import { Logger } from "../../logging.mjs";

const logger = Logger.child().withPrefix("[IRC_MESSAGE]");

type IrcMessageTags = `@${string}=${string}`;

const IRC_MESSAGE_IDENTIFIER_DELIMITER = [":", "!", "@"];
export type IrcMessageIdentifier = `:${string}!${string}@${string}`;
export type IrcIdentifier = {
  name: string;
  alt: string;
  host: string;
};

const _IrcMessageChannelCommand = [
  "JOIN",
  "PART",
  "HOSTTARGET",
  "PING",
  "CAP",
  "USERSTATE", // Included only if you request the /commands capability.
  "ROOMSTATE", // But it has no meaning without also including the /tags capabilities.
  "RECONNECT",
  "421",
  "001", // Logged in (successfully authenticated).
  "002", // Ignoring all other numeric messages.
  "003",
  "004",
  "353", // Tells you who else is in the chat room you're joining.
  "366",
  "372",
  "375",
  "376",
] as const;
let isIrcMessageIdentifier = (
  identifier: string,
): identifier is IrcMessageIdentifier => {
  return IRC_MESSAGE_IDENTIFIER_DELIMITER.every((delimiter) =>
    identifier.includes(delimiter),
  );
};

export type IrcMessageChannelCommand =
  (typeof _IrcMessageChannelCommand)[number];
const _IrcMessageTaggedCommands = [
  "CLEARCHAT",
  "GLOBALUSERSTATE", // Included only if you request the /commands capability.
  // But it has no meaning without also including the /tags capability.
  "PRIVMSG",
  "NOTICE",
] as const;
export type IrcMessageTaggedCommand =
  (typeof _IrcMessageTaggedCommands)[number];
export type IrcMessageCommand =
  | IrcMessageTaggedCommand
  | IrcMessageChannelCommand;
export type IrcMessage =
  `${IrcMessageTags}${IrcMessageIdentifier} ${IrcMessageCommand} ${string}`;

export const ParseIrcMessage = (message: string | IrcMessage) => {
  const stack = message.split(" ");
  if (!stack.length) {
    throw new VError(
      {
        info: {
          message,
        },
      },
      "Could not parse message",
    );
  }
  const tags: IrcMessageTags | undefined = stack[0].startsWith("@")
    ? (stack.shift() as IrcMessageTags)
    : undefined;
  if (!stack[0]?.startsWith(":")) {
    throw new VError(
      {
        info: {
          stack,
        },
      },
      "Message identifier not found",
    );
  }
  const identifierJson: IrcMessageIdentifier =
    stack.shift() as IrcMessageIdentifier;
  let identifier: IrcIdentifier | undefined;

  if (isIrcMessageIdentifier(identifierJson)) {
    const [name, alt, host] = IRC_MESSAGE_IDENTIFIER_DELIMITER.map(
      (delimiter: string, order) => {
        const from = identifierJson.indexOf(delimiter);
        let to = identifierJson.length - 1;
        if (order !== IRC_MESSAGE_IDENTIFIER_DELIMITER.length - 1) {
          to = identifierJson.indexOf(
            IRC_MESSAGE_IDENTIFIER_DELIMITER[order + 1],
          );
        }
        return identifierJson.slice(from, to);
      },
    );

    identifier = {
      name,
      alt,
      host,
    };
  } else {
    throw new VError("Could not parse message identifier");
  }

  const [command, channel, command421]: [IrcMessageCommand, string, string?] =
    (stack.shift()?.split(" ") as [IrcMessageCommand, string]) ?? [];
  if (_IrcMessageChannelCommand.includes(command as IrcMessageChannelCommand)) {
    switch (command) {
      case "RECONNECT":
        logger.info(
          "The Twitch IRC server is about to terminate the connection for maintenance.",
        );
        break;
      case "421":
        logger.info(`Unsupported IRC command: ${command421}`);
        return null;
      case "001":
        break;
      case "002": // Ignoring all other numeric messages.
      case "003":
      case "004":
      case "353": // Tells you who else is in the chat room you're joining.
      case "366":
      case "372":
      case "375":
      case "376":
        logger.info(`Numeric message: ${command}`);
        return null;
    }

    return {
      command,
      channel,
      identifier,
    } as const;
  } else if (
    _IrcMessageTaggedCommands.includes(command as IrcMessageTaggedCommand)
  ) {
    return {
      command,
      channel,
      tags,
    } as const;
  } else {
    throw new VError("Could not parse command");
  }

  throw new VError(
    {
      info: {
        stack,
      },
    },
    "Could not parse message identifier",
  );
};
