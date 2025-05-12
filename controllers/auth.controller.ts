import { Context } from "../deps.ts";
import { registerUser } from "../services/auth.service.ts";
import { UserRegistration } from "../types/auth.type.ts";

export async function register(ctx: Context) {
  try {
    const body = await ctx.request.body.json();
    const userData: UserRegistration = {
      username: body.username,
      email: body.email,
      password: body.password,
    };

    if (!userData.username || !userData.email || !userData.password) {
      ctx.response.status = 400;
      ctx.response.body = {
        error: "Username, email and password are required",
      };
      return;
    }

    const result = await registerUser(userData);

    if (result.error) {
      ctx.response.status = 400;
      ctx.response.body = { error: result.error };
      return;
    }

    ctx.response.status = 201;
    ctx.response.body = {
      user: result.user,
      token: result.token,
    };
  } catch (error) {
    console.error("Registration error:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Registration failed" };
  }
}
