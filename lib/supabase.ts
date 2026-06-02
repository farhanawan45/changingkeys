import { createClient, SupabaseClient } from "@supabase/supabase-js";

let cachedSupabaseClient: SupabaseClient | null = null;

function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is required to initialize Supabase. Set this env var in Vercel."
    );
  }
  return url;
}

function getSupabaseAnonKey() {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY is required to initialize Supabase. Set this env var in Vercel."
    );
  }
  return anonKey;
}

function createSupabaseClient() {
  // Prefer the service role key for server-side operations when available.
  // Falls back to the public anon key when the service role key is not set.
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const key = serviceRole || getSupabaseAnonKey();

  if (serviceRole) {
    console.log("Supabase: initializing client with service role key (server)");
  } else {
    console.log("Supabase: initializing client with anon/public key (fallback)");
  }

  return createClient(getSupabaseUrl(), key);
}

function getSupabaseClient() {
  if (!cachedSupabaseClient) {
    cachedSupabaseClient = createSupabaseClient();
  }
  return cachedSupabaseClient;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = getSupabaseClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
  set(_target, prop, value) {
    return Reflect.set(getSupabaseClient() as any, prop, value);
  },
  has(_target, prop) {
    return Reflect.has(getSupabaseClient(), prop);
  },
});

export function getSupabase() {
  return getSupabaseClient();
}
