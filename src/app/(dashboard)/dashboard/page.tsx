import { createServerClient } from "@/lib/supabase/server";
import { DashboardClient } from "./DashboardClient";
import type { LedgerEntry } from "@/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = createServerClient();

  // Fetch all data in parallel on the server
  const [prodsResult, btsResult, ledgerResult, returnsResult, ordersResult, bundsResult, compsResult, opnameSessResult] = await Promise.all([
    supabase.from("products").select("*").eq("is_active", true),
    supabase.from("batches").select("*"),
    supabase.from("stock_ledger").select("*"),
    supabase.from("returns").select("*"),
    supabase.from("orders").select("*"),
    supabase.from("bundles").select("*"),
    supabase.from("bundle_components").select("*"),
    supabase.from("opname_sessions").select("*").eq("status", "completed").order("completed_at", { ascending: false }).limit(1),
  ]);

  const products = prodsResult.data || [];
  const batches = btsResult.data || [];
  const ledger = ledgerResult.data || [];
  const returns = returnsResult.data || [];
  const orders = ordersResult.data || [];
  const bundles = bundsResult.data || [];
  const bundleComponents = compsResult.data || [];
  const lastOpnameSession = opnameSessResult.data?.[0] || null;

  return (
    <DashboardClient
      serverProducts={products}
      serverBatches={batches}
      serverLedger={ledger as LedgerEntry[]}
      serverReturns={returns || []}
      serverOrders={orders || []}
      serverBundles={bundles || []}
      serverBundleComponents={bundleComponents || []}
      serverLastOpnameSession={lastOpnameSession}
    />
  );
}
