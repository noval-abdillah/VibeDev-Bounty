import { supabase } from "./supabase/client";
import type { LedgerReason, LedgerChannel, LedgerEntry } from "@/types";

/**
 * Calculates current stock of a product and batch by summing all ledger entries.
 */
export async function getStockForProductAndBatch(productId: string, batchId: string): Promise<number> {
  const { data, error } = await supabase
    .from("stock_ledger")
    .select("qty")
    .eq("product_id", productId)
    .eq("batch_id", batchId);

  if (error || !data) return 0;
  return data.reduce((sum, e) => sum + e.qty, 0);
}

/**
 * Calculates total stock of a product across all its batches.
 */
export async function getStockForProduct(productId: string): Promise<number> {
  const { data, error } = await supabase
    .from("stock_ledger")
    .select("qty")
    .eq("product_id", productId);

  if (error || !data) return 0;
  return data.reduce((sum, e) => sum + e.qty, 0);
}

/**
 * Appends a new entry to the Stock Ledger.
 * Enforces validation that quantity is non-zero.
 */
export async function writeLedgerEntry(
  productId: string,
  batchId: string,
  qty: number,
  reason: LedgerReason,
  channel: LedgerChannel,
  referenceId: string
): Promise<LedgerEntry | null> {
  if (qty === 0) return null;

  const { data, error } = await supabase
    .from("stock_ledger")
    .insert({
      product_id: productId,
      batch_id: batchId,
      qty,
      reason,
      channel,
      reference_id: referenceId,
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to write ledger entry:", error.message);
    return null;
  }

  return data as LedgerEntry;
}

