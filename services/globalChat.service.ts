import { supabase, supabaseAdmin } from "../utils/db.ts";
import {
  createConversation,
  addMemberToGroup,
} from "../models/conversation.model.ts";

export async function createGlobalChat(): Promise<string> {
  try {
    const { data: existingChat, error: queryError } = await supabaseAdmin
      .from("conversations")
      .select("id")
      .eq("id", "00000000-0000-0000-0000-000000000001")
      .single();

    if (queryError && queryError.code !== "PGRST116") {
      throw new Error(`Error checking for global chat: ${queryError.message}`);
    }

    if (existingChat) {
      return existingChat.id;
    }

    const { data: systemUser, error: systemUserError } = await supabase
      .from("users")
      .select("id")
      .eq("username", "system")
      .single();

    let systemUserId: string;

    if (systemUserError) {
      const { data: newSystemUser, error: createError } = await supabaseAdmin
        .from("users")
        .insert({
          id: "00000000-0000-0000-0000-000000000000",
          username: "system",
          email: "system@gmail.com",
          status: "online",
        })
        .select()
        .single();

      if (createError) {
        throw new Error(`Failed to create system user: ${createError.message}`);
      }

      systemUserId = newSystemUser.id;
    } else {
      systemUserId = systemUser.id;
    }

    const { data: conversationData, error: insertError } = await supabaseAdmin
      .from("conversations")
      .insert({
        id: "00000000-0000-0000-0000-000000000001",
        name: "Global Chat",
        type: "group",
        created_by: systemUserId,
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Failed to create global chat: ${insertError.message}`);
    }

    await supabase.from("conversation_members").insert({
      conversation_id: "00000000-0000-0000-0000-000000000001",
      user_id: systemUserId,
      role: "admin",
    });

    return "00000000-0000-0000-0000-000000000001";
  } catch (error) {
    console.error("Error ensuring global chat exists:", error);
    throw error;
  }
}

export async function addUserToGlobalChat(userId: string): Promise<void> {
  try {
    const globalChatId = await createGlobalChat();
    console.log(
      `Checking if user ${userId} is already a member of the global chat...`
    );
    const { count, error: countError } = await supabaseAdmin
      .from("conversation_members")
      .select("*", { count: "exact", head: true })
      .eq("conversation_id", globalChatId)
      .eq("user_id", userId);

    console.log(`User ${userId} membership count: ${count}`);
    if (countError) {
      throw new Error(
        `Error checking global chat membership: ${countError.message}`
      );
    }

    if (count && count > 0) {
      return;
    }

    const { error } = await supabaseAdmin.from("conversation_members").insert({
      conversation_id: globalChatId,
      user_id: userId,
      role: "member",
    });
    console.log(`User ${userId} added to global chat`);
  } catch (error) {
    console.error("Error adding user to global chat:", error);
    throw error;
  }
}

export async function sendGlobalChatWelcomeMessage(
  username: string
): Promise<void> {
  try {
    const globalChatId = await createGlobalChat();
    const systemUserId = "00000000-0000-0000-0000-000000000000";

    await supabase.from("messages").insert({
      conversation_id: globalChatId,
      sender_id: systemUserId,
      message_type: "text",
      content: `Welcome ${username} to the Global Chat! 👋`,
    });
  } catch (error) {
    console.error("Error sending welcome message:", error);
  }
}
