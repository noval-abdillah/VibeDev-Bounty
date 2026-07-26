import type { LedgerReason, LedgerChannel, LedgerEntry } from "@/types";

export async function writeLedgerEntry(
  productId: string,
  batchId: string,
  qty: number,
  reason: LedgerReason,
  channel: LedgerChannel,
  referenceId: string
): Promise<LedgerEntry | null> {
  if (qty === 0) return null;

  const res = await fetch("/api/ledger", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "create_ledger_entry",
      payload: {
        product_id: productId,
        batch_id: batchId,
        qty,
        reason,
        channel,
        reference_id: referenceId,
      },
    }),
  });

  const result = await res.json();
  if (!res.ok) {
    console.error("Failed to write ledger entry:", result.error);
    return null;
  }

  return {
    id: result.id,
    product_id: productId,
    batch_id: batchId,
    qty,
    reason,
    channel,
    reference_id: referenceId,
    created_at: new Date().toISOString(),
  } as LedgerEntry;
}
