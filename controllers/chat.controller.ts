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

    const { data: memberships, error: membershipError } = await supabase
      .from("conversation_members")
      .select("conversation_id")
      .eq("user_id", userId);

    if (membershipError) throw new Error(membershipError.message);

    const conversationIds = memberships.map((m) => m.conversation_id);

    if (conversationIds.length === 0) {
      ctx.response.status = 200;
      ctx.response.body = { groups: [] };
      return;
    }

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
      .in("id", conversationIds)
      .order("created_at", { ascending: false });

    if (error) throw new Error(error.message);

    const userGroups = groups.map((group) => {
      return {
        ...group,
        is_member: true,
        member_count: group.member_count[0]?.count || 0,
      };
    });

    ctx.response.status = 200;
    ctx.response.body = { groups: userGroups };
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

export async function leaveGroupChat(ctx: Context) {
  try {
    const userId = ctx.state.user.id;
    const groupId = ctx.params.id;
    const globalChatId = "00000000-0000-0000-0000-000000000001";

    if (groupId === globalChatId) {
      ctx.response.status = 400;
      ctx.response.body = { error: "You cannot leave the global chat" };
      return;
    }

    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .select("id, type")
      .eq("id", groupId)
      .eq("type", "group")
      .single();

    if (convError || !conversation) {
      ctx.response.status = 404;
      ctx.response.body = { error: "Group chat not found" };
      return;
    }

    const { data: membership, error: memberError } = await supabase
      .from("conversation_members")
      .select("role")
      .eq("conversation_id", groupId)
      .eq("user_id", userId)
      .single();

    if (memberError) {
      ctx.response.status = 400;
      ctx.response.body = { error: "You are not a member of this group" };
      return;
    }

    if (membership.role === "admin") {
      const { error: deleteMembersError } = await supabase
        .from("conversation_members")
        .delete()
        .eq("conversation_id", groupId);

      if (deleteMembersError) throw new Error(deleteMembersError.message);

      const { error: deleteMessagesError } = await supabase
        .from("messages")
        .delete()
        .eq("conversation_id", groupId);

      if (deleteMessagesError) throw new Error(deleteMessagesError.message);

      try {
        const { data: pollMessages } = await supabase
          .from("messages")
          .select("id")
          .eq("conversation_id", groupId)
          .eq("message_type", "poll");

        if (pollMessages && pollMessages.length > 0) {
          const messageIds = pollMessages.map((msg) => msg.id);

          const { error: deleteVotesError } = await supabase
            .from("poll_votes")
            .delete()
            .in(
              "poll_option_id",
              supabase
                .from("poll_options")
                .select("id")
                .in(
                  "poll_id",
                  supabase
                    .from("polls")
                    .select("id")
                    .in("message_id", messageIds)
                )
            );

          if (deleteVotesError)
            console.error("Error deleting poll votes:", deleteVotesError);

          const { error: deleteOptionsError } = await supabase
            .from("poll_options")
            .delete()
            .in(
              "poll_id",
              supabase.from("polls").select("id").in("message_id", messageIds)
            );

          if (deleteOptionsError)
            console.error("Error deleting poll options:", deleteOptionsError);

          const { error: deletePollsError } = await supabase
            .from("polls")
            .delete()
            .in("message_id", messageIds);

          if (deletePollsError)
            console.error("Error deleting polls:", deletePollsError);
        }
      } catch (pollError) {
        console.error("Error cleaning up polls:", pollError);
      }

      const { error: deleteConvError } = await supabase
        .from("conversations")
        .delete()
        .eq("id", groupId);

      if (deleteConvError) throw new Error(deleteConvError.message);

      ctx.response.status = 200;
      ctx.response.body = {
        success: true,
        message: "Group has been disbanded",
        group_id: groupId,
        disbanded: true,
      };
    } else {
      const { error: leaveError } = await supabase
        .from("conversation_members")
        .delete()
        .eq("conversation_id", groupId)
        .eq("user_id", userId);

      if (leaveError) throw new Error(leaveError.message);

      ctx.response.status = 200;
      ctx.response.body = {
        success: true,
        message: "Successfully left the group",
        group_id: groupId,
        disbanded: false,
      };
    }
  } catch (error) {
    console.error("Error leaving group chat:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Failed to leave group" };
  }
}

export async function joinGroupChat(ctx: Context) {
  try {
    const userId = ctx.state.user.id;
    const body = await ctx.request.body.json();

    if (
      !body.name ||
      typeof body.name !== "string" ||
      body.name.trim() === ""
    ) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Group name is required" };
      return;
    }

    const groupName = body.name.trim();

    const { data: groups, error: findError } = await supabase
      .from("conversations")
      .select("id, name, type")
      .eq("type", "group")
      .ilike("name", groupName);

    if (findError) throw new Error(findError.message);

    if (!groups || groups.length === 0) {
      ctx.response.status = 404;
      ctx.response.body = { error: `No group found with name '${groupName}'` };
      return;
    }

    let targetGroup = groups[0];
    if (groups.length > 1) {
      const exactMatch = groups.find(
        (g) => g.name.toLowerCase() === groupName.toLowerCase()
      );
      if (exactMatch) {
        targetGroup = exactMatch;
      }
    }

    const { count, error: countError } = await supabase
      .from("conversation_members")
      .select("*", { count: "exact", head: true })
      .eq("conversation_id", targetGroup.id)
      .eq("user_id", userId);

    if (countError) throw new Error(countError.message);

    if (count && count > 0) {
      ctx.response.status = 400;
      ctx.response.body = {
        error: "You are already a member of this group",
        group: targetGroup,
      };
      return;
    }

    const { error: joinError } = await supabase
      .from("conversation_members")
      .insert({
        conversation_id: targetGroup.id,
        user_id: userId,
        role: "member",
      });

    if (joinError) throw new Error(joinError.message);

    const { data: userData } = await supabase
      .from("users")
      .select("username")
      .eq("id", userId)
      .single();

    console.log(
      `User ${userData?.username} (${userId}) joined group ${
        targetGroup.name
      } (${targetGroup.id}) at ${new Date().toISOString()}`
    );

    ctx.response.status = 200;
    ctx.response.body = {
      success: true,
      message: `Successfully joined group '${targetGroup.name}'`,
      group: targetGroup,
    };
  } catch (error) {
    console.error("Error joining group by name:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Failed to join group" };
  }
}
