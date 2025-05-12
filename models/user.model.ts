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

    const { data, error } = await supabaseAdmin
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
