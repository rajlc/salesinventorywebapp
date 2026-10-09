-- Migration: Allow duplicate order numbers / order IDs across different stores
-- When a customer places an order containing items from multiple stores (e.g. BTAS and Sajha Cart),
-- Daraz assigns the exact same order_id / order_number to each store's order package.
-- Therefore, an order is unique PER STORE (order_id, store_id), not globally across all stores.

-- 1. Drop the legacy unique constraint on order_id alone
ALTER TABLE daraz_orders DROP CONSTRAINT IF EXISTS daraz_orders_order_id_key;

-- 2. Add composite unique constraint on (order_id, store_id)
ALTER TABLE daraz_orders DROP CONSTRAINT IF EXISTS daraz_orders_order_store_unique;
ALTER TABLE daraz_orders ADD CONSTRAINT daraz_orders_order_store_unique UNIQUE (order_id, store_id);
