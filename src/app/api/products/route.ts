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

export async function POST(request: Request) {
  try {
    const admin = createAdminClient();
    
    // API Auth check
    const user = await getAuthenticatedUser(request, admin);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // All roles allowed to update/check products since owner/gudang role limits are removed
    // Only Admin is used. All profiles will effectively act as Admin.

    const body = await request.json();
    const { action, payload } = body;

    if (action === "check_sku_locked") {
      const { product_id } = payload;
      
      const { data: batches, error: batchErr } = await admin
        .from("batches")
        .select("id")
        .eq("product_id", product_id)
        .limit(1);

      if (batchErr) throw batchErr;

      if (batches && batches.length > 0) {
        return NextResponse.json({ locked: true, reason: "Produk sudah memiliki data batch terdaftar." });
      }

      const { data: ledger, error: ledgerErr } = await admin
        .from("stock_ledger")
        .select("id")
        .eq("product_id", product_id)
        .limit(1);

      if (ledgerErr) throw ledgerErr;

      if (ledger && ledger.length > 0) {
        return NextResponse.json({ locked: true, reason: "Produk sudah memiliki riwayat transaksi di Buku Besar." });
      }

      return NextResponse.json({ locked: false });
    }

    if (action === "update_product") {
      const { product_id, name, sku, image_url } = payload;

      const { data: existingProd, error: prodErr } = await admin
        .from("products")
        .select("sku")
        .eq("id", product_id)
        .single();

      if (prodErr) throw prodErr;

      const isSkuChanged = existingProd.sku.toUpperCase() !== sku.toUpperCase();

      if (isSkuChanged) {
        const { data: batches, error: bErr } = await admin
          .from("batches")
          .select("id")
          .eq("product_id", product_id)
          .limit(1);
        if (bErr) throw bErr;

        const { data: ledger, error: lErr } = await admin
          .from("stock_ledger")
          .select("id")
          .eq("product_id", product_id)
          .limit(1);
        if (lErr) throw lErr;

        if ((batches && batches.length > 0) || (ledger && ledger.length > 0)) {
          return NextResponse.json(
            { error: "SKU tidak dapat diubah karena produk sudah memiliki riwayat transaksi/batch." },
            { status: 400 }
          );
        }

        const { data: duplicateProd, error: dErr } = await admin
          .from("products")
          .select("id")
          .eq("sku", sku.toUpperCase())
          .neq("id", product_id)
          .limit(1);
        if (dErr) throw dErr;

        if (duplicateProd && duplicateProd.length > 0) {
          return NextResponse.json(
            { error: "SKU baru sudah digunakan oleh produk lain." },
            { status: 400 }
          );
        }
      }

      const { error: updateErr } = await admin
        .from("products")
        .update({
          name,
          sku: sku.toUpperCase(),
          image_url: image_url !== undefined ? image_url : null
        })
        .eq("id", product_id);

      if (updateErr) throw updateErr;

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
