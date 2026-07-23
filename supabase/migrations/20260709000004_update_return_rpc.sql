-- Update process_return function to handle custom batch creation for 'layak_jual' condition
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

  -- Find product by SKU
  SELECT id INTO v_prod_id FROM products WHERE sku = p_sku;
  IF v_prod_id IS NULL THEN
    RAISE EXCEPTION 'Produk dengan SKU % tidak ditemukan.', p_sku;
  END IF;

  -- 1. LAYAK JUAL -> Buat batch baru, tambah balik ke stok
  IF p_condition = 'layak_jual' THEN
    IF p_batch_code IS NULL OR p_expiry_date IS NULL THEN
      RAISE EXCEPTION 'Kode batch dan tanggal kedaluwarsa wajib diisi untuk kondisi layak jual.';
    END IF;

    -- Create new batch
    INSERT INTO batches (product_id, batch_code, expiry_date)
    VALUES (v_prod_id, UPPER(TRIM(p_batch_code)), p_expiry_date)
    RETURNING id INTO v_batch_id;

    -- Record in ledger (+qty)
    INSERT INTO stock_ledger (product_id, batch_id, qty, reason, channel, reference_id)
    VALUES (v_prod_id, v_batch_id, p_qty, v_reason, p_channel, 'RETUR-LAYAK-' || p_order_code);

  -- 2. RUSAK -> Write-off, tidak menambah stok, dicatat sebagai loss di ledger
  ELSIF p_condition = 'rusak' THEN
    -- Try to find original batch from previous shipped entries
    SELECT batch_id INTO v_batch_id FROM stock_ledger 
    WHERE reference_id = p_order_code AND qty < 0 LIMIT 1;

    -- Fallback to first batch if not found
    IF v_batch_id IS NULL THEN
      SELECT id INTO v_batch_id FROM batches WHERE product_id = v_prod_id LIMIT 1;
    END IF;

    IF v_batch_id IS NOT NULL THEN
      -- Record return (+qty) and immediate write-off (-qty) to keep full audit trail
      INSERT INTO stock_ledger (product_id, batch_id, qty, reason, channel, reference_id)
      VALUES (v_prod_id, v_batch_id, p_qty, v_reason, p_channel, 'RETUR-DAMAGE-ARRIVE-' || p_order_code);
      
      INSERT INTO stock_ledger (product_id, batch_id, qty, reason, channel, reference_id)
      VALUES (v_prod_id, v_batch_id, -p_qty, 'rusak', 'manual', 'RETUR-DAMAGE-DISCARD-' || p_order_code);
    END IF;

  -- 3. HILANG -> Loss juga, tapi dipisah dari rusak sebagai alasan ledger berbeda
  ELSIF p_condition = 'hilang' THEN
    -- Try to find original batch
    SELECT batch_id INTO v_batch_id FROM stock_ledger 
    WHERE reference_id = p_order_code AND qty < 0 LIMIT 1;

    -- Fallback
    IF v_batch_id IS NULL THEN
      SELECT id INTO v_batch_id FROM batches WHERE product_id = v_prod_id LIMIT 1;
    END IF;

    IF v_batch_id IS NOT NULL THEN
      -- Record return (+qty) and immediate write-off (-qty) as lost
      INSERT INTO stock_ledger (product_id, batch_id, qty, reason, channel, reference_id)
      VALUES (v_prod_id, v_batch_id, p_qty, v_reason, p_channel, 'RETUR-LOST-ARRIVE-' || p_order_code);
      
      INSERT INTO stock_ledger (product_id, batch_id, qty, reason, channel, reference_id)
      VALUES (v_prod_id, v_batch_id, -p_qty, 'rusak', 'manual', 'RETUR-LOST-IN-TRANSIT-' || p_order_code);
    END IF;
  END IF;

  -- Update return record status and condition
  UPDATE returns SET 
    condition = p_condition,
    received_at = NOW(),
    status = 'COMPLETED' -- Mark completed upon inspection
  WHERE id = p_return_id;
END;
$$ LANGUAGE plpgsql;
