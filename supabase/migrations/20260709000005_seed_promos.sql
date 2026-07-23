-- Seeding a sample promo rule: Buy 1x DNA Salmon (SKU-014) -> get 2x AURA BLOOM MASK (SKU-002) free
DO $$
DECLARE
  v_buy_prod_id UUID;
  v_free_prod_id UUID;
  v_promo_id UUID := gen_random_uuid();
BEGIN
  -- Get product IDs
  SELECT id INTO v_buy_prod_id FROM products WHERE sku = 'SKU-014';
  SELECT id INTO v_free_prod_id FROM products WHERE sku = 'SKU-002';

  IF v_buy_prod_id IS NOT NULL AND v_free_prod_id IS NOT NULL THEN
    -- Insert Promo Rule
    INSERT INTO promo_rules (id, name, buy_product_id, min_buy_qty, start_date, end_date, channels, is_active)
    VALUES (
      v_promo_id,
      'Promo Bonus Glowing Mawar',
      v_buy_prod_id,
      1,
      CURRENT_TIMESTAMP - INTERVAL '10 days',
      CURRENT_TIMESTAMP + INTERVAL '30 days',
      ARRAY['shopee', 'tiktok'],
      true
    ) ON CONFLICT DO NOTHING;

    -- Insert associated free item
    INSERT INTO promo_free_items (promo_rule_id, product_id, qty)
    VALUES (
      v_promo_id,
      v_free_prod_id,
      2
    ) ON CONFLICT DO NOTHING;
  END IF;
END $$;
