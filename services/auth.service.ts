import { supabase } from "../utils/db.ts";
import {
  createUser,
  getUserById,
  updateUserStatus,
} from "../models/user.model.ts";
import {
  UserRegistration,
  AuthResponse,
  UserCredentials,
} from "../types/auth.type.ts";
import {
  addUserToGlobalChat,
  sendGlobalChatWelcomeMessage,
} from "./globalChat.service.ts";
import { wsManager } from "../utils/wsManager.ts";

export async function registerUser(
  userData: UserRegistration
): Promise<AuthResponse> {
  try {
    const user = await createUser(userData);

    await addUserToGlobalChat(user.id);
    await sendGlobalChatWelcomeMessage(user.username);

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

export async function loginUser(
  credentials: UserCredentials
): Promise<AuthResponse> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });

    if (error) throw new Error(error.message);

    const userId = data.user?.id;
    if (!userId) throw new Error("User ID not found");
    const user = await getUserById(userId);
    // await updateUserStatus(userId, "online");

    return {
      user,
      token: data.session?.access_token || null,
    };
  } catch (error) {
    console.error("Login error:", error);
    return {
      user: null,
      token: null,
      error: error.message,
    };
  }
}

export async function logoutUser(
  token: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const userId = payload.sub;
    if (!userId) throw new Error("Invalid token");

    // await updateUserStatus(userId, "offline");
    await supabase.auth.signOut();
    return { success: true };
  } catch (error) {
    console.error("Logout error:", error);
    return { success: false, error: error.message };
  }
}
