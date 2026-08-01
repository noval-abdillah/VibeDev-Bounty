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

    const body = await request.json();
    const { action, payload } = body;

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

    if (action === "update_order_status") {
      const { order_id, new_status, order } = payload;

      if (new_status === "SHIPPED" || new_status === "IN_TRANSIT") {
        const { data: bundles } = await admin.from("bundles").select("*").eq("sku", order.sku).single();
        let components: { product_id: string; qty: number }[] = [];

        if (bundles) {
          const { data: comps } = await admin.from("bundle_components").select("*").eq("bundle_id", bundles.id).eq("is_active", true);
          components = (comps || []).map(c => ({ product_id: c.product_id, qty: c.qty }));
        } else {
          const { data: prod } = await admin.from("products").select("*").eq("sku", order.sku).single();
          if (prod) components = [{ product_id: prod.id, qty: 1 }];
        }
        if (components.length === 0) throw new Error("SKU tidak terdaftar");

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

          try {
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
              const { data: freeItems } = await admin
                .from("promo_free_items")
                .select("product_id, qty")
                .eq("promo_rule_id", matchedRule.id);

              if (freeItems && freeItems.length > 0) {
                for (const item of freeItems) {
                  const { error: promoFefoError } = await admin.rpc("process_order_fefo", {
                    p_product_id: item.product_id,
                    p_qty: item.qty,
                    p_reason: "promo",
                    p_channel: order.channel,
                    p_ref_id: `PROMO-${order.order_code}`,
                  });
                  if (promoFefoError) throw promoFefoError;
                }
              }
            }
          } catch (promoErr: any) {
            console.error("Failed to automatically apply promo rules:", promoErr);
            throw new Error("Gagal menerapkan promo otomatis: " + promoErr.message);
          }
        }

        const { error: updateErr } = await admin.from("orders").update({
          status: new_status,
          resolved_components: components,
        }).eq("id", order_id);
        
        if (updateErr) throw updateErr;

      } else if (new_status === "CANCELLED" && (order.status === "SHIPPED" || order.status === "IN_TRANSIT")) {
        const cancelQty = payload.cancel_qty || null;
        const { error: cancelError } = await admin.rpc("process_cancel_order", {
          p_order_id: order_id,
          p_order_code: order.order_code,
          p_channel: order.channel,
          p_cancel_qty: cancelQty,
        });
        if (cancelError) throw cancelError;
      } else {
        const { error: updateErr } = await admin.from("orders").update({ status: new_status }).eq("id", order_id);
        if (updateErr) throw updateErr;
      }

      return NextResponse.json({ success: true });
    }

    if (action === "process_return") {
      const { return_id, order_code, channel, sku, qty, condition, new_batch_code, new_expiry_date } = payload;

      if (!["layak_jual", "rusak", "hilang"].includes(condition)) {
        return NextResponse.json({ error: "Kondisi tidak valid" }, { status: 400 });
      }

      const { data: orderData } = await admin.from("orders").select("resolved_components").eq("order_code", order_code).single();
      const resolvedComponents = orderData?.resolved_components || null;

      const { error: rpcError } = await admin.rpc("process_return", {
        p_return_id: return_id,
        p_order_code: order_code,
        p_channel: channel,
        p_sku: sku.toUpperCase(),
        p_qty: qty,
        p_condition: condition,
        p_batch_code: new_batch_code || null,
        p_expiry_date: new_expiry_date || null,
        p_resolved_components: resolvedComponents,
      });
      if (rpcError) throw rpcError;

      return NextResponse.json({ success: true });
    }

    if (action === "import_orders") {
      const { orders: importOrders } = payload;
      for (const ord of importOrders) {
        const { error } = await admin.from("orders").insert({
          order_code: ord.order_code,
          channel: ord.channel,
          status: "PENDING",
          sku: ord.sku.toUpperCase(),
          qty: ord.qty,
        });
        if (error) throw error;
      }
      return NextResponse.json({ success: true, count: importOrders.length });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
