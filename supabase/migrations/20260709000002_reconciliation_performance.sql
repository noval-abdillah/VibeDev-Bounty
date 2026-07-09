-- Upgrades database view structures for high-performance and automated calculations

-- 1. Create a View for Daily Reconciliation anomalies calculation at database level
-- This prevents N+1 query loops and heavy Client-side Javascript array processing.
CREATE OR REPLACE VIEW daily_reconciliation_summary AS
SELECT 
  o.id as order_id,
  o.order_code,
  o.channel,
  o.sku,
  o.qty as order_qty,
  o.created_at as order_created_at,
  -- Sum only the negative ledger entries matching this order reference
  COALESCE(ABS(SUM(l.qty)), 0) as ledger_qty,
  -- Calculate discrepancy (expected vs actual deduction)
  (o.qty - COALESCE(ABS(SUM(l.qty)), 0)) as discrepancy
FROM orders o
LEFT JOIN stock_ledger l ON l.reference_id = o.order_code AND l.qty < 0
WHERE o.status NOT IN ('PENDING', 'CANCELLED')
GROUP BY o.id, o.order_code, o.channel, o.sku, o.qty, o.created_at;
