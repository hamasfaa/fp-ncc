import { supabase, handleDbError } from "../utils/db.ts";
import { Message, ReadReceipt } from "../types/chat.type.ts";

export async function sendMessage(
  conversationId: string,
  senderId: string,
  messageType: "text" | "attachment" | "poll",
  content: string
): Promise<Message> {
  try {
    const { count, error: memberError } = await supabase
      .from("conversation_members")
      .select("*", { count: "exact", head: true })
      .eq("conversation_id", conversationId)
      .eq("user_id", senderId);

    if (memberError) {
      console.error("Error counting membership:", memberError);
      throw new Error(memberError.message);
    }
    if (count === 0)
      throw new Error("User is not a member of this conversation");

    const { data: message, error } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: senderId,
        message_type: messageType,
        content,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    await supabase
      .from("conversations")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", conversationId);

    return message;
  } catch (error) {
    console.error("Error in sendMessage:", error);
    return handleDbError(error);
  }
}

export async function getConversationMessages(
  conversationId: string,
  limit = 50,
  before?: string
): Promise<Message[]> {
  try {
    let query = supabase
      .from("messages")
      .select(
        `
        *,
        sender:sender_id(id, username, avatar_url),
        attachments(*)
      `
      )
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (before) {
      const { data: beforeMsg } = await supabase
        .from("messages")
        .select("created_at")
        .eq("id", before)
        .single();

      if (beforeMsg) {
        query = query.lt("created_at", beforeMsg.created_at);
      }
    }

    const { data, error } = await query;

    if (error) throw new Error(error.message);
    return data || [];
  } catch (error) {
    console.error("Error in getConversationMessages:", error);
    return [];
  }
}

export async function markMessageAsRead(
  messageId: string,
  userId: string
): Promise<void> {
  try {
    const { data: message, error: msgError } = await supabase
      .from("messages")
      .select("conversation_id, sender_id")
      .eq("id", messageId)
      .single();

    if (msgError) throw new Error(msgError.message);

    if (message.sender_id === userId) {
      return;
    }

    const { error: readError } = await supabase
      .from("read_receipts")
      .insert({
        message_id: messageId,
        user_id: userId,
      })
      .single();

    if (readError && readError.code !== "23505") {
      throw new Error(readError.message);
    }

    await supabase
      .from("conversation_members")
      .update({
        last_read_message_id: messageId,
      })
      .eq("conversation_id", message.conversation_id)
      .eq("user_id", userId);
  } catch (error) {
    console.error("Error in markMessageAsRead:", error);
  }
}

export async function getMessageReadReceipts(
  messageId: string
): Promise<ReadReceipt[]> {
  try {
    const { data, error } = await supabase
      .from("read_receipts")
      .select("*, user:user_id(id, username, avatar_url)")
      .eq("message_id", messageId);

    if (error) throw new Error(error.message);
    return data || [];
  } catch (error) {
    console.error("Error in getMessageReadReceipts:", error);
    return [];
  }
}
