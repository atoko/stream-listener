import EventEmitter from "events";
export * from "../../twitch/api/eventsub.mjs";

type TwitchSubscription = "channel.channel_points_custom_reward_redemption.add";

export class Subscription extends EventEmitter {}
export const eventsub = (() => {
  return {
    subscribe: (type: TwitchSubscription | string) => {
      const emitter = new Subscription();
      return emitter;
    },
  };
})();
