import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  
  // Extract token from cookies to pass authenticated context if present
  let accessToken = undefined;
  try {
    const cookieStore = cookies();
    // Supabase stores JWT in a cookie named like "sb-<project_ref>-auth-token"
    const supabaseAuthCookie = cookieStore.get("sb-" + new URL(supabaseUrl).hostname.split('.')[0] + "-auth-token");
    
    if (supabaseAuthCookie?.value) {
      try {
        const parsedToken = JSON.parse(supabaseAuthCookie.value);
        accessToken = parsedToken.access_token;
      } catch {
        // If not JSON, assume it's direct token (older format or direct assignment)
        accessToken = supabaseAuthCookie.value;
      }
    }
  } catch (e) {
    console.error("Error reading auth cookie:", e);
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: accessToken
      ? {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      : undefined,
  });
}

export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  
  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
