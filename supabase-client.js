// supabase-client.js - shared Supabase client instance
import { createClient } from "https://cdn.skypack.dev/@supabase/supabase-js@2.39.3";
import { ENV_CONFIG } from "./env.js";

export const supabase = createClient(
    ENV_CONFIG.SUPABASE_URL,
    ENV_CONFIG.SUPABASE_ANON_KEY
);


