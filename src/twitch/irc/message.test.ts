import { describe, expect, test } from "@jest/globals";

const { ParseIrcMessage } = await import("./message.mts");

describe("ParseIrcMessage", () => {
  test("Throws on empty string", () => {
    expect(() => ParseIrcMessage("")).toThrow(/Could not parse message/);
  });

  describe("Identifier parse", () => {
    test("Throws if identifier not found, no tags", () => {
      expect(() => ParseIrcMessage("PRIVMSG")).toThrow(
        /.*Message identifier not found/
      );
    });
    test("Throws if identifier not after tags", () => {
      expect(() => ParseIrcMessage("@tags=true PRIVMSG :other_stuff")).toThrow(
        /.*Message identifier not found.*/
      );
    });
    test("Throws if identifier not found", () => {
      expect(() => ParseIrcMessage("@tags=true PRIVMSG")).toThrow(
        /.*Message identifier not found.*/
      );
    });
  });

  describe("IrcMessageChannelCommand", () => {
    test("353 - Returns null", () => {
      const test = `:foo!bar@baz.tmi.twitch.tv 353 #le_channel :epicFunEmoji`;
      expect(ParseIrcMessage(test)).toBe(null);
    });
  });

  describe("IrcMessageTaggedCommands", () => {
    describe("PRIVMSG", () => {
      test("Parses without tags", () => {
        const test = `:foo!bar@baz.tmi.twitch.tv PRIVMSG #le_channel :epicFunEmoji this is a long message with stuff`;
        const expected = {
          command: "PRIVMSG",
          channel: "#le_channel",
          identifier: {
            name: "foo",
            alt: "bar",
            host: "baz.tmi.twitch.tv",
          },
          tags: undefined,
        } as const;

        expect(ParseIrcMessage(test)).toMatchObject(expected);
      });

      test("Parses tags", () => {
        const test = `:foo!bar@baz.tmi.twitch.tv PRIVMSG #le_channel :epicFunEmoji this is a long message with stuff`;
        const expected = {
          command: "PRIVMSG",
          channel: "#le_channel",
          identifier: {
            name: "foo",
            alt: "bar",
            host: "baz.tmi.twitch.tv",
          },
          tags: undefined,
        } as const;

        expect(ParseIrcMessage(test)).toMatchObject(expected);
      });
    });
  });
});
