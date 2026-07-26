# AGENTS.md

## Commands
- **Dev Server**: `npm run dev` (Runs on port `3055` as configured in `package.json`).
- **Build & Verification**: `npx tsc --noEmit && npx next build`
- **Linter**: `npx next lint`

## Architecture & Data Flow
- **Single Source of Truth**: The `stock_ledger` table is strictly append-only. Writing stock alterations directly from the client is prohibited.
- **Cache-Optimized Reads**: Current stock counts are read at $O(1)$ efficiency from the views `product_stock_summary` and `batch_stock_summary`. These views do not run `SUM` queries; they select directly from `product_stocks_cache` and `batch_stocks_cache`, which are maintained incrementally via PostgreSQL database triggers upon ledger insertion.
- **Centralized Ledger Operations**: All manual entry creations, opname corrections, and stock-outs are routed through the server route `/api/ledger/route.ts` which calls PostgreSQL RPC functions (`create_manual_ledger_entry`, `create_opname_corrections`, `process_order_fefo` respectively).
- **Marketplace Webhooks**: Simulated orders, cancellations, and returns are routed through `/api/webhook/orders/route.ts`.
- **Idempotency**: Enforced at the database layer via unique constraint index `idx_ledger_idempotent` on `(reference_id, product_id, batch_id)`. Webhooks and RPC actions check for duplicates before writing to the ledger.
- **Bundle Recipes & Versioning**: SKU bundle compositions are snapshotted as `resolved_components` JSONB on the `orders` record at the moment the status becomes `SHIPPED` or `IN_TRANSIT`. This ensures that subsequent cancellations or returns always use the historic bundle recipe even if the master recipe changes.
- **Immutability Enforcement**: Direct `UPDATE` and `DELETE` on the `stock_ledger` table are prohibited via `trg_prevent_ledger_update_delete` trigger and `REVOKE` role policies at the database level. Only the `is_verified` column is allowed to be updated.

## Database Migrations (Supabase SQL Editor)
When running new migrations in the Supabase SQL editor:
1. Always run migration scripts in numeric order (6 → 7 → 8 → 9).
2. If changing cache tables or views, drop the views first using `DROP VIEW IF EXISTS ... CASCADE` to prevent database schema type mismatches.
