import { createServerClient } from "@/lib/supabase/server";
import { LedgerClient } from "./LedgerClient";

export const dynamic = "force-dynamic";

export default async function LedgerPage() {
  const supabase = createServerClient();

  const [prodsResult, btsResult, ledgerResult] = await Promise.all([
    supabase.from("products").select("id, name, sku"),
    supabase.from("batches").select("id, batch_code"),
    supabase.from("stock_ledger").select("*").order("created_at", { ascending: false }).limit(100),
  ]);

  const products = prodsResult.data || [];
  const batches = btsResult.data || [];
  const ledger = ledgerResult.data || [];

  return (
    <LedgerClient
      serverProducts={products}
      serverBatches={batches}
      serverLedger={ledger}
    />
  );
}
