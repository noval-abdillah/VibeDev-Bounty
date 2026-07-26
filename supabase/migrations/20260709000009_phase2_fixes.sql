-- ===================================================================
-- PHASE 2 FIXES: Idempotency, Bundle Versioning, Partial Cancel,
--                Retur Bundle Components, DB Constraints, REVOKE
-- ===================================================================

-- 1. IDEMPOTENCY: Unique index on (reference_id, product_id, batch_id) in stock_ledger
--    Prevents double-processing of the same event.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_idempotent
  ON stock_ledger (reference_id, product_id, batch_id);

-- 2. CHECK constraint on reason column to enforce valid reason codes at DB level
ALTER TABLE stock_ledger DROP CONSTRAINT IF EXISTS chk_ledger_reason;
ALTER TABLE stock_ledger ADD CONSTRAINT chk_ledger_reason
  CHECK (reason IN (
    'saldo_awal', 'masuk_maklon', 'penjualan_offline',
    'bonus', 'promo', 'sampel', 'rusak', 'kedaluwarsa',
    'pesanan_shopee', 'pesanan_tiktok',
    'retur_shopee', 'retur_tiktok',
    'opname_koreksi', 'koreksi_salah_input'
  ));

-- 3. CHECK constraint on channel column
ALTER TABLE stock_ledger DROP CONSTRAINT IF EXISTS chk_ledger_channel;
ALTER TABLE stock_ledger ADD CONSTRAINT chk_ledger_channel
  CHECK (channel IN ('system', 'shopee', 'tiktok', 'manual'));

-- 4. REVOKE direct UPDATE/DELETE on stock_ledger from authenticated role
--    (Trigger is the last line of defense; REVOKE is first line)
REVOKE UPDATE, DELETE ON stock_ledger FROM authenticated;

-- 5. Bundle recipe versioning: add version column to bundle_components
ALTER TABLE bundle_components ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE bundle_components ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true;

-- 6. Rewrite process_order_fefo to support idempotency via ON CONFLICT
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
  v_exists BOOLEAN;
BEGIN
  -- Idempotency check: skip if already processed for this ref+product
  SELECT EXISTS(
    SELECT 1 FROM stock_ledger
    WHERE reference_id = p_ref_id AND product_id = p_product_id AND qty < 0
  ) INTO v_exists;
  IF v_exists THEN RETURN; END IF;

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

