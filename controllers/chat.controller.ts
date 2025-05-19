import { Context } from "../deps.ts";
import {
  getUserChats,
  startOrGetPersonalChat,
  createGroupChat,
  addGroupMember,
  sendChatMessage,
  markAsRead,
} from "../services/chat.service.ts";
import { getConversationMessages } from "../models/message.model.ts";
import {
  addUserToGlobalChat,
  createGlobalChat,
} from "../services/globalChat.service.ts";
import { getGlobalStats } from "../utils/chat.ts";
import { supabase, supabaseAdmin } from "../utils/db.ts";

export async function getChats(ctx: Context) {
  try {
    const userId = ctx.state.user.id;
    const chats = await getUserChats(userId);

    ctx.response.status = 200;
    ctx.response.body = { chats };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { error: "Failed to retrieve chats" };
  }
}

export async function getMessages(ctx: Context) {
  try {
    const conversationId = ctx.params.id;

    const limit = parseInt(ctx.request.url.searchParams.get("limit") || "50");
    const before = ctx.request.url.searchParams.get("before") || undefined;

    const messages = await getConversationMessages(
      conversationId,
      limit,
      before
    );

    ctx.response.status = 200;
    ctx.response.body = { messages };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { error: "Failed to retrieve messages" };
  }
}

export async function getGlobalChat(ctx: Context) {
  try {
    const userId = ctx.state.user.id;
    await addUserToGlobalChat(userId);
    const globalChatId = await createGlobalChat();

    const { data: chat, error } = await supabase
      .from("conversations")
      .select(
        `
        *,
        members:conversation_members(
          user_id,
          role
        )
      `
      )
      .eq("id", globalChatId)
      .single();

    if (error) {
      throw new Error(`Failed to get global chat: ${error.message}`);
    }

    ctx.response.status = 200;
    ctx.response.body = { globalChat: chat };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { error: "Failed to get global chat" };
  }
}

export async function getAllGroupChats(ctx: Context) {
  try {
    const userId = ctx.state.user.id;
    const globalChatId = "00000000-0000-0000-0000-000000000001"; // Your global chat ID

    // Get all group chats except global chat
    const { data: groups, error } = await supabase
      .from("conversations")
      .select(
        `
        id,
        name,
        created_at,
        created_by,
        creator:created_by(username),
        member_count:conversation_members(count)
      `
      )
      .eq("type", "group")
      .neq("id", globalChatId)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    const enhancedGroups = await Promise.all(
      groups.map(async (group) => {
        const { count, error: memberError } = await supabase
          .from("conversation_members")
          .select("*", { count: "exact", head: true })
          .eq("conversation_id", group.id)
          .eq("user_id", userId);

        if (memberError) throw new Error(memberError.message);

        return {
          ...group,
          is_member: count ? count > 0 : false,
          member_count: group.member_count[0]?.count || 0,
        };
      })
    );

    ctx.response.status = 200;
    ctx.response.body = { groups: enhancedGroups };
  } catch (error) {
    console.error("Error fetching group chats:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Failed to fetch group chats" };
  }
}

export async function getGlobalChatStats(ctx: Context) {
  try {
    const stats = await getGlobalStats();

    ctx.response.status = 200;
    ctx.response.body = { stats };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { error: "Failed to get global chat statistics" };
  }
}

export async function createOrGetPersonalChat(ctx: Context) {
  try {
    const userId = ctx.state.user.id;
    const body = await ctx.request.body.json();
    const otherUserId = body.user_id;

    if (!otherUserId) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Other user ID is required" };
      return;
    }

    const conversation = await startOrGetPersonalChat(userId, otherUserId);

    ctx.response.status = 200;
    ctx.response.body = { conversation };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { error: "Failed to create or get chat" };
  }
}

export async function createNewGroupChat(ctx: Context) {
  try {
    const userId = ctx.state.user.id;
    const body = await ctx.request.body.json();

    if (!body.name) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Group name is required" };
      return;
    }

    const memberIds = Array.isArray(body.member_ids) ? body.member_ids : [];
    const conversation = await createGroupChat(userId, body.name, memberIds);

    ctx.response.status = 201;
    ctx.response.body = { conversation };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { error: "Failed to create group chat" };
  }
}

export async function addUserToGroup(ctx: Context) {
  try {
    const userId = ctx.state.user.id;
    const conversationId = ctx.params.id;
    const body = await ctx.request.body.json();
    const newMemberId = body.user_id;

    if (!newMemberId) {
      ctx.response.status = 400;
      ctx.response.body = { error: "User ID is required" };
      return;
    }

    const result = await addGroupMember(conversationId, userId, newMemberId);

    ctx.response.status = 200;
    ctx.response.body = result;
  } catch (error) {
    ctx.response.status = error.message.includes("admin") ? 403 : 500;
    ctx.response.body = { error: error.message };
  }
}

export async function sendMessage(ctx: Context) {
  try {
    const userId = ctx.state.user.id;
    const conversationId = ctx.params.id;
    const body = await ctx.request.body.json();

    if (!body.content) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Message content is required" };
      return;
    }

    const message = await sendChatMessage(
      userId,
      conversationId,
      body.content,
      "text"
    );

    ctx.response.status = 201;
    ctx.response.body = { message };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { error: "Failed to send message" };
  }
}

export async function markMessageRead(ctx: Context) {
  try {
    const userId = ctx.state.user.id;
    const messageId = ctx.params.id;

    const result = await markAsRead(userId, messageId);

    ctx.response.status = 200;
    ctx.response.body = result;
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { error: "Failed to mark message as read" };
  }
}
