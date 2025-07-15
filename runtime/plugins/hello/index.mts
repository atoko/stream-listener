import {type ActionCommandMessage} from "../../../module/twitch/api/chat.mjs";

export default (state?: {}, message?: ActionCommandMessage) => {
  if (!message) {
    return state ?? {};
  }

  if (message.action === "message") {
    console.log("Action: message");
  } else if (message.action === "join") {
    console.log("Action: join");
  } else {
    console.error("Unknown action command:", message);
  }

  return {};
};
