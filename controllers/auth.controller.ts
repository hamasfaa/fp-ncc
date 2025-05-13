import { Context } from "../deps.ts";
import {
  loginUser,
  logoutUser,
  registerUser,
} from "../services/auth.service.ts";
import { UserRegistration, UserCredentials } from "../types/auth.type.ts";

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
    ctx.response.status = 500;
    ctx.response.body = { error: "Registration failed" };
  }
}

export async function login(ctx: Context) {
  try {
    const body = await ctx.request.body.json();
    const credentials: UserCredentials = {
      email: body.email,
      password: body.password,
    };

    if (!credentials.email || !credentials.password) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Email and password are required" };
      return;
    }

    const result = await loginUser(credentials);

    if (result.error) {
      ctx.response.status = 401;
      ctx.response.body = { error: result.error };
      return;
    }

    ctx.response.status = 200;
    ctx.response.body = {
      user: result.user,
      token: result.token,
    };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { error: "Login failed" };
  }
}

export async function logout(ctx: Context) {
  try {
    const token = ctx.request.headers.get("Authorization")?.split(" ")[1] || "";

    const result = await logoutUser(token);

    if (result.error) {
      ctx.response.status = 400;
      ctx.response.body = { error: result.error };
      return;
    }

    ctx.response.status = 200;
    ctx.response.body = { message: "Successfully logged out" };
  } catch (error) {
    ctx.response.status = 500;
    ctx.response.body = { error: "Logout failed" };
  }
}
