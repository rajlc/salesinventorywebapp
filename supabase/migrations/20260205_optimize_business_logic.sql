-- Optimization: Move heavy business logic to Supabase functions, add indexes, and improve views

-- 1. Add indexes for frequently queried columns
-- Indexes for daraz_orders table
CREATE INDEX IF NOT EXISTS idx_daraz_orders_status_date ON daraz_orders(order_status, order_date);
CREATE INDEX IF NOT EXISTS idx_daraz_orders_delivered_at ON daraz_orders(delivered_at);
CREATE INDEX IF NOT EXISTS idx_daraz_orders_delivered_by_daraz ON daraz_orders(delivered_by_daraz);
CREATE INDEX IF NOT EXISTS idx_daraz_orders_created_at ON daraz_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_daraz_orders_order_number ON daraz_orders(order_number);

-- Indexes for daraz_order_items table
CREATE INDEX IF NOT EXISTS idx_daraz_order_items_order_id ON daraz_order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_daraz_order_items_product_id ON daraz_order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_daraz_order_items_seller_account ON daraz_order_items(seller_account);
CREATE INDEX IF NOT EXISTS idx_daraz_order_items_purchase_cost ON daraz_order_items(purchase_cost);

-- Indexes for inventory_price_reports_view (based on underlying products table)
CREATE INDEX IF NOT EXISTS idx_products_product_id ON products(id);
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(seller_sku1);

-- 2. Create optimized function for calculating order profit
CREATE OR REPLACE FUNCTION calculate_order_profit(order_id_param UUID)
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
    -- Calculate total revenue for the order
    SELECT COALESCE(SUM(total_amount), 0)
    INTO total_revenue
    FROM daraz_order_items
    WHERE order_id = order_id_param;

    -- Calculate total purchase cost for the order
    SELECT COALESCE(
        SUM(
            doi.quantity * 
            CASE 
                WHEN doi.purchase_cost IS NOT NULL AND doi.purchase_cost > 0 THEN doi.purchase_cost
                ELSE COALESCE(ipr.last_price, ipr.est_price, 0)
            END
        ), 0)
    INTO total_cost
    FROM daraz_order_items doi
    LEFT JOIN inventory_price_reports_view ipr ON doi.product_id = ipr.product_id
    WHERE doi.order_id = order_id_param;

    -- Calculate profit
    calculated_profit := total_revenue - total_cost - COALESCE((SELECT daraz_fees FROM daraz_orders WHERE id = order_id_param), 0) - 30;

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