-- 7. Rewrite process_cancel_order to support partial cancellation + idempotency
CREATE OR REPLACE FUNCTION process_cancel_order(
  p_order_id UUID,
  p_order_code TEXT,
  p_channel TEXT,
  p_cancel_qty INT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  r RECORD;
  v_reason TEXT;
  v_cancel_ref TEXT;
  v_exists BOOLEAN;
BEGIN
  v_cancel_ref := 'CANCEL-REFUND-' || p_order_code;
  v_reason := CASE WHEN p_channel = 'shopee' THEN 'retur_shopee' ELSE 'retur_tiktok' END;

  -- Idempotency check
  SELECT EXISTS(
    SELECT 1 FROM stock_ledger WHERE reference_id = v_cancel_ref
  ) INTO v_exists;
  IF v_exists THEN RETURN; END IF;

  IF p_cancel_qty IS NULL THEN
    -- Full cancellation: reverse all deductions
    FOR r IN 
      SELECT * FROM stock_ledger 
      WHERE reference_id = p_order_code AND qty < 0
      FOR UPDATE
    LOOP
      INSERT INTO stock_ledger (product_id, batch_id, qty, reason, channel, reference_id)
      VALUES (r.product_id, r.batch_id, ABS(r.qty), v_reason, p_channel, v_cancel_ref);
    END LOOP;
    UPDATE orders SET status = 'CANCELLED' WHERE id = p_order_id;
  ELSE
    -- Partial cancellation: reverse up to p_cancel_qty per product proportionally
    FOR r IN 
      SELECT * FROM stock_ledger 
      WHERE reference_id = p_order_code AND qty < 0
      ORDER BY created_at ASC
      FOR UPDATE
    LOOP
      IF p_cancel_qty <= 0 THEN EXIT; END IF;
      DECLARE
        v_reverse INT;
      BEGIN
        v_reverse := LEAST(p_cancel_qty, ABS(r.qty));
        INSERT INTO stock_ledger (product_id, batch_id, qty, reason, channel, reference_id)
        VALUES (r.product_id, r.batch_id, v_reverse, v_reason, p_channel, v_cancel_ref);
        p_cancel_qty := p_cancel_qty - v_reverse;
      END;
    END LOOP;
    -- Partial cancel: keep order status, update qty
    UPDATE orders SET qty = GREATEST(qty - COALESCE(p_cancel_qty, 0), 0) WHERE id = p_order_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 8. Rewrite process_return to handle bundle SKUs by resolving components
CREATE OR REPLACE FUNCTION process_return(
  p_return_id UUID,
  p_order_code TEXT,
  p_channel TEXT,
  p_sku TEXT,
  p_qty INT,
  p_condition TEXT,
  p_batch_code TEXT DEFAULT NULL,
  p_expiry_date DATE DEFAULT NULL,
  p_resolved_components JSONB DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_prod_id UUID;
  v_batch_id UUID;
  v_reason TEXT;
  v_comp RECORD;
  v_comp_qty INT;
BEGIN
  v_reason := CASE WHEN p_channel = 'shopee' THEN 'retur_shopee' ELSE 'retur_tiktok' END;

  -- If resolved_components provided (bundle retur), process each component
  IF p_resolved_components IS NOT NULL AND jsonb_array_length(p_resolved_components) > 0 THEN
    FOR v_comp IN SELECT * FROM jsonb_to_recordset(p_resolved_components) AS x(product_id UUID, qty INT)
    LOOP
      v_comp_qty := v_comp.qty * p_qty;

      IF p_condition = 'layak_jual' THEN
        IF p_batch_code IS NULL OR p_expiry_date IS NULL THEN
          RAISE EXCEPTION 'Kode batch dan tanggal kedaluwarsa wajib diisi untuk kondisi layak jual.';
        END IF;
        INSERT INTO batches (product_id, batch_code, expiry_date)
        VALUES (v_comp.product_id, 'RETUR-' || UPPER(TRIM(p_batch_code)), p_expiry_date)
        RETURNING id INTO v_batch_id;
        INSERT INTO stock_ledger (product_id, batch_id, qty, reason, channel, reference_id)
        VALUES (v_comp.product_id, v_batch_id, v_comp_qty, v_reason, p_channel, 'RETUR-LAYAK-' || p_order_code);
      END IF;
      -- rusak/hilang: no ledger write (stock already deducted at shipped)
    END LOOP;
  ELSE
    -- Single product SKU retur (original logic)
    SELECT id INTO v_prod_id FROM products WHERE sku = p_sku;
    IF v_prod_id IS NULL THEN
      RAISE EXCEPTION 'Produk dengan SKU % tidak ditemukan.', p_sku;
    END IF;

    IF p_condition = 'layak_jual' THEN
      IF p_batch_code IS NULL OR p_expiry_date IS NULL THEN
        RAISE EXCEPTION 'Kode batch dan tanggal kedaluwarsa wajib diisi untuk kondisi layak jual.';
      END IF;
      INSERT INTO batches (product_id, batch_code, expiry_date)
      VALUES (v_prod_id, 'RETUR-' || UPPER(TRIM(p_batch_code)), p_expiry_date)
      RETURNING id INTO v_batch_id;
      INSERT INTO stock_ledger (product_id, batch_id, qty, reason, channel, reference_id)
      VALUES (v_prod_id, v_batch_id, p_qty, v_reason, p_channel, 'RETUR-LAYAK-' || p_order_code);
    END IF;
    -- rusak/hilang: no ledger write
  END IF;

  UPDATE returns SET 
    condition = p_condition,
    received_at = NOW(),
    status = 'COMPLETED'
  WHERE id = p_return_id;
END;
$$ LANGUAGE plpgsql;

-- 9. RPC for manual ledger operations (replaces direct client insert)
CREATE OR REPLACE FUNCTION create_manual_ledger_entry(
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
  v_exists BOOLEAN;
BEGIN
  -- Idempotency: skip if exact same entry already exists
  SELECT EXISTS(
    SELECT 1 FROM stock_ledger
    WHERE reference_id = p_ref_id AND product_id = p_product_id AND batch_id = p_batch_id
  ) INTO v_exists;
  IF v_exists THEN
    SELECT id INTO v_id FROM stock_ledger
    WHERE reference_id = p_ref_id AND product_id = p_product_id AND batch_id = p_batch_id
    LIMIT 1;
    RETURN v_id;
  END IF;

  INSERT INTO stock_ledger (product_id, batch_id, qty, reason, channel, reference_id)
  VALUES (p_product_id, p_batch_id, p_qty, p_reason, p_channel, p_ref_id)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. RPC for opname correction entries (batch operation)
CREATE OR REPLACE FUNCTION create_opname_corrections(
  p_session_id UUID,
  p_corrections JSONB
)
RETURNS VOID AS $$
DECLARE
  v_corr RECORD;
  v_ref TEXT;
BEGIN
  v_ref := 'OPNAME-CORR-' || LEFT(p_session_id::TEXT, 6);

  FOR v_corr IN SELECT * FROM jsonb_to_recordset(p_corrections)
    AS x(product_id UUID, batch_id UUID, diff INT)
  LOOP
    IF v_corr.diff <> 0 THEN
      INSERT INTO stock_ledger (product_id, batch_id, qty, reason, channel, reference_id)
      VALUES (v_corr.product_id, v_corr.batch_id, v_corr.diff, 'opname_koreksi', 'system', v_ref);
    END IF;
  END LOOP;

  -- Mark saldo_awal as verified for all products in this opname
  UPDATE stock_ledger SET is_verified = true
  WHERE reason = 'saldo_awal'
    AND product_id IN (
      SELECT DISTINCT (x->>'product_id')::UUID FROM jsonb_array_elements(p_corrections) x
    );

  UPDATE opname_sessions SET status = 'completed', completed_at = NOW()
  WHERE id = p_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
