import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Helper function to verify authenticated user from request cookie (JWT validation)
async function getAuthenticatedUser(request: Request, admin: any) {
  try {
    // Extract cookies to find auth token
    const cookieHeader = request.headers.get("cookie") || "";
    const cookies = Object.fromEntries(
      cookieHeader.split(";").map(c => c.trim().split("="))
    );
    
    // Supabase auth token format is usually sb-<project-ref>-auth-token
    const projectRef = process.env.NEXT_PUBLIC_SUPABASE_URL?.split("//")?.[1]?.split(".")?.[0] || "";
    const tokenKey = `sb-${projectRef}-auth-token`;
    const tokenVal = cookies[tokenKey];
    
    if (!tokenVal) return null;

    let accessToken = "";
    try {
      // Supabase storage token is usually a JSON array with access_token
      const parsedToken = JSON.parse(decodeURIComponent(tokenVal));
      accessToken = parsedToken.access_token || "";
    } catch {
      accessToken = decodeURIComponent(tokenVal);
    }

    if (!accessToken) return null;

    const { data: { user }, error } = await admin.auth.getUser(accessToken);
    if (error || !user) return null;

    // Fetch role details
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

export async function POST(request: Request) {
  try {
    const admin = createAdminClient();
    
    // Enforce API Authentication
    const user = await getAuthenticatedUser(request, admin);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action, payload } = body;

    if (action === "create_ledger_entry") {
      const { product_id, batch_id, qty, reason, channel, reference_id } = payload;
      const { data, error } = await admin.rpc("create_manual_ledger_entry", {
        p_product_id: product_id,
        p_batch_id: batch_id,
        p_qty: qty,
        p_reason: reason,
        p_channel: channel,
        p_ref_id: reference_id,
      });
      if (error) throw error;
      return NextResponse.json({ success: true, id: data });
    }

    if (action === "manual_stock_out") {
      const { product_id, qty, reason, channel, reference_id } = payload;
      const { error } = await admin.rpc("process_order_fefo", {
        p_product_id: product_id,
        p_qty: qty,
        p_reason: reason,
        p_channel: channel,
        p_ref_id: reference_id,
      });
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    if (action === "complete_opname") {
      // Role enforcement: Gudang/Owner can't complete opname, must be Admin/Config
      if (user.role === "owner" || user.role === "gudang") {
        return NextResponse.json({ error: "Forbidden: role Anda tidak memiliki izin ini." }, { status: 403 });
      }

      const { session_id, corrections } = payload;
      const { error } = await admin.rpc("create_opname_corrections", {
        p_session_id: session_id,
        p_corrections: corrections,
      });
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
