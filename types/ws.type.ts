export interface WsConnection {
  id: string;
  userId: string;
  socket: WebSocket;
}

export enum MessageType {
  TEXT = "text",
  FILE = "file",
  POLL = "poll",
  READ_RECEIPT = "read_receipt",
  USER_STATUS = "user_status",
}

export interface WsMessage {
  type: MessageType;
  data: any;
  conversation_id: string;
  sender_id: string;
  timestamp: number;
  sender: {};
}

export interface WsError {
  code: number;
  message: string;
}
