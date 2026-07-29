import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const admin = createAdminClient();
    const body = await request.json();
    const { action, payload } = body;

    if (action === "check_sku_locked") {
      const { product_id } = payload;
      
      // 1. Check if has batches
      const { data: batches, error: batchErr } = await admin
        .from("batches")
        .select("id")
        .eq("product_id", product_id)
        .limit(1);

      if (batchErr) throw batchErr;

      if (batches && batches.length > 0) {
        return NextResponse.json({ locked: true, reason: "Produk sudah memiliki data batch terdaftar." });
      }

      // 2. Check if has ledger entries
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

      // 1. Check if SKU is changed
      const { data: existingProd, error: prodErr } = await admin
        .from("products")
        .select("sku")
        .eq("id", product_id)
        .single();

      if (prodErr) throw prodErr;

      const isSkuChanged = existingProd.sku.toUpperCase() !== sku.toUpperCase();

      if (isSkuChanged) {
        // Enforce lock check on backend
        const { data: batches } = await admin
          .from("batches")
          .select("id")
          .eq("product_id", product_id)
          .limit(1);

        const { data: ledger } = await admin
          .from("stock_ledger")
          .select("id")
          .eq("product_id", product_id)
          .limit(1);

        if ((batches && batches.length > 0) || (ledger && ledger.length > 0)) {
          return NextResponse.json(
            { error: "SKU tidak dapat diubah karena produk sudah memiliki riwayat transaksi/batch." },
            { status: 400 }
          );
        }

        // Validate SKU uniqueness
        const { data: duplicateProd } = await admin
          .from("products")
          .select("id")
          .eq("sku", sku.toUpperCase())
          .neq("id", product_id)
          .limit(1);

        if (duplicateProd && duplicateProd.length > 0) {
          return NextResponse.json(
            { error: "SKU baru sudah digunakan oleh produk lain." },
            { status: 400 }
          );
        }
      }

      // 2. Update product
      const { error: updateErr } = await admin
        .from("products")
        .update({
          name,
          sku: sku.toUpperCase(),
          image_url: image_url
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
