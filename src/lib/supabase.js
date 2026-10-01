import { createClient } from "@supabase/supabase-js";

const url = (import.meta.env.VITE_SUPABASE_URL || "").trim().replace(/\/+$/, "").replace(/\/rest\/v1$/, "");
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim().replace(/^["']|["']$/g, "");

export const configured = Boolean(url && key);
export let configError = "";
let client = null;
if (configured) {
  try {
    if (!/^https:\/\/[^/]+$/.test(url)) throw new Error(`VITE_SUPABASE_URL should look like https://abcd1234.supabase.co (it is "${url.slice(0, 60)}")`);
    client = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "implicit" } });
  } catch (e) {
    configError = e.message || String(e);
  }
}
export const supabase = client;
