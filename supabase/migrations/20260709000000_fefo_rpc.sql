-- PostgreSQL Function for atomic FEFO allocation and stock ledger insertion
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

-- PostgreSQL Function for atomic order cancellation with stock reversal
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

-- PostgreSQL Function for atomic return processing
-- condition: 'layak_jual', 'rusak', or 'hilang'
CREATE OR REPLACE FUNCTION process_return(
  p_return_id UUID,
  p_order_code TEXT,
  p_channel TEXT,
  p_sku TEXT,
  p_qty INT,
  p_condition TEXT
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

  -- Try to find original deduction entries
  FOR r IN 
    SELECT * FROM stock_ledger 
    WHERE reference_id = p_order_code AND qty < 0
    FOR UPDATE
  LOOP
    v_found := true;
    
    IF p_condition = 'layak_jual' THEN
      INSERT INTO stock_ledger (product_id, batch_id, qty, reason, channel, reference_id)
      VALUES (r.product_id, r.batch_id, ABS(r.qty), v_reason, p_channel, 'RETUR-LAYAK-' || p_order_code);
    ELSIF p_condition = 'rusak' THEN
      INSERT INTO stock_ledger (product_id, batch_id, qty, reason, channel, reference_id)
      VALUES (r.product_id, r.batch_id, ABS(r.qty), v_reason, p_channel, 'RETUR-DAMAGE-ARRIVE-' || p_order_code);
      INSERT INTO stock_ledger (product_id, batch_id, qty, reason, channel, reference_id)
      VALUES (r.product_id, r.batch_id, -ABS(r.qty), 'rusak', 'manual', 'RETUR-DAMAGE-DISCARD-' || p_order_code);
    ELSIF p_condition = 'hilang' THEN
      INSERT INTO stock_ledger (product_id, batch_id, qty, reason, channel, reference_id)
      VALUES (r.product_id, r.batch_id, ABS(r.qty), v_reason, p_channel, 'RETUR-LOST-ARRIVE-' || p_order_code);
      INSERT INTO stock_ledger (product_id, batch_id, qty, reason, channel, reference_id)
      VALUES (r.product_id, r.batch_id, -ABS(r.qty), 'rusak', 'manual', 'RETUR-LOST-IN-TRANSIT-' || p_order_code);
    END IF;
  END LOOP;

  -- If no original deduction found (legacy data), use SKU lookup to find product and batch
  IF NOT v_found THEN
    -- Find product by SKU
    SELECT id INTO v_prod_id FROM products WHERE sku = p_sku;
    
    IF v_prod_id IS NOT NULL THEN
      -- Pick the first batch for this product
      SELECT id INTO v_batch_id FROM batches WHERE product_id = v_prod_id LIMIT 1;
      
      IF v_batch_id IS NOT NULL THEN
        IF p_condition = 'layak_jual' THEN
          INSERT INTO stock_ledger (product_id, batch_id, qty, reason, channel, reference_id)
          VALUES (v_prod_id, v_batch_id, p_qty, v_reason, p_channel, 'RETUR-LAYAK-' || p_order_code);
        ELSIF p_condition = 'rusak' THEN
          INSERT INTO stock_ledger (product_id, batch_id, qty, reason, channel, reference_id)
          VALUES (v_prod_id, v_batch_id, p_qty, v_reason, p_channel, 'RETUR-DAMAGE-ARRIVE-' || p_order_code);
          INSERT INTO stock_ledger (product_id, batch_id, qty, reason, channel, reference_id)
          VALUES (v_prod_id, v_batch_id, -p_qty, 'rusak', 'manual', 'RETUR-DAMAGE-DISCARD-' || p_order_code);
        ELSIF p_condition = 'hilang' THEN
          INSERT INTO stock_ledger (product_id, batch_id, qty, reason, channel, reference_id)
          VALUES (v_prod_id, v_batch_id, p_qty, v_reason, p_channel, 'RETUR-LOST-ARRIVE-' || p_order_code);
          INSERT INTO stock_ledger (product_id, batch_id, qty, reason, channel, reference_id)
          VALUES (v_prod_id, v_batch_id, -p_qty, 'rusak', 'manual', 'RETUR-LOST-IN-TRANSIT-' || p_order_code);
        END IF;
      END IF;
    END IF;
  END IF;

  -- Update return record
  UPDATE returns SET 
    condition = p_condition,
    received_at = NOW(),
    status = 'PENDING'
  WHERE id = p_return_id;
END;
$$ LANGUAGE plpgsql;
