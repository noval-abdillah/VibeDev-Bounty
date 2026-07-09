-- Setup database schema and profiles table
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  batch_code TEXT NOT NULL,
  expiry_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS stock_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  batch_id UUID REFERENCES batches(id) ON DELETE CASCADE NOT NULL,
  qty INTEGER NOT NULL,
  reason TEXT NOT NULL,
  channel TEXT NOT NULL,
  reference_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Trigger to prevent UPDATE and DELETE on stock_ledger
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

CREATE TABLE IF NOT EXISTS bundles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sku TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS bundle_components (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id UUID REFERENCES bundles(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_code TEXT NOT NULL UNIQUE,
  channel TEXT NOT NULL,
  status TEXT NOT NULL,
  sku TEXT NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS returns (
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

CREATE TABLE IF NOT EXISTS opname_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS opname_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES opname_sessions(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  batch_id UUID REFERENCES batches(id) ON DELETE CASCADE NOT NULL,
  physical_qty INTEGER NOT NULL CHECK (physical_qty >= 0),
  system_qty INTEGER NOT NULL CHECK (system_qty >= 0),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Profiles table for user roles linked to auth.users
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('gudang', 'owner', 'admin')),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS policies
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

-- Allow read/write access to authenticated users
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

-- DUMMY SEED DATA FOR TESTING
DO $$
DECLARE
  v_prod1_id UUID := gen_random_uuid();
  v_prod2_id UUID := gen_random_uuid();
  v_prod3_id UUID := gen_random_uuid();
  v_batch1_id UUID := gen_random_uuid();
  v_batch2_id UUID := gen_random_uuid();
  v_batch3_id UUID := gen_random_uuid();
  v_bundle1_id UUID := gen_random_uuid();
BEGIN
  -- Insert dummy products
  INSERT INTO products (id, name, sku, is_active) VALUES
    (v_prod1_id, 'Brightening Serum Niacinamide 10%', 'SK-SR-005', true),
    (v_prod2_id, 'Ceramide Barrier Moisture Gel Cream', 'SK-MC-009', true),
    (v_prod3_id, 'DNA Salmon', 'SKU-014', true);

  -- Insert dummy batches
  INSERT INTO batches (id, product_id, batch_code, expiry_date) VALUES
    (v_batch1_id, v_prod1_id, 'B-SK-SR-005-01', CURRENT_DATE + INTERVAL '30 days'),
    (v_batch2_id, v_prod2_id, 'B-SK-MC-009-01', CURRENT_DATE + INTERVAL '180 days'),
    (v_batch3_id, v_prod3_id, 'B-SKU-014-01', CURRENT_DATE + INTERVAL '10 days');

  -- Insert initial stock ledger (Saldo Awal)
  INSERT INTO stock_ledger (product_id, batch_id, qty, reason, channel, reference_id) VALUES
    (v_prod1_id, v_batch1_id, 100, 'saldo_awal', 'system', 'INIT-001'),
    (v_prod2_id, v_batch2_id, 250, 'saldo_awal', 'system', 'INIT-002'),
    (v_prod3_id, v_batch3_id, 640, 'saldo_awal', 'system', 'INIT-003');

  -- Insert dummy bundle
  INSERT INTO bundles (id, name, sku) VALUES
    (v_bundle1_id, 'Bundle Glowing Radiance', 'BNDL-GLOW-01');

  -- Insert dummy bundle components
  INSERT INTO bundle_components (bundle_id, product_id, qty) VALUES
    (v_bundle1_id, v_prod1_id, 1),
    (v_bundle1_id, v_prod2_id, 1);
END $$;
