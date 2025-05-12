export interface Conversation {
  id: string;
  name?: string;
  type: "personal" | "group";
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

export interface ConversationMember {
  id: string;
  conversation_id: string;
  user_id: string;
  role: "admin" | "member";
  joined_at: Date;
  last_read_message_id?: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  message_type: "text" | "attachment" | "poll";
  content: string;
  is_edited: boolean;
  is_deleted: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Attachment {
  id: string;
  message_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  file_path: string;
  thumbnail_path?: string;
  created_at: Date;
}

export interface ReadReceipt {
  id: string;
  message_id: string;
  user_id: string;
  read_at: Date;
}
