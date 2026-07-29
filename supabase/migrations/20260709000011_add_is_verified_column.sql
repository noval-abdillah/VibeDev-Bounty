-- Migration: Add is_verified column to stock_ledger
ALTER TABLE public.stock_ledger ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT true;

-- Update existing saldo_awal entries to be unverified
UPDATE public.stock_ledger SET is_verified = false WHERE reason = 'saldo_awal';

-- Re-create prevent_ledger_update_delete trigger function to allow updating ONLY the is_verified column
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
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_ledger_update_delete ON stock_ledger;
CREATE TRIGGER trg_prevent_ledger_update_delete
BEFORE UPDATE OR DELETE ON stock_ledger
FOR EACH ROW
EXECUTE FUNCTION prevent_ledger_update_delete();
