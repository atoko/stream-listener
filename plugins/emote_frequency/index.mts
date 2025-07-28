import { type ParsedMessage  } from "../../src/sdk/twitch/message.mts";
import { appendFileSync, mkdirSync } from "fs";

const id = Date.now();
mkdirSync(`./runtime/output/`, { recursive: true });
appendFileSync(`./runtime/output/${id}_histogram`, "timestamp|emotes\n");

type EmoteTags = {
  emotes?: Record<string, Array<{ startPosition: string, endPosition: string}>>
}

const timestampToMinute = (timestamp: number) => {
  return Math.floor(timestamp / 30000);
}

const initializeEmoteFrequency = () => ({
  emoteFrequencyMap: new Map(),
  lastTimestamp: timestampToMinute(Date.now())
} as {
  emoteFrequencyMap?: Map<string, number>;
  lastTimestamp: number;
});

export type EmoteFrequencyState = ReturnType<typeof initializeEmoteFrequency>;

export default (state?: EmoteFrequencyState, message?: ParsedMessage) => {
  if (!state) {
    state = initializeEmoteFrequency();
  }

  if (!message) {
    return state;
  }

  if (message.command?.command === "PRIVMSG" && message.parameters) {
    let tags = message.tags as EmoteTags;
    if (tags["emotes"]) {
      let memo: Record<string, string> = {};
      Object.entries(tags["emotes"]).forEach(([key, value]) => {
        let text: string | undefined = undefined;

        if (key in memo) {
          text = memo[String(key)];
        } else {
          let first = value.at(0);
          if (first) {
            text = message.parameters?.slice(
                Number(first.startPosition),
                Number(first.endPosition) + 1
            )
            if (text) {
              memo[String(key)] = text;
            }
          }

        }

        if (text) {
          const current = state.emoteFrequencyMap?.get(text) ?? 0;
          state.emoteFrequencyMap?.set(text, current + value.length);

          appendFileSync(`./runtime/output/${id}_emotes`, `${Date.now()}|${text}`);
          appendFileSync(`./runtime/output/${id}_emotes`, "\n");
        }
      })
    }
  }

  const minute = timestampToMinute(Date.now());
  if (minute !== state.lastTimestamp && state.emoteFrequencyMap) {
    appendFileSync(`./runtime/output/${id}_histogram`, `${minute},${JSON.stringify(Object.fromEntries(state.emoteFrequencyMap))}\n`);
    state.emoteFrequencyMap = new Map();
    state.lastTimestamp = minute;
  }

  return {
    emoteFrequencyMap: state.emoteFrequencyMap,
    lastTimestamp: state.lastTimestamp,
  };
};
