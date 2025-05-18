import {
  createConversation,
  getPersonalConversation,
  getUserConversations,
  getConversationMembers,
  addMemberToGroup,
} from "../models/conversation.model.ts";
import {
  sendMessage,
  getConversationMessages,
  markMessageAsRead,
  getMessageReadReceipts,
} from "../models/message.model.ts";
import { MessageType } from "../types/ws.type.ts";
import { supabase } from "../utils/db.ts";
import { wsManager } from "../utils/wsManager.ts";

export async function startOrGetPersonalChat(
  userId: string,
  otherUserId: string
) {
  let conversation = await getPersonalConversation(userId, otherUserId);

  if (
    !conversation ||
    (Array.isArray(conversation) && conversation.length === 0)
  ) {
    conversation = await createConversation(userId, "personal", undefined, [
      userId,
      otherUserId,
    ]);
  }

  return conversation;
}

export async function createGroupChat(
  userId: string,
  name: string,
  memberIds: string[]
) {
  return await createConversation(userId, "group", name, [
    ...new Set([userId, ...memberIds]),
  ]);
}

export async function sendChatMessage(
  userId: string,
  conversationId: string,
  content: string,
  type: "text" | "attachment" | "poll" = "text"
) {
  const message = await sendMessage(conversationId, userId, type, content);

  await wsManager.sendToConversation(conversationId, {
    type: MessageType.TEXT,
    data: message,
    conversation_id: conversationId,
    sender_id: userId,
    timestamp: Date.now(),
    sender: {},
  });

  return message;
}

export async function markAsRead(userId: string, messageId: string) {
  await markMessageAsRead(messageId, userId);

  const { data: message } = await supabase
    .from("messages")
    .select("conversation_id, sender_id")
    .eq("id", messageId)
    .single();

  if (message) {
    await wsManager.sendToConversation(message.conversation_id, {
      type: MessageType.READ_RECEIPT,
      data: {
        message_id: messageId,
        user_id: userId,
        read_at: new Date().toISOString(),
      },
      conversation_id: message.conversation_id,
      sender_id: userId,
      timestamp: Date.now(),
      sender: {},
    });
  }
  return { success: true };
}

export async function getReadStatus(messageId: string) {
  return await getMessageReadReceipts(messageId);
}

export async function getUserChats(userId: string) {
  const conversations = await getUserConversations(userId);

  const enhancedConversations = await Promise.all(
    conversations.map(async (conversation) => {
      const messages = await getConversationMessages(conversation.id, 1);
      const lastMessage = messages[0] || null;

      const members = await getConversationMembers(conversation.id);

      const isGlobalChat =
        conversation.id === "00000000-0000-0000-0000-000000000001";

      return {
        ...conversation,
        last_message: lastMessage,
        members: members.map((m) => m.user_id),
        is_global_chat: isGlobalChat,
      };
    })
  );

  return enhancedConversations;
}

export async function addGroupMember(
  conversationId: string,
  userId: string,
  newMemberId: string
) {
  const { data: member, error } = await supabase
    .from("conversation_members")
    .select("role")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .single();

  if (error || member?.role !== "admin") {
    throw new Error("Only group admins can add members");
  }

  await addMemberToGroup(conversationId, newMemberId);
  return { success: true };
}
