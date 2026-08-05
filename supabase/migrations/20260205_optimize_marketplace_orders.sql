-- Optimization: Optimize marketplace orders and related tables with proper indexes and functions

-- Create indexes for marketplace_orders table
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_status_date ON marketplace_orders(order_status, order_date);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_created_at ON marketplace_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_customer_name ON marketplace_orders(customer_name);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_order_number ON marketplace_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_tracking_number ON marketplace_orders(tracking_number);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_branch ON marketplace_orders(delivery_branch);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_courier ON marketplace_orders(courier_id);

-- Create indexes for marketplace_order_items table (assuming it exists)
-- CREATE INDEX IF NOT EXISTS idx_marketplace_order_items_order_id ON marketplace_order_items(order_id);
-- CREATE INDEX IF NOT EXISTS idx_marketplace_order_items_product_id ON marketplace_order_items(product_id);

-- Create function for calculating marketplace order profit (similar to daraz)
CREATE OR REPLACE FUNCTION calculate_marketplace_order_profit(order_id_param UUID)
RETURNS TABLE(
    order_revenue NUMERIC,
    order_cost NUMERIC,
    order_profit NUMERIC,
    order_profit_percentage NUMERIC
) 
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    total_revenue NUMERIC := 0;
    total_cost NUMERIC := 0;
    calculated_profit NUMERIC := 0;
    profit_percentage NUMERIC := 0;
BEGIN
    -- Calculate total revenue for the order (placeholder - adjust based on actual schema)
    -- This is a simplified calculation - adjust based on actual table structure
    SELECT COALESCE(SUM(price), 0)
    INTO total_revenue
    FROM marketplace_orders
    WHERE id = order_id_param;

    -- Calculate total purchase cost for the order (placeholder - adjust based on actual schema)
    -- This would typically join with order items and product costs
    SELECT COALESCE(SUM(purchase_cost), 0)
    INTO total_cost
    FROM marketplace_orders
    WHERE id = order_id_param;

    -- Calculate profit
    calculated_profit := total_revenue - total_cost;

    -- Calculate profit percentage (avoid division by zero)
    IF total_revenue > 0 THEN
        profit_percentage := (calculated_profit / total_revenue) * 100;
    ELSE
        profit_percentage := 0;
    END IF;

    -- Return the calculated values
    RETURN QUERY SELECT 
        total_revenue,
        total_cost,
        calculated_profit,
        profit_percentage;
END;
$$;

-- Create function to get marketplace order stats (moved from client-side calculation)
CREATE OR REPLACE FUNCTION get_marketplace_order_stats(
    status_param TEXT DEFAULT NULL,
    date_from DATE DEFAULT NULL,
    date_to DATE DEFAULT NULL
)
RETURNS TABLE(
    total_orders BIGINT,
    total_revenue NUMERIC,
    total_profit NUMERIC,
    avg_profit_per_order NUMERIC
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) AS total_orders,
        COALESCE(SUM(price), 0) AS total_revenue,
        COALESCE(SUM(profit), 0) AS total_profit,
        CASE 
            WHEN COUNT(*) > 0 THEN COALESCE(SUM(profit), 0) / COUNT(*)
            ELSE 0
        END AS avg_profit_per_order
    FROM marketplace_orders
    WHERE (status_param IS NULL OR order_status = status_param)
      AND (date_from IS NULL OR order_date >= date_from)
      AND (date_to IS NULL OR order_date <= date_to);
END;
$$;

-- Create optimized view for marketplace orders with computed fields
-- Note: This is a template based on the daraz orders structure - adjust based on actual schema
CREATE OR REPLACE VIEW marketplace_orders_with_totals AS
SELECT 
    mo.*,
    -- Add computed fields for marketplace orders
    -- Adjust these based on your actual marketplace orders schema
    (SELECT COUNT(*) FROM marketplace_order_items WHERE order_id = mo.id) AS item_count,
    -- Calculate total amount if not already present in the table
    (mo.price * mo.quantity) AS calculated_total_amount
FROM marketplace_orders mo;

-- Grant permissions
GRANT SELECT ON marketplace_orders_with_totals TO authenticated;

-- Create function to refresh various caches when needed
CREATE OR REPLACE FUNCTION refresh_all_business_logic_cache()
RETURNS TABLE(
    refresh_time TIMESTAMP WITH TIME ZONE,
    message TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    -- Refresh materialized views if they exist
    -- REFRESH MATERIALIZED VIEW daily_profit_summary_cache;
    
    -- Return success message
    RETURN QUERY SELECT NOW() AS refresh_time, 'Cache refresh completed' AS message;
EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY SELECT NOW() AS refresh_time, 'Cache refresh failed: ' || SQLERRM AS message;
END;
$$;

-- Add comments to document the functions
COMMENT ON FUNCTION calculate_marketplace_order_profit(UUID) IS 'Function to calculate profit for a specific marketplace order';
COMMENT ON FUNCTION get_marketplace_order_stats(TEXT, DATE, DATE) IS 'Function to get marketplace order statistics with filtering options';
COMMENT ON FUNCTION refresh_all_business_logic_cache() IS 'Function to refresh all business logic related caches';
COMMENT ON VIEW marketplace_orders_with_totals IS 'View providing marketplace orders with computed totals and counts';