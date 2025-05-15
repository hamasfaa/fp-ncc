import { supabase, handleDbError } from "../utils/db.ts";
import { Conversation, ConversationMember } from "../types/chat.type.ts";

export async function createConversation(
  createdBy: string,
  type: "personal" | "group",
  name?: string,
  members: string[] = []
): Promise<Conversation> {
  try {
    if (!members.includes(createdBy)) {
      members.push(createdBy);
    }

    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .insert({
        name: type === "group" ? name : null,
        type,
        created_by: createdBy,
      })
      .select()
      .single();

    if (convError) throw new Error(convError.message);

    const memberRows = members.map((userId) => ({
      conversation_id: conversation.id,
      user_id: userId,
      role: userId === createdBy ? "admin" : "member",
    }));
    const { error: memberError } = await supabase
      .from("conversation_members")
      .insert(memberRows);

    if (memberError) throw new Error(memberError.message);

    return conversation;
  } catch (error) {
    return handleDbError(error);
  }
}

export async function getPersonalConversation(
  user1Id: string,
  user2Id: string
): Promise<Conversation | null> {
  try {
    const { data, error } = await supabase.rpc("find_personal_conversation", {
      user_id1: user1Id,
      user_id2: user2Id,
    });

    if (error) throw new Error(error.message);
    return data;
  } catch (error) {
    console.error("Error in getPersonalConversation:", error);
    return null;
  }
}

export async function getUserConversations(
  userId: string
): Promise<Conversation[]> {
  try {
    const { data, error } = await supabase
      .from("conversations")
      .select(
        `
        *,
        conversation_members!inner(user_id)
      `
      )
      .eq("conversation_members.user_id", userId);

    if (error) throw new Error(error.message);
    return data || [];
  } catch (error) {
    console.error("Error in getUserConversations:", error);
    return [];
  }
}

export async function getConversationMembers(
  conversationId: string
): Promise<ConversationMember[]> {
  try {
    const { data, error } = await supabase
      .from("conversation_members")
      .select("*, users(id, username, email, avatar_url, status)")
      .eq("conversation_id", conversationId);

    if (error) throw new Error(error.message);
    return data || [];
  } catch (error) {
    console.error("Error in getConversationMembers:", error);
    return [];
  }
}

export async function addMemberToGroup(
  conversationId: string,
  userId: string,
  role: "admin" | "member" = "member"
): Promise<void> {
  try {
    const { data: conv, error: convError } = await supabase
      .from("conversations")
      .select("type")
      .eq("id", conversationId)
      .single();

    if (convError) throw new Error(convError.message);
    if (conv.type !== "group")
      throw new Error("Can only add members to group conversations");

    const { error } = await supabase.from("conversation_members").insert({
      conversation_id: conversationId,
      user_id: userId,
      role,
    });

    if (error) throw new Error(error.message);
  } catch (error) {
    handleDbError(error);
  }
}
