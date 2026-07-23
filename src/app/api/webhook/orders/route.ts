import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import type { Order } from "@/types";

export const dynamic = "force-dynamic";

// This file handles all order & return operations atomically via PostgreSQL RPCs
// Designed to be swapped from simulation buttons to real marketplace webhooks
// without changing core business logic.
export async function POST(request: Request) {
  try {
    const admin = createAdminClient();
    const body = await request.json();
    const { action, payload } = body;

    // 1. CREATE DUMMY ORDER (Webhook SIMULATION)
    if (action === "create_order") {
      const { channel, sku, qty, order_code } = payload;

      const { error } = await admin.from("orders").insert({
        order_code,
        channel,
        status: "PENDING",
        sku: sku.toUpperCase(),
        qty,
      });
      if (error) throw error;
      return NextResponse.json({ success: true });
    }

    // 2. UPDATE ORDER STATUS (Webhook SIMULATION)
    if (action === "update_order_status") {
      const { order_id, new_status, order } = payload;

      if (new_status === "SHIPPED" || new_status === "IN_TRANSIT") {
        // Resolve bundle -> single product components
        const { data: bundles } = await admin.from("bundles").select("*").eq("sku", order.sku).single();
        let components: { product_id: string; qty: number }[] = [];

        if (bundles) {
          const { data: comps } = await admin.from("bundle_components").select("*").eq("bundle_id", bundles.id);
          components = (comps || []).map(c => ({ product_id: c.product_id, qty: c.qty }));
        } else {
          const { data: prod } = await admin.from("products").select("*").eq("sku", order.sku).single();
          if (prod) components = [{ product_id: prod.id, qty: 1 }];
        }
        if (components.length === 0) throw new Error("SKU tidak terdaftar");

        // Process each component via atomic RPC
        for (const comp of components) {
          const reqQty = comp.qty * order.qty;
          const { error: rpcError } = await admin.rpc("process_order_fefo", {
            p_product_id: comp.product_id,
            p_qty: reqQty,
            p_reason: order.channel === "shopee" ? "pesanan_shopee" : "pesanan_tiktok",
            p_channel: order.channel,
            p_ref_id: order.order_code,
          });
          if (rpcError) throw rpcError;

          // AUTOMATIC PROMO RULES APPLICATION
          try {
            // Find active promo rules for this product and channel
            const { data: rules } = await admin
              .from("promo_rules")
              .select("id, name, min_buy_qty")
              .eq("buy_product_id", comp.product_id)
              .eq("is_active", true)
              .lte("min_buy_qty", reqQty)
              .lte("start_date", new Date().toISOString())
              .gte("end_date", new Date().toISOString())
              .contains("channels", [order.channel])
              .order("min_buy_qty", { ascending: false });

            const matchedRule = rules && rules[0];

            if (matchedRule) {
              // Retrieve associated free items
              const { data: freeItems } = await admin
                .from("promo_free_items")
                .select("product_id, qty")
                .eq("promo_rule_id", matchedRule.id);

              if (freeItems && freeItems.length > 0) {
                for (const item of freeItems) {
                  // Deduct free items using FEFO
                  await admin.rpc("process_order_fefo", {
                    p_product_id: item.product_id,
                    p_qty: item.qty, // fixed quantity per brief
                    p_reason: "promo",
                    p_channel: order.channel,
                    p_ref_id: `PROMO-${order.order_code}`,
                  });
                }
              }
            }
          } catch (promoErr) {
            console.error("Failed to automatically apply promo rules:", promoErr);
          }
        }

        await admin.from("orders").update({ status: new_status }).eq("id", order_id);
      } else if (new_status === "CANCELLED" && (order.status === "SHIPPED" || order.status === "IN_TRANSIT")) {
        // Atomic cancellation: stock reversal + status update in one DB transaction
        const { error: cancelError } = await admin.rpc("process_cancel_order", {
          p_order_id: order_id,
          p_order_code: order.order_code,
          p_channel: order.channel,
        });
        if (cancelError) throw cancelError;
      } else {
        // Simple status update (PENDING -> CANCELLED, SHIPPED -> COMPLETED, etc.)
        await admin.from("orders").update({ status: new_status }).eq("id", order_id);
      }

      return NextResponse.json({ success: true });
    }

    // 3. PROCESS RETURN INSPECTION (Server-side atomic)
    if (action === "process_return") {
      const { return_id, order_code, channel, sku, qty, condition, new_batch_code, new_expiry_date } = payload;

      if (!["layak_jual", "rusak", "hilang"].includes(condition)) {
        return NextResponse.json({ error: "Kondisi tidak valid" }, { status: 400 });
      }

      const { error: rpcError } = await admin.rpc("process_return", {
        p_return_id: return_id,
        p_order_code: order_code,
        p_channel: channel,
        p_sku: sku.toUpperCase(),
        p_qty: qty,
        p_condition: condition,
        p_batch_code: new_batch_code || null,
        p_expiry_date: new_expiry_date || null,
      });
      if (rpcError) throw rpcError;

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
