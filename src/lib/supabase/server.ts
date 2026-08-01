import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export function createServerClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  
  // Extract token from cookies to pass authenticated context if present
  let accessToken = undefined;
  try {
    const cookieStore = cookies();
    const projectRef = supabaseUrl.split("//")?.[1]?.split(".")?.[0] || "";
    const tokenKey = `sb-${projectRef}-auth-token`;
    const tokenVal = cookieStore.get(tokenKey)?.value;
    if (tokenVal) {
      try {
        const parsedToken = JSON.parse(decodeURIComponent(tokenVal));
        accessToken = parsedToken.access_token;
      } catch {
        accessToken = decodeURIComponent(tokenVal);
      }
    }
  } catch {}

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
