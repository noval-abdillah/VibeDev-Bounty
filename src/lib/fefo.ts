import { supabase } from "./supabase/client";
import { getStockForProductAndBatch } from "./ledger";

interface AllocatedBatch {
  batchId: string;
  batchCode: string;
  allocatedQty: number;
}

/**
 * Automatically allocates outgoing product quantity to batches using FEFO (First Expired, First Out).
 * 
 * @param productId ID of the product
 * @param qty Quantity to deduct (positive integer)
 * @returns Array of allocated batches and quantities
 */
export async function allocateBatchFefo(productId: string, qty: number): Promise<AllocatedBatch[]> {
  if (qty <= 0) return [];

  // 1. Fetch all batches for the product
  const { data: batches, error } = await supabase
    .from("batches")
    .select("*")
    .eq("product_id", productId);

  if (error || !batches || batches.length === 0) {
    throw new Error(`Produk tidak memiliki batch terdaftar.`);
  }

  // 2. Compute current stock for each batch and filter for positive stock
  const batchStocks = await Promise.all(
    batches.map(async (batch) => {
      const stock = await getStockForProductAndBatch(productId, batch.id);
      return { batch, stock };
    })
  );

  // 3. Sort by expiration date ascending (earliest expiry first)
  const eligibleBatches = batchStocks
    .filter((bs) => bs.stock > 0)
    .sort((a, b) => {
      const dateA = new Date(a.batch.expiry_date).getTime();
      const dateB = new Date(b.batch.expiry_date).getTime();
      return dateA - dateB;
    });

  const allocations: AllocatedBatch[] = [];
  let remainingQty = qty;

  // 4. Allocate from eligible batches
  for (const bs of eligibleBatches) {
    if (remainingQty <= 0) break;

    const take = Math.min(remainingQty, bs.stock);
    allocations.push({
      batchId: bs.batch.id,
      batchCode: bs.batch.batch_code,
      allocatedQty: take,
    });
    remainingQty -= take;
  }

  // 5. If there is still remaining quantity (stock deficit), allocate it from the latest batch
  if (remainingQty > 0) {
    const allBatchesSorted = [...batches].sort((a, b) => {
      const dateA = new Date(a.expiry_date).getTime();
      const dateB = new Date(b.expiry_date).getTime();
      return dateB - dateA; // Longest expiry first
    });

    const targetBatch = allBatchesSorted[0] || batches[0];
    
    const existingAllocation = allocations.find((a) => a.batchId === targetBatch.id);
    if (existingAllocation) {
      existingAllocation.allocatedQty += remainingQty;
    } else {
      allocations.push({
        batchId: targetBatch.id,
        batchCode: targetBatch.batch_code,
        allocatedQty: remainingQty,
      });
    }
  }

  return allocations;
}
