import { supabaseAdmin, supabase, handleDbError } from "../utils/db.ts";
import { User, UserRegistration } from "../types/auth.type.ts";

export async function createUser(userData: UserRegistration): Promise<User> {
  try {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.password,
    });

    if (authError) throw new Error(authError.message);
    if (!authData.user) throw new Error("Failed to create user");

    const { data, error } = await supabase
      .from("users")
      .insert({
        id: authData.user.id,
        username: userData.username,
        email: userData.email,
        status: "offline",
        last_seen: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    return data;
  } catch (error) {
    return handleDbError(error);
  }
}

export async function getUserById(userId: string): Promise<User | null> {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) throw new Error(error.message);
    return data;
  } catch (error) {
    console.error("Error in getUserById:", error);
    return null;
  }
}

export async function searchUsers(query: string): Promise<User[]> {
  try {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .ilike("username", `%${query}%`)
      .limit(20);

    if (error) throw new Error(error.message);
    return data || [];
  } catch (error) {
    console.error("Error in searchUsers:", error);
    return [];
  }
}

export async function updateUserStatus(
  userId: string,
  status: string
): Promise<void> {
  try {
    const { error } = await supabase
      .from("users")
      .update({ status, last_seen: new Date().toISOString() })
      .eq("id", userId);

    if (error) throw new Error(error.message);
  } catch (error) {
    console.error("Error in updateUserStatus:", error);
  }
}