-- 3. Create function for getting daily profit stats (moved from client-side calculation)
CREATE OR REPLACE FUNCTION get_daily_profit_stats(
    search_term TEXT DEFAULT '',
    sync_status_param TEXT DEFAULT 'all',
    start_date_param DATE DEFAULT NULL,
    end_date_param DATE DEFAULT NULL
)
RETURNS TABLE(
    date TEXT,
    seller TEXT,
    profit NUMERIC,
    revenue NUMERIC,
    cost NUMERIC,
    missing INTEGER
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    WITH order_data AS (
        SELECT 
            o.id,
            o.order_number,
            COALESCE(o.delivered_by_daraz, o.delivered_at) AS delivery_date,
            (SELECT seller_account FROM daraz_order_items WHERE order_id = o.id LIMIT 1) AS seller_account,
            o.daraz_fees,
            (SELECT SUM(total_amount) FROM daraz_order_items WHERE order_id = o.id) AS total_revenue,
            (
                SELECT SUM(
                    doi.quantity * 
                    CASE 
                        WHEN doi.purchase_cost IS NOT NULL AND doi.purchase_cost > 0 THEN doi.purchase_cost
                        ELSE COALESCE(ipr.last_price, ipr.est_price, 0)
                    END
                )
                FROM daraz_order_items doi
                LEFT JOIN inventory_price_reports_view ipr ON doi.product_id = ipr.product_id
                WHERE doi.order_id = o.id
            ) AS total_purchase_cost
        FROM daraz_orders o
        WHERE o.order_status = 'Delivered'
        AND (search_term = '' OR 
             o.order_number ILIKE '%' || search_term || '%' OR
             o.tracking_number ILIKE '%' || search_term || '%' OR
             o.customer_name ILIKE '%' || search_term || '%')
        AND (sync_status_param = 'all' OR 
             (sync_status_param = 'synced' AND o.daraz_fees IS NOT NULL) OR
             (sync_status_param = 'not_synced' AND o.daraz_fees IS NULL))
        AND (start_date_param IS NULL OR COALESCE(o.delivered_by_daraz, o.delivered_at)::DATE >= start_date_param)
        AND (end_date_param IS NULL OR COALESCE(o.delivered_by_daraz, o.delivered_at)::DATE <= end_date_param)
    ),
    daily_calculations AS (
        SELECT 
            TO_CHAR(COALESCE(od.delivery_date, NOW())::DATE, 'YYYY-MM-DD') AS date_str,
            COALESCE(od.seller_account, 'Unknown') AS seller,
            (od.total_revenue - COALESCE(od.total_purchase_cost, 0) - COALESCE(od.daraz_fees, 0) - 30) AS profit,
            od.total_revenue AS revenue,
            COALESCE(od.total_purchase_cost, 0) AS cost,
            CASE 
                WHEN od.total_purchase_cost IS NULL OR od.total_purchase_cost = 0 THEN 1
                ELSE 0
            END AS missing_cost
        FROM order_data od
    )
    SELECT 
        dc.date_str,
        dc.seller,
        SUM(dc.profit) AS profit,
        SUM(dc.revenue) AS revenue,
        SUM(dc.cost) AS cost,
        SUM(dc.missing_cost) AS missing
    FROM daily_calculations dc
    GROUP BY dc.date_str, dc.seller
    ORDER BY dc.date_str DESC, dc.seller;
END;
$$;

-- 4. Create optimized view for daraz order reports with improved performance
DROP VIEW IF EXISTS daraz_order_report_view;

CREATE OR REPLACE VIEW daraz_order_report_view AS
SELECT 
    o.id as order_primary_id,
    o.order_number,
    o.invoice_number,
    o.order_status,
    o.delivered_at,
    o.delivered_by_daraz,
    COALESCE(o.delivered_by_daraz, o.delivered_at) as delivery_date,
    o.created_at,
    o.daraz_fees,
    
    (SELECT seller_account FROM daraz_order_items 
     WHERE order_id = o.id 
     LIMIT 1) as seller_account,

    (
        SELECT jsonb_agg(
            jsonb_build_object(
                'product_name', doi.product_name,
                'quantity', doi.quantity,
                'purchase_cost', (
                    CASE 
                        WHEN doi.purchase_cost IS NOT NULL AND doi.purchase_cost > 0 THEN doi.purchase_cost
                        ELSE COALESCE(ipr.last_price, ipr.est_price, 0)
                    END
                ),
                'amount', doi.total_amount
            )
        )
        FROM daraz_order_items doi
        LEFT JOIN inventory_price_reports_view ipr ON doi.product_id = ipr.product_id
        WHERE doi.order_id = o.id
    ) as items_summary,

    (SELECT SUM(total_amount) FROM daraz_order_items WHERE order_id = o.id) as total_revenue,
    
    (
        SELECT SUM(
            doi.quantity * 
            CASE 
                WHEN doi.purchase_cost IS NOT NULL AND doi.purchase_cost > 0 THEN doi.purchase_cost
                ELSE COALESCE(ipr.last_price, ipr.est_price, 0)
            END
        )
        FROM daraz_order_items doi
        LEFT JOIN inventory_price_reports_view ipr ON doi.product_id = ipr.product_id
        WHERE doi.order_id = o.id
    ) as total_purchase_cost,

    -- Optimized profit calculation using the new function approach
    (
        SELECT (total_amount - COALESCE(total_cost, 0) - COALESCE(o.daraz_fees, 0) - 30)
        FROM (
            SELECT 
                (SELECT SUM(total_amount) FROM daraz_order_items WHERE order_id = o.id) as total_amount,
                (
                    SELECT SUM(
                        doi.quantity * 
                        CASE 
                            WHEN doi.purchase_cost IS NOT NULL AND doi.purchase_cost > 0 THEN doi.purchase_cost
                            ELSE COALESCE(ipr.last_price, ipr.est_price, 0)
                        END
                    )
                    FROM daraz_order_items doi
                    LEFT JOIN inventory_price_reports_view ipr ON doi.product_id = ipr.product_id
                    WHERE doi.order_id = o.id
                ) as total_cost
        ) calc
    ) as estimated_profit,

    -- Add profit percentage
    (
        SELECT 
        CASE 
            WHEN calc.total_amount > 0 THEN 
                ROUND(((calc.total_amount - COALESCE(calc.total_cost, 0) - COALESCE(o.daraz_fees, 0) - 30) / calc.total_amount) * 100, 2)
            ELSE 0
        END
        FROM (
            SELECT 
                (SELECT SUM(total_amount) FROM daraz_order_items WHERE order_id = o.id) as total_amount,
                (
                    SELECT SUM(
                        doi.quantity * 
                        CASE 
                            WHEN doi.purchase_cost IS NOT NULL AND doi.purchase_cost > 0 THEN doi.purchase_cost
                            ELSE COALESCE(ipr.last_price, ipr.est_price, 0)
                        END
                    )
                    FROM daraz_order_items doi
                    LEFT JOIN inventory_price_reports_view ipr ON doi.product_id = ipr.product_id
                    WHERE doi.order_id = o.id
                ) as total_cost
        ) calc
    ) as profit_percentage

FROM daraz_orders o
WHERE o.order_status = 'Delivered';

-- Grant permissions
GRANT SELECT ON daraz_order_report_view TO authenticated;

-- 5. Create materialized view for frequently accessed aggregated data (for caching)
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_profit_summary_cache AS
SELECT 
    TO_CHAR(COALESCE(o.delivered_by_daraz, o.delivered_at)::DATE, 'YYYY-MM-DD') AS date_str,
    COALESCE(
        (SELECT seller_account FROM daraz_order_items WHERE order_id = o.id LIMIT 1), 
        'Unknown'
    ) AS seller,
    COUNT(*) AS order_count,
    SUM(
        (SELECT COALESCE(SUM(total_amount), 0) FROM daraz_order_items WHERE order_id = o.id)
    ) AS total_revenue,
    SUM(
        COALESCE((
            SELECT SUM(
                doi.quantity * 
                CASE 
                    WHEN doi.purchase_cost IS NOT NULL AND doi.purchase_cost > 0 THEN doi.purchase_cost
                    ELSE COALESCE(ipr.last_price, ipr.est_price, 0)
                END
            )
            FROM daraz_order_items doi
            LEFT JOIN inventory_price_reports_view ipr ON doi.product_id = ipr.product_id
            WHERE doi.order_id = o.id
        ), 0)
    ) AS total_cost,
    SUM(
        (SELECT COALESCE(SUM(total_amount), 0) FROM daraz_order_items WHERE order_id = o.id) - 
        COALESCE((
            SELECT SUM(
                doi.quantity * 
                CASE 
                    WHEN doi.purchase_cost IS NOT NULL AND doi.purchase_cost > 0 THEN doi.purchase_cost
                    ELSE COALESCE(ipr.last_price, ipr.est_price, 0)
                END
            )
            FROM daraz_order_items doi
            LEFT JOIN inventory_price_reports_view ipr ON doi.product_id = ipr.product_id
            WHERE doi.order_id = o.id
        ), 0) - 
        COALESCE(o.daraz_fees, 0) - 30
    ) AS total_profit
FROM daraz_orders o
LEFT JOIN daraz_order_items doi ON doi.order_id = o.id
LEFT JOIN inventory_price_reports_view ipr ON doi.product_id = ipr.product_id
WHERE o.order_status = 'Delivered'
  AND o.delivered_by_daraz IS NOT NULL
GROUP BY date_str, seller
ORDER BY date_str DESC, seller;

-- Create index on the materialized view for faster lookups
CREATE INDEX IF NOT EXISTS idx_daily_profit_summary_date_seller ON daily_profit_summary_cache(date_str, seller);

-- Refresh the materialized view
REFRESH MATERIALIZED VIEW daily_profit_summary_cache;

-- Grant permissions on materialized view
GRANT SELECT ON daily_profit_summary_cache TO authenticated;

-- 6. Create function to refresh the cache when needed
CREATE OR REPLACE FUNCTION refresh_daily_profit_cache()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    REFRESH MATERIALIZED VIEW daily_profit_summary_cache;
END;
$$;

-- 7. Add comments to document the new functions and views
COMMENT ON FUNCTION calculate_order_profit(UUID) IS 'Function to calculate profit for a specific order, including revenue, cost, profit, and profit percentage';
COMMENT ON FUNCTION get_daily_profit_stats(TEXT, TEXT, DATE, DATE) IS 'Function to get daily profit statistics with filtering options';
COMMENT ON MATERIALIZED VIEW daily_profit_summary_cache IS 'Materialized view for caching daily profit summary data to improve query performance';
COMMENT ON FUNCTION refresh_daily_profit_cache() IS 'Function to manually refresh the daily profit cache materialized view';