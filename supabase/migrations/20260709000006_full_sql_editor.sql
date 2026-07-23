-- ===================================================================
-- STOKLEDGER COMPLETE DATABASE SCHEMA SETUP & SEED
-- ===================================================================

-- 1. CLEANUP OLD TABLES IF CONFLICTS
DROP TABLE IF EXISTS promo_free_items CASCADE;
DROP TABLE IF EXISTS promo_rules CASCADE;
DROP TABLE IF EXISTS opname_items CASCADE;
DROP TABLE IF EXISTS opname_sessions CASCADE;
DROP TABLE IF EXISTS returns CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS bundle_components CASCADE;
DROP TABLE IF EXISTS bundles CASCADE;
DROP TABLE IF EXISTS stock_ledger CASCADE;
DROP TABLE IF EXISTS batches CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- 2. CREATE SCHEMA TABLES
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  batch_code TEXT NOT NULL,
  expiry_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE stock_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  batch_id UUID REFERENCES batches(id) ON DELETE CASCADE NOT NULL,
  qty INTEGER NOT NULL,
  reason TEXT NOT NULL,
  channel TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE bundle_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id UUID REFERENCES bundles(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code TEXT NOT NULL UNIQUE,
  channel TEXT NOT NULL,
  status TEXT NOT NULL,
  sku TEXT NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE returns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  order_code TEXT NOT NULL,
  channel TEXT NOT NULL,
  sku TEXT NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  condition TEXT, -- NULL initially, then layak_jual/rusak/hilang
  status TEXT NOT NULL DEFAULT 'PENDING',
  received_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE opname_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE opname_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES opname_sessions(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  batch_id UUID REFERENCES batches(id) ON DELETE CASCADE NOT NULL,
  physical_qty INTEGER NOT NULL CHECK (physical_qty >= 0),
  system_qty INTEGER NOT NULL CHECK (system_qty >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('gudang', 'owner', 'admin')),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE promo_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  buy_product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  min_buy_qty INTEGER NOT NULL CHECK (min_buy_qty > 0),
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  channels TEXT[] NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE promo_free_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_rule_id UUID REFERENCES promo_rules(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0)
);

-- 3. ENFORCE APPEND-ONLY ON stock_ledger
CREATE OR REPLACE FUNCTION prevent_ledger_update_delete()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Stock Ledger is append-only. UPDATE and DELETE operations are prohibited.';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_ledger_update_delete ON stock_ledger;
CREATE TRIGGER trg_prevent_ledger_update_delete
BEFORE UPDATE OR DELETE ON stock_ledger
FOR EACH ROW
EXECUTE FUNCTION prevent_ledger_update_delete();

-- 4. ENABLE RLS
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundles ENABLE ROW LEVEL SECURITY;
ALTER TABLE bundle_components ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE opname_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE opname_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_free_items ENABLE ROW LEVEL SECURITY;

-- 5. RLS POLICIES
CREATE POLICY "Public Read" ON products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin All" ON products FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Public Read" ON batches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin All" ON batches FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Public Read" ON stock_ledger FOR SELECT TO authenticated USING (true);
CREATE POLICY "Insert" ON stock_ledger FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Public Read" ON bundles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin All" ON bundles FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Public Read" ON bundle_components FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin All" ON bundle_components FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Public Read" ON orders FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin All" ON orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Public Read" ON returns FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin All" ON returns FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Public Read" ON opname_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin All" ON opname_sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Public Read" ON opname_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin All" ON opname_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Profiles Read" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Profiles Admin" ON profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Public Read" ON promo_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin All" ON promo_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Public Read" ON promo_free_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin All" ON promo_free_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. TRIGGER SYNC PROFILES ON AUTH.USERS
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'name', 'Anggota Baru'),
    COALESCE(new.raw_user_meta_data->>'role', 'gudang')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. PERFORMANCE OPTIMIZATION INDEXES & VIEWS
CREATE INDEX IF NOT EXISTS idx_stock_ledger_product_id ON stock_ledger(product_id);
CREATE INDEX IF NOT EXISTS idx_stock_ledger_batch_id ON stock_ledger(batch_id);
CREATE INDEX IF NOT EXISTS idx_batches_product_id ON batches(product_id);

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

