import { searchUsers, getUserById } from "../models/user.model.ts";
import { Context } from "../deps.ts";
import { supabase } from "../utils/db.ts";

export async function getAllUsers(ctx: Context) {
  try {
    const { data: users, error } = await supabase
      .from("users")
      .select("id, username, email, avatar_url, status, last_seen");

    if (error) throw new Error(error.message);

    ctx.response.status = 200;
    ctx.response.body = { users };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { error: "Failed to retrieve users" };
  }
}

export async function searchUsersCont(ctx: Context) {
  try {
    const query = ctx.request.url.searchParams.get("query") || "";

    console.log("Search query:", query);

    if (query.length < 2) {
      ctx.response.status = 400;
      ctx.response.body = {
        error: "Search query must be at least 2 characters",
      };
      return;
    }

    const users = await searchUsers(query);

    ctx.response.status = 200;
    ctx.response.body = { users };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { error: "Search failed" };
  }
}

export async function getUserDetails(ctx: Context) {
  try {
    const userId = ctx.params.id;

    if (!userId) {
      ctx.response.status = 400;
      ctx.response.body = { error: "User ID is required" };
      return;
    }

    const user = await getUserById(userId);

    if (!user) {
      ctx.response.status = 404;
      ctx.response.body = { error: "User not found" };
      return;
    }

    ctx.response.status = 200;
    ctx.response.body = { user };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { error: "Failed to get user details" };
  }
}
