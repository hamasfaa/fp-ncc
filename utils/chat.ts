import { supabase, supabaseAdmin } from "./db.ts";

export async function getGlobalStats() {
  try {
    const { data: membersData, error: membersError } = await supabaseAdmin
      .from("conversation_members")
      .select("user_id")
      .eq("conversation_id", "00000000-0000-0000-0000-000000000001");

    if (membersError) {
      throw new Error(`Error fetching members: ${membersError.message}`);
    }

    const userIds = membersData?.map((member) => member.user_id) || [];

    const { count: onlineCount, error: onlineError } = await supabaseAdmin
      .from("users")
      .select("*", { count: "exact", head: true })
      .eq("status", "online")
      .in("id", userIds);

    if (onlineError) {
      throw new Error(`Error counting online users: ${onlineError.message}`);
    }

    const { count: memberCount, error: memberCountError } = await supabaseAdmin
      .from("conversation_members")
      .select("*", { count: "exact", head: true })
      .eq("conversation_id", "00000000-0000-0000-0000-000000000001");

    if (memberCountError) {
      throw new Error(
        `Error counting total members: ${memberCountError.message}`
      );
    }

    const { count: messageCount, error: messageCountError } =
      await supabaseAdmin
        .from("messages")
        .select("*", { count: "exact", head: true })
        .eq("conversation_id", "00000000-0000-0000-0000-000000000001");

    if (messageCountError) {
      throw new Error(`Error counting messages: ${messageCountError.message}`);
    }

    console.log(
      `Global chat stats - Total Members: ${memberCount}, Active Members: ${onlineCount}, Total Messages: ${messageCount}`
    );

    return {
      totalMembers: memberCount || 0,
      activeMembers: onlineCount || 0,
      totalMessages: messageCount || 0,
    };
  } catch (error) {
    console.error("Error getting global chat stats:", error);
    return {
      totalMembers: 0,
      activeMembers: 0,
      totalMessages: 0,
    };
  }
}
