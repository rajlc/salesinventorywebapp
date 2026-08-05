-- 1. Foreign Key Indexes to speed up JOINs
CREATE INDEX IF NOT EXISTS idx_daraz_order_items_order_id ON daraz_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_daraz_order_items_product_id ON daraz_order_items(product_id);

-- 2. Filter & Sort Indexes for common reports
CREATE INDEX IF NOT EXISTS idx_daraz_orders_delivered_at ON daraz_orders(delivered_at DESC);
CREATE INDEX IF NOT EXISTS idx_daraz_orders_order_status ON daraz_orders(order_status);

-- 3. Create Daily Sales Stats View (Corrected for Fee Duplication)
CREATE OR REPLACE VIEW daily_sales_stats_view AS
WITH item_stats AS (
    SELECT 
        order_id,
        SUM(COALESCE(amount, 0) * COALESCE(quantity, 1)) as order_revenue,
        SUM(COALESCE(purchase_cost, 0) * COALESCE(quantity, 1)) as order_cost
    FROM daraz_order_items
    WHERE item_status = 'Delivered' OR item_status IS NULL
    GROUP BY order_id
)
SELECT 
    DATE(o.delivered_at) as report_date,
    COUNT(DISTINCT o.id) as order_count,
    SUM(ist.order_revenue) as total_revenue,
    SUM(ist.order_cost) as total_cost,
    SUM(ist.order_revenue - ist.order_cost - COALESCE(o.daraz_fees, 0)) as total_profit
FROM daraz_orders o
JOIN item_stats ist ON o.id = ist.order_id
WHERE o.order_status IN ('Delivered', 'Customer Return Delivered')
GROUP BY DATE(o.delivered_at);;
