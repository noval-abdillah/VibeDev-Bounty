-- 1. Add is_verified column to stock_ledger
ALTER TABLE stock_ledger ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT true;

-- Update existing saldo_awal entries to be unverified ("belum terverifikasi")
UPDATE stock_ledger SET is_verified = false WHERE reason = 'saldo_awal';

-- 2. Update prevent_ledger_update_delete trigger function to allow updating ONLY the is_verified column
CREATE OR REPLACE FUNCTION prevent_ledger_update_delete()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    -- Check if any column other than is_verified has been modified
    IF OLD.id = NEW.id AND 
       OLD.product_id = NEW.product_id AND 
       OLD.batch_id = NEW.batch_id AND 
       OLD.qty = NEW.qty AND 
       OLD.reason = NEW.reason AND 
       OLD.channel = NEW.channel AND 
       OLD.reference_id = NEW.reference_id AND 
       OLD.created_at = NEW.created_at THEN
      RETURN NEW;
    ELSE
      RAISE EXCEPTION 'Stock Ledger is append-only. Only the is_verified status can be updated.';
    END IF;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Stock Ledger is append-only. DELETE operations are prohibited.';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Update process_return function to NOT write ledger entries for 'rusak' or 'hilang'
-- (Avoids double-count since stock was already deducted during shipped)
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
  v_prod_id UUID;
  v_batch_id UUID;
  v_reason TEXT;
BEGIN
  v_reason := CASE WHEN p_channel = 'shopee' THEN 'retur_shopee' ELSE 'retur_tiktok' END;

  -- Find product by SKU
  SELECT id INTO v_prod_id FROM products WHERE sku = p_sku;
  IF v_prod_id IS NULL THEN
    RAISE EXCEPTION 'Produk dengan SKU % tidak ditemukan.', p_sku;
  END IF;

  -- 1. LAYAK JUAL -> Buat batch baru, tambah balik ke stok (tanda 'retur' pada kode batch)
  IF p_condition = 'layak_jual' THEN
    IF p_batch_code IS NULL OR p_expiry_date IS NULL THEN
      RAISE EXCEPTION 'Kode batch dan tanggal kedaluwarsa wajib diisi untuk kondisi layak jual.';
    END IF;

    -- Create new batch marked with 'RETUR-' prefix to preserve FEFO accuracy
    INSERT INTO batches (product_id, batch_code, expiry_date)
    VALUES (v_prod_id, 'RETUR-' || UPPER(TRIM(p_batch_code)), p_expiry_date)
    RETURNING id INTO v_batch_id;

    -- Record in ledger (+qty)
    INSERT INTO stock_ledger (product_id, batch_id, qty, reason, channel, reference_id)
    VALUES (v_prod_id, v_batch_id, p_qty, v_reason, p_channel, 'RETUR-LAYAK-' || p_order_code);

  -- 2. RUSAK / HILANG -> Tidak menulis movement stok kedua (stok sudah terpotong saat shipped).
  -- Hanya dicatat di returns table untuk audit/klaim.
  ELSIF p_condition = 'rusak' OR p_condition = 'hilang' THEN
    -- Do not write to stock_ledger. Net stock remains unchanged (deducted).
    NULL;
  END IF;

  -- Update return record status and condition
  UPDATE returns SET 
    condition = p_condition,
    received_at = NOW(),
    status = 'COMPLETED'
  WHERE id = p_return_id;
END;
$$ LANGUAGE plpgsql;
