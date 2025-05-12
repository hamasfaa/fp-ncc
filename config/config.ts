import { load } from "../deps.ts";

await load({ export: true });

export default {
  supabase: {
    url: Deno.env.get("SUPABASE_URL"),
    key: Deno.env.get("SUPABASE_KEY"),
    serviceKey: Deno.env.get("SUPABASE_SERVICE_KEY"),
    jwtSecret: Deno.env.get("SUPABASE_JWT_SECRET"),
  },
  server: {
    port: Number(Deno.env.get("PORT")),
    host: Deno.env.get("HOST"),
  },
  fileStorage: {
    uploadDir: Deno.env.get("UPLOAD_DIR"),
    maxSize: Number(Deno.env.get("MAX_FILE_SIZE")),
  },
};
