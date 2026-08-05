-- Add performance indexes for optimized queries

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_daraz_orders_status_delivered_at ON daraz_orders(order_status, delivered_at);
CREATE INDEX IF NOT EXISTS idx_daraz_orders_status_delivered_by_daraz ON daraz_orders(order_status, delivered_by_daraz);
CREATE INDEX IF NOT EXISTS idx_daraz_orders_date_status_created ON daraz_orders(order_date, order_status, created_at DESC);

-- Indexes for daraz_order_items to improve join performance
CREATE INDEX IF NOT EXISTS idx_daraz_order_items_order_id_status ON daraz_order_items(order_id, item_status);
CREATE INDEX IF NOT EXISTS idx_daraz_order_items_product_id_status ON daraz_order_items(product_id, item_status);
CREATE INDEX IF NOT EXISTS idx_daraz_order_items_seller_account_status ON daraz_order_items(seller_account, item_status);

-- Indexes for common filtering patterns
CREATE INDEX IF NOT EXISTS idx_daraz_orders_customer_name_status ON daraz_orders(customer_name, order_status);
CREATE INDEX IF NOT EXISTS idx_daraz_orders_invoice_number_status ON daraz_orders(invoice_number, order_status);
CREATE INDEX IF NOT EXISTS idx_daraz_orders_tracking_number_status ON daraz_orders(tracking_number, order_status);

-- Indexes for date-based queries
CREATE INDEX IF NOT EXISTS idx_daraz_orders_created_at_status ON daraz_orders(created_at, order_status);
CREATE INDEX IF NOT EXISTS idx_daraz_orders_order_date_status ON daraz_orders(order_date, order_status);

-- Indexes for products table to improve inventory view performance
CREATE INDEX IF NOT EXISTS idx_products_seller_sku_main ON products(seller_sku1);
CREATE INDEX IF NOT EXISTS idx_products_product_name_main ON products(product_name);

-- Indexes for purchase_products to improve cost lookup performance
CREATE INDEX IF NOT EXISTS idx_purchase_products_product_id_unit_price ON purchase_products(product_id, unit_price);
CREATE INDEX IF NOT EXISTS idx_purchase_products_purchase_id_product_id ON purchase_products(purchase_id, product_id);

-- Indexes for purchases to improve date-based queries
CREATE INDEX IF NOT EXISTS idx_purchases_supplier_id_date ON purchases(supplier_id, purchase_date);
CREATE INDEX IF NOT EXISTS idx_purchases_purchase_date_created ON purchases(purchase_date, created_at);

-- Indexes for marketplace orders
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_status_date_created ON marketplace_orders(order_status, order_date, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_customer_status ON marketplace_orders(customer_name, order_status);

-- Partial indexes for common filtered queries
CREATE INDEX IF NOT EXISTS idx_daraz_orders_delivered_only ON daraz_orders(order_status, delivered_at) WHERE order_status = 'Delivered';
CREATE INDEX IF NOT EXISTS idx_daraz_orders_customer_return_delivered_only ON daraz_orders(order_status, delivered_at) WHERE order_status = 'Customer Return Delivered';

-- Expression indexes for common computed fields
CREATE INDEX IF NOT EXISTS idx_daraz_orders_coalesce_delivered ON daraz_orders((COALESCE(delivered_by_daraz, delivered_at)));

-- Indexes to support the materialized view refresh queries
CREATE INDEX IF NOT EXISTS idx_daraz_orders_delivered_status_for_cache ON daraz_orders(delivered_by_daraz, order_status) WHERE order_status IN ('Delivered', 'Customer Return Delivered');

-- Indexes for foreign key relationships to improve join performance
CREATE INDEX IF NOT EXISTS idx_daraz_order_items_order_id_fkey ON daraz_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_daraz_order_items_product_id_fkey ON daraz_order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_purchase_products_product_id_fkey ON purchase_products(product_id);
CREATE INDEX IF NOT EXISTS idx_purchase_products_purchase_id_fkey ON purchase_products(purchase_id);

-- Functional indexes for case-insensitive searches
CREATE INDEX IF NOT EXISTS idx_daraz_orders_customer_name_lower ON daraz_orders(LOWER(customer_name));
CREATE INDEX IF NOT EXISTS idx_daraz_orders_order_number_lower ON daraz_orders(LOWER(order_number));
CREATE INDEX IF NOT EXISTS idx_daraz_orders_invoice_number_lower ON daraz_orders(LOWER(invoice_number));

-- Indexes for performance monitoring
-- These will help identify slow queries and optimize further
CREATE INDEX IF NOT EXISTS idx_daraz_orders_created_at_for_monitoring ON daraz_orders(created_at DESC);

-- Add comments to document the indexes
COMMENT ON INDEX idx_daraz_orders_status_delivered_at IS 'Index for common query pattern: filter by status and order by delivery date';
COMMENT ON INDEX idx_daraz_orders_date_status_created IS 'Index for date range queries with status filtering';
COMMENT ON INDEX idx_daraz_order_items_order_id_status IS 'Index for joining orders with items and filtering by item status';
COMMENT ON INDEX idx_daraz_orders_delivered_only IS 'Partial index for frequently queried delivered orders';