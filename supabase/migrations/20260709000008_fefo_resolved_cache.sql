-- 1. Add resolved_components column to orders table
ALTER TABLE orders ADD COLUMN IF NOT EXISTS resolved_components JSONB DEFAULT NULL;

-- 2. Create physical stock cache tables for O(1) reads
CREATE TABLE IF NOT EXISTS product_stocks_cache (
  product_id UUID PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  total_stock INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS batch_stocks_cache (
  batch_id UUID PRIMARY KEY REFERENCES batches(id) ON DELETE CASCADE,
  batch_stock INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for cache tables
ALTER TABLE product_stocks_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_stocks_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public Read Cache" ON product_stocks_cache;
CREATE POLICY "Public Read Cache" ON product_stocks_cache FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin Write Cache" ON product_stocks_cache;
CREATE POLICY "Admin Write Cache" ON product_stocks_cache FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public Read Batch Cache" ON batch_stocks_cache;
CREATE POLICY "Public Read Batch Cache" ON batch_stocks_cache FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin Write Batch Cache" ON batch_stocks_cache;
CREATE POLICY "Admin Write Batch Cache" ON batch_stocks_cache FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Populate cache tables with initial sums from ledger
INSERT INTO product_stocks_cache (product_id, total_stock)
SELECT product_id, COALESCE(SUM(qty), 0)
FROM stock_ledger
GROUP BY product_id
ON CONFLICT (product_id) DO UPDATE 
SET total_stock = EXCLUDED.total_stock, updated_at = now();

INSERT INTO batch_stocks_cache (batch_id, batch_stock)
SELECT batch_id, COALESCE(SUM(qty), 0)
FROM stock_ledger
GROUP BY batch_id
ON CONFLICT (batch_id) DO UPDATE 
SET batch_stock = EXCLUDED.batch_stock, updated_at = now();

-- 4. Create trigger function to maintain running balance incrementally
CREATE OR REPLACE FUNCTION sync_stock_cache_on_ledger_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Maintain product stock cache
  INSERT INTO product_stocks_cache (product_id, total_stock, updated_at)
  VALUES (NEW.product_id, NEW.qty, now())
  ON CONFLICT (product_id) DO UPDATE
  SET total_stock = product_stocks_cache.total_stock + NEW.qty,
      updated_at = now();

  -- Maintain batch stock cache
  INSERT INTO batch_stocks_cache (batch_id, batch_stock, updated_at)
  VALUES (NEW.batch_id, NEW.qty, now())
  ON CONFLICT (batch_id) DO UPDATE
  SET batch_stock = batch_stocks_cache.batch_stock + NEW.qty,
      updated_at = now();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS trg_sync_stock_cache_on_ledger_insert ON stock_ledger;
CREATE TRIGGER trg_sync_stock_cache_on_ledger_insert
AFTER INSERT ON stock_ledger
FOR EACH ROW
EXECUTE FUNCTION sync_stock_cache_on_ledger_insert();

-- 5. Rewrite views to select directly from cache tables (O(1) performance)
CREATE OR REPLACE VIEW product_stock_summary AS
SELECT 
  p.id as product_id, 
  p.name, 
  p.sku, 
  p.is_active, 
  p.created_at,
  COALESCE(c.total_stock, 0) as total_stock
FROM products p
LEFT JOIN product_stocks_cache c ON c.product_id = p.id;

CREATE OR REPLACE VIEW batch_stock_summary AS
SELECT 
  b.id as batch_id, 
  b.product_id, 
  b.batch_code, 
  b.expiry_date, 
  b.created_at,
  COALESCE(c.batch_stock, 0) as batch_stock
FROM batches b
LEFT JOIN batch_stocks_cache c ON c.batch_id = b.id;

-- 6. Create RPC for secure, centralized ledger insertion from server
CREATE OR REPLACE FUNCTION create_ledger_entry(
  p_product_id UUID,
  p_batch_id UUID,
  p_qty INT,
  p_reason TEXT,
  p_channel TEXT,
  p_ref_id TEXT
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO stock_ledger (product_id, batch_id, qty, reason, channel, reference_id)
  VALUES (p_product_id, p_batch_id, p_qty, p_reason, p_channel, p_ref_id)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