CREATE OR REPLACE VIEW daily_reconciliation_summary AS
SELECT 
  o.id as order_id,
  o.order_code,
  o.channel,
  o.sku,
  o.qty as order_qty,
  o.created_at as order_created_at,
  COALESCE(ABS(SUM(l.qty)), 0) as ledger_qty,
  (o.qty - COALESCE(ABS(SUM(l.qty)), 0)) as discrepancy
FROM orders o
LEFT JOIN stock_ledger l ON l.reference_id = o.order_code AND l.qty < 0
WHERE o.status NOT IN ('PENDING', 'CANCELLED')
GROUP BY o.id, o.order_code, o.channel, o.sku, o.qty, o.created_at;

-- 8. ATOMIC BUSINESS LOGIC FUNCTIONS (RPCs)
CREATE OR REPLACE FUNCTION process_order_fefo(
  p_product_id UUID,
  p_qty INT,
  p_reason TEXT,
  p_channel TEXT,
  p_ref_id TEXT
)
RETURNS VOID AS $$
DECLARE
  r_batch RECORD;
  v_allocated INT;
  v_remaining INT := p_qty;
  v_target_batch_id UUID;
BEGIN
  FOR r_batch IN 
    SELECT b.id, b.batch_code, COALESCE(SUM(l.qty), 0) as current_stock
    FROM batches b
    LEFT JOIN stock_ledger l ON l.batch_id = b.id AND l.product_id = p_product_id
    WHERE b.product_id = p_product_id
    GROUP BY b.id, b.expiry_date
    ORDER BY b.expiry_date ASC
    FOR UPDATE
  LOOP
    IF v_remaining <= 0 THEN EXIT; END IF;

    IF r_batch.current_stock > 0 THEN
      v_allocated := LEAST(v_remaining, r_batch.current_stock);
      INSERT INTO stock_ledger (product_id, batch_id, qty, reason, channel, reference_id)
      VALUES (p_product_id, r_batch.id, -v_allocated, p_reason, p_channel, p_ref_id);
      v_remaining := v_remaining - v_allocated;
    END IF;
  END LOOP;

  IF v_remaining > 0 THEN
    SELECT b.id INTO v_target_batch_id
    FROM batches b WHERE b.product_id = p_product_id
    ORDER BY b.expiry_date DESC LIMIT 1;

    IF v_target_batch_id IS NULL THEN
      RAISE EXCEPTION 'Produk tidak memiliki batch terdaftar.';
    END IF;

    INSERT INTO stock_ledger (product_id, batch_id, qty, reason, channel, reference_id)
    VALUES (p_product_id, v_target_batch_id, -v_remaining, p_reason, p_channel, p_ref_id);
  END IF;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION process_cancel_order(
  p_order_id UUID,
  p_order_code TEXT,
  p_channel TEXT
)
RETURNS VOID AS $$
DECLARE
  r RECORD;
  v_reason TEXT;
