-- Migration to add Promo Rules and Free Items tables
CREATE TABLE IF NOT EXISTS promo_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  buy_product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  min_buy_qty INTEGER NOT NULL CHECK (min_buy_qty > 0),
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  end_date TIMESTAMP WITH TIME ZONE NOT NULL,
  channels TEXT[] NOT NULL, -- e.g. ARRAY['shopee', 'tiktok']
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS promo_free_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promo_rule_id UUID REFERENCES promo_rules(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0)
);

-- Enable RLS
ALTER TABLE promo_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_free_items ENABLE ROW LEVEL SECURITY;

-- Drop policies if exists
DROP POLICY IF EXISTS "Public Read" ON promo_rules;
DROP POLICY IF EXISTS "Admin All" ON promo_rules;
DROP POLICY IF EXISTS "Public Read" ON promo_free_items;
DROP POLICY IF EXISTS "Admin All" ON promo_free_items;

-- Create RLS Policies
CREATE POLICY "Public Read" ON promo_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin All" ON promo_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Public Read" ON promo_free_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin All" ON promo_free_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
