type MessageBase<Metadata, Payload> = {
  metadata: Metadata;
  payload: Payload;
};

export type EventsubWelcomeMessage = MessageBase<
  {
    message_id: string;
    message_type: "session_welcome";
    message_timestamp: string;
  },
  {
    session: {
      id: string;
      status: "connected";
      connected_at: string;
      keepalive_timeout_seconds: number;
      reconnect_url: null;
    };
  }
>;

export type EventsubKeepaliveMessage = MessageBase<
  {
    message_id: string;
    message_type: "session_keepalive";
    message_timestamp: string;
  },
  {}
>;

export type EventsubNotificationMessage = MessageBase<
  {
    message_id: string;
    message_type: "notification";
    message_timestamp: string;
    subscription_type: string;
  },
  {}
>;

export type EventsubMessage =
  | EventsubKeepaliveMessage
  | EventsubWelcomeMessage
  | EventsubNotificationMessage;
