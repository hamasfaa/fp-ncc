import { Context, verify } from "../deps.ts";
import config from "../config/config.ts";
import { supabase } from "../utils/db.ts";

const getKey = async (): Promise<CryptoKey> => {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(config.supabase.jwtSecret);
  return await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
};

export const authMiddleware = async (ctx: Context, next: Next) => {
  try {
    const authHeader = ctx.request.headers.get("Authorization");

    if (!authHeader) {
      ctx.response.status = 401;
      ctx.response.body = { error: "Authorization header missing" };
      return;
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      ctx.response.status = 401;
      ctx.response.body = { error: "Token missing" };
      return;
    }

    try {
      const key = await getKey();
      const payload = await verify(token, key);

      ctx.state.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role || "user",
      };

      await next();
    } catch (err) {
      ctx.response.status = 401;
      ctx.response.body = { error: "Invalid token" };
    }
  } catch (err) {
    ctx.response.status = 500;
    ctx.response.body = { error: "Authentication error" };
  }
};
