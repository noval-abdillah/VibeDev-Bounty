import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function getAuthenticatedUser(request: Request, admin: any) {
  try {
    const cookieHeader = request.headers.get("cookie") || "";
    const cookies = Object.fromEntries(
      cookieHeader.split(";").map(c => c.trim().split("="))
    );
    const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.split("//")?.[1]?.split(".")?.[0] || "";
    const tokenKey = `sb-${projectRef}-auth-token`;
    const tokenVal = cookies[tokenKey];
    if (!tokenVal) return null;

    let accessToken = "";
    try {
      const parsedToken = JSON.parse(decodeURIComponent(tokenVal));
      accessToken = parsedToken.access_token || "";
    } catch {
      accessToken = decodeURIComponent(tokenVal);
    }
    if (!accessToken) return null;

    const { data: { user }, error } = await admin.auth.getUser(accessToken);
    if (error || !user) return null;

    const { data: profile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    return { ...user, role: profile?.role || "gudang" };
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  try {
    const admin = createAdminClient();
    
    // Auth check
    const user = await getAuthenticatedUser(request, admin);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Role restrictions removed - all roles are treated as Admin

    const { data: profiles, error } = await admin
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ profiles });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const admin = createAdminClient();
    
    // Auth check
    const user = await getAuthenticatedUser(request, admin);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Role restrictions removed - all roles are treated as Admin

    const body = await request.json();
    const { email, password, name, role } = body;

    if (!email || !password || !name || !role) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    // 1. Create user in auth.users
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      return NextResponse.json({ error: authError?.message || "Failed to create auth user" }, { status: 500 });
    }

    // 2. Create profile row
    const { error: profileError } = await admin.from("profiles").insert({
      id: authData.user.id,
      email,
      name,
      role,
    });

    if (profileError) {
      // Cleanup auth user on profile failure
      await admin.auth.admin.deleteUser(authData.user.id);
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
