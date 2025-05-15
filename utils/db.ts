import { createClient } from "../deps.ts";
import config from "../config/config.ts";

// export const supabase = createClient(config.supabase.url, config.supabase.key);
export const supabase = createClient(
  config.supabase.url,
  config.supabase.serviceKey,
  {
    auth: { persistSession: false },
  }
);
export const supabaseAdmin = createClient(
  config.supabase.url,
  config.supabase.serviceKey,
  { auth: { persistSession: false } }
);

export const handleDbError = (error: Error): never => {
  console.error("Database error:", error.message);
  throw new Error(`Database operation failed: ${error.message}`);
};
