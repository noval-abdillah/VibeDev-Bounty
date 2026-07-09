-- 1. Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_stock_ledger_product_id ON stock_ledger(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_batch_id ON stock_ledger(batch_id);
CREATE INDEX IF NOT EXISTS idx_batches_product_id ON batches(product_id);

-- 2. Create view to fetch all product totals in one query (prevents N+1 query loop on client)
CREATE OR REPLACE VIEW product_stock_summary AS
SELECT 
  p.id as product_id, 
  p.name, 
  p.sku, 
  p.is_active, 
  p.created_at,
  COALESCE(SUM(l.qty), 0) as total_stock
FROM products p
LEFT JOIN stock_ledger l ON l.product_id = p.id
GROUP BY p.id;

-- 3. Create view to fetch all batch stocks in one query (prevents N+1 query loop on client)
CREATE OR REPLACE VIEW batch_stock_summary AS
SELECT 
  b.id as batch_id, 
  b.product_id, 
  b.batch_code, 
  b.expiry_date, 
  b.created_at,
  COALESCE(SUM(l.qty), 0) as batch_stock
FROM batches b
LEFT JOIN stock_ledger l ON l.batch_id = b.id
GROUP BY b.id;
