-- Migration: Add missing indexes that were causing full table scans
-- These fix OR queries across seller_sku2/3/4, finance transaction lookups, and seller account filters

-- ============================================================
-- 1. Missing SKU indexes (fixes OR query across 4 sku columns)
-- Without these, lookups like: .or('seller_sku1.eq.X,seller_sku2.eq.X,...')
-- do a full sequential scan on the products table
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_products_seller_sku2
    ON products(seller_sku2)
    WHERE seller_sku2 IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_seller_sku3
    ON products(seller_sku3)
    WHERE seller_sku3 IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_products_seller_sku4
    ON products(seller_sku4)
    WHERE seller_sku4 IS NOT NULL;

-- ============================================================
-- 2. Finance transaction indexes (fixes unbounded pagination loop)
-- daraz-finance-service.ts does sequential .range() loops on statement + store_id
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_daraz_finance_txn_statement
    ON daraz_finance_transactions(statement)
    WHERE statement IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_daraz_finance_txn_store_id
    ON daraz_finance_transactions(store_id)
    WHERE store_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_daraz_finance_txn_store_stmt
    ON daraz_finance_transactions(store_id, statement);

-- ============================================================
-- 3. Live prices product_id index
-- daraz_live_prices is fetched in parallel pages — product_id lookups need an index
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_daraz_live_prices_product_id
    ON daraz_live_prices(product_id)
    WHERE product_id IS NOT NULL;

-- ============================================================
-- 4. Seller account ILIKE optimization
-- .ilike('seller_account', '%...%') on daraz_order_items does full scans
-- Use a lower() functional index to support case-insensitive prefix/contains searches
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_daraz_order_items_seller_account_lower
    ON daraz_order_items(LOWER(seller_account))
    WHERE seller_account IS NOT NULL;

-- Also cover orders table ilike on seller_account if present
CREATE INDEX IF NOT EXISTS idx_daraz_orders_seller_account_lower
    ON daraz_orders(LOWER(seller_account))
    WHERE seller_account IS NOT NULL;

-- ============================================================
-- 5. avg_prices product_id (for upsert onConflict target)
-- The upsert in bulkUpdateDarazAvgPrice needs a unique index on product_id
-- ============================================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_daraz_avg_prices_product_id_unique
    ON daraz_avg_prices(product_id);

-- ============================================================
-- 6. daraz_order_items order_id — critical for lateral join in RPC
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_daraz_order_items_order_id
    ON daraz_order_items(order_id)
    WHERE order_id IS NOT NULL;

COMMENT ON INDEX idx_products_seller_sku2 IS 'Fixes full scan on OR SKU lookup across 4 columns';
COMMENT ON INDEX idx_daraz_finance_txn_store_stmt IS 'Fixes sequential pagination scan in finance service';
COMMENT ON INDEX idx_daraz_avg_prices_product_id_unique IS 'Required for upsert onConflict on product_id';
