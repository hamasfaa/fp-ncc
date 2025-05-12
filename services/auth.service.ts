import { supabase } from "../utils/db.ts";
import { createUser } from "../models/user.model.ts";
import { UserRegistration, AuthResponse } from "../types/auth.type.ts";

export async function registerUser(
  userData: UserRegistration
): Promise<AuthResponse> {
  try {
    const user = await createUser(userData);
    const { data: authData, error } = await supabase.auth.signInWithPassword({
      email: userData.email,
      password: userData.password,
    });

    if (error) throw new Error(error.message);

    return {
      user,
      token: authData.session?.access_token || null,
    };
  } catch (error) {
    console.error("Registration error:", error);
    return {
      user: null,
      token: null,
      error: error.message,
    };
  }
}
