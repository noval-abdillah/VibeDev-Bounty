import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const admin = createAdminClient();
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
