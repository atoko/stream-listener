import { describe, expect, test } from "@jest/globals";

const { ParseIrcMessage } = await import("./message.mts");

describe("ParseIrcMessage", () => {
  describe("Static methods", () => {
    test("state", () => {
      const test = `:foo!bar@baz.tmi.twitch.tv PRIVMSG #le_channel :epicFunEmoji`;
      const expected = {
        command: "PRIVMSG",
        channel: "#le_channel",
        identifier: {
          name: "foo",
          alt: "bar",
          host: "baz.tmi.twitch.tv",
        },
      } as const;

      expect(ParseIrcMessage(test)).toMatchObject(expected);
    });
  });
});