BEGIN
  v_reason := CASE WHEN p_channel = 'shopee' THEN 'retur_shopee' ELSE 'retur_tiktok' END;

  FOR r IN 
    SELECT * FROM stock_ledger 
    WHERE reference_id = p_order_code AND qty < 0
    FOR UPDATE
  LOOP
    INSERT INTO stock_ledger (product_id, batch_id, qty, reason, channel, reference_id)
    VALUES (r.product_id, r.batch_id, ABS(r.qty), v_reason, p_channel, 'CANCEL-REFUND-' || p_order_code);
  END LOOP;

  UPDATE orders SET status = 'CANCELLED' WHERE id = p_order_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION process_return(
  p_return_id UUID,
  p_order_code TEXT,
  p_channel TEXT,
  p_sku TEXT,
  p_qty INT,
  p_condition TEXT,
  p_batch_code TEXT DEFAULT NULL,
  p_expiry_date DATE DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  r RECORD;
  v_prod_id UUID;
  v_batch_id UUID;
  v_reason TEXT;
  v_found BOOLEAN := false;
BEGIN
  v_reason := CASE WHEN p_channel = 'shopee' THEN 'retur_shopee' ELSE 'retur_tiktok' END;

  SELECT id INTO v_prod_id FROM products WHERE sku = p_sku;
  IF v_prod_id IS NULL THEN
    RAISE EXCEPTION 'Produk dengan SKU % tidak ditemukan.', p_sku;
  END IF;

  IF p_condition = 'layak_jual' THEN
    IF p_batch_code IS NULL OR p_expiry_date IS NULL THEN
      RAISE EXCEPTION 'Kode batch dan tanggal kedaluwarsa wajib diisi untuk kondisi layak jual.';
    END IF;

    INSERT INTO batches (product_id, batch_code, expiry_date)
    VALUES (v_prod_id, UPPER(TRIM(p_batch_code)), p_expiry_date)
    RETURNING id INTO v_batch_id;

    INSERT INTO stock_ledger (product_id, batch_id, qty, reason, channel, reference_id)
    VALUES (v_prod_id, v_batch_id, p_qty, v_reason, p_channel, 'RETUR-LAYAK-' || p_order_code);

  ELSIF p_condition = 'rusak' THEN
    SELECT batch_id INTO v_batch_id FROM stock_ledger 
    WHERE reference_id = p_order_code AND qty < 0 LIMIT 1;

    IF v_batch_id IS NULL THEN
      SELECT id INTO v_batch_id FROM batches WHERE product_id = v_prod_id LIMIT 1;
    END IF;

    IF v_batch_id IS NOT NULL THEN
      INSERT INTO stock_ledger (product_id, batch_id, qty, reason, channel, reference_id)
      VALUES (v_prod_id, v_batch_id, p_qty, v_reason, p_channel, 'RETUR-DAMAGE-ARRIVE-' || p_order_code);
      
      INSERT INTO stock_ledger (product_id, batch_id, qty, reason, channel, reference_id)
      VALUES (v_prod_id, v_batch_id, -p_qty, 'rusak', 'manual', 'RETUR-DAMAGE-DISCARD-' || p_order_code);
    END IF;

  ELSIF p_condition = 'hilang' THEN
    SELECT batch_id INTO v_batch_id FROM stock_ledger 
    WHERE reference_id = p_order_code AND qty < 0 LIMIT 1;

    IF v_batch_id IS NULL THEN
      SELECT id INTO v_batch_id FROM batches WHERE product_id = v_prod_id LIMIT 1;
    END IF;

    IF v_batch_id IS NOT NULL THEN
      INSERT INTO stock_ledger (product_id, batch_id, qty, reason, channel, reference_id)
      VALUES (v_prod_id, v_batch_id, p_qty, v_reason, p_channel, 'RETUR-LOST-ARRIVE-' || p_order_code);
      
      INSERT INTO stock_ledger (product_id, batch_id, qty, reason, channel, reference_id)
      VALUES (v_prod_id, v_batch_id, -p_qty, 'rusak', 'manual', 'RETUR-LOST-IN-TRANSIT-' || p_order_code);
    END IF;
  END IF;

  UPDATE returns SET 
    condition = p_condition,
    received_at = NOW(),
    status = 'COMPLETED'
  WHERE id = p_return_id;
END;
$$ LANGUAGE plpgsql;

-- 9. DUMMY SEED DATA FOR TESTING
DO $$
DECLARE
  v_prod1_id UUID := gen_random_uuid();
  v_prod2_id UUID := gen_random_uuid();
  v_prod3_id UUID := gen_random_uuid();
  v_prod4_id UUID := gen_random_uuid();
  v_prod5_id UUID := gen_random_uuid();
  v_prod6_id UUID := gen_random_uuid();
  v_batch1_1_id UUID := gen_random_uuid();
  v_batch1_2_id UUID := gen_random_uuid();
  v_batch2_id UUID := gen_random_uuid();
  v_batch3_id UUID := gen_random_uuid();
  v_batch4_id UUID := gen_random_uuid();
  v_batch5_id UUID := gen_random_uuid();
  v_batch6_id UUID := gen_random_uuid();
  v_bundle1_id UUID := gen_random_uuid();
  v_bundle2_id UUID := gen_random_uuid();
  v_promo_id UUID := gen_random_uuid();
BEGIN
  INSERT INTO products (id, name, sku, is_active) VALUES
    (v_prod1_id, 'DNA Salmon', 'SKU-014', true),
    (v_prod2_id, 'AURA BLOOM MASK', 'SKU-002', true),
    (v_prod3_id, 'AURA HYDROGEL MASK', 'SKU-001', true),
    (v_prod4_id, 'LAXLOSS NEW', 'SKU-030', true),
    (v_prod5_id, 'PEEL OF MASKER', 'SKU-047', true),
    (v_prod6_id, 'WHITENING SKINCARE SET', 'SKU-059', true);

  -- Insert Batches
  INSERT INTO batches (id, product_id, batch_code, expiry_date) VALUES
    (v_batch1_1_id, v_prod1_id, 'B-DNA-0512-B', CURRENT_DATE + INTERVAL '11 days'),
    (v_batch1_2_id, v_prod1_id, 'B-DNA-0625-A', CURRENT_DATE + INTERVAL '90 days'),
    (v_batch2_id, v_prod2_id, 'B-ABM-0601-A', CURRENT_DATE + INTERVAL '25 days'),
    (v_batch3_id, v_prod3_id, 'B-AHM-0602-A', CURRENT_DATE + INTERVAL '60 days'),
    (v_batch4_id, v_prod4_id, 'B-LLN-0620-A', CURRENT_DATE + INTERVAL '200 days'),
    (v_batch5_id, v_prod5_id, 'B-POM-0501-A', CURRENT_DATE + INTERVAL '21 days'),
    (v_batch6_id, v_prod6_id, 'B-WSS-0530-B', CURRENT_DATE + INTERVAL '40 days');

  -- Saldo Awal
  INSERT INTO stock_ledger (product_id, batch_id, qty, reason, channel, reference_id) VALUES
    (v_prod1_id, v_batch1_1_id, 640, 'saldo_awal', 'system', 'INIT-DNA-1'),
    (v_prod1_id, v_batch1_2_id, 27152, 'saldo_awal', 'system', 'INIT-DNA-2'),
    (v_prod2_id, v_batch2_id, 25260, 'saldo_awal', 'system', 'INIT-ABM'),
    (v_prod3_id, v_batch3_id, 41044, 'saldo_awal', 'system', 'INIT-AHM'),
    (v_prod4_id, v_batch4_id, 22918, 'saldo_awal', 'system', 'INIT-LLN'),
    (v_prod5_id, v_batch5_id, 60769, 'saldo_awal', 'system', 'INIT-POM'),
    (v_prod6_id, v_batch6_id, 10896, 'saldo_awal', 'system', 'INIT-WSS');

  -- Bundles
  INSERT INTO bundles (id, name, sku) VALUES
    (v_bundle1_id, 'Paket Glow Duo', 'BNDL-GLOW-DUO'),
    (v_bundle2_id, 'Paket Whitening Set', 'BNDL-WHITE-SET');

  -- Bundle Components
  INSERT INTO bundle_components (bundle_id, product_id, qty) VALUES
    (v_bundle1_id, v_prod2_id, 1),
    (v_bundle1_id, v_prod1_id, 1),
    (v_bundle2_id, v_prod6_id, 1),
    (v_bundle2_id, v_prod2_id, 1);

  -- Seed a sample promo rule
  INSERT INTO promo_rules (id, name, buy_product_id, min_buy_qty, start_date, end_date, channels, is_active)
  VALUES (
    v_promo_id,
    'Promo Bonus Glowing Mawar',
    v_prod1_id,
    1,
    CURRENT_TIMESTAMP - INTERVAL '10 days',
    CURRENT_TIMESTAMP + INTERVAL '30 days',
    ARRAY['shopee', 'tiktok'],
    true
  );

  INSERT INTO promo_free_items (promo_rule_id, product_id, qty)
  VALUES (
    v_promo_id,
    v_prod2_id,
    2
  );
END $$;
