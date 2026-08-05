-- Add caching functions and optimizations for the inventory app

-- Function to get cached daily profit summary with built-in caching mechanism
CREATE OR REPLACE FUNCTION get_cached_daily_profit_summary(
    search_term TEXT DEFAULT '',
    sync_status_param TEXT DEFAULT 'all',
    start_date_param DATE DEFAULT NULL,
    end_date_param DATE DEFAULT NULL,
    seller_account_param TEXT DEFAULT NULL
)
RETURNS TABLE(
    date TEXT,
    seller TEXT,
    order_count BIGINT,
    total_revenue NUMERIC,
    total_cost NUMERIC,
    total_profit NUMERIC
)
LANGUAGE plpgsql
STABLE
PARALLEL SAFE
AS $$
BEGIN
    -- Try to use the materialized view for better performance
    RETURN QUERY
    SELECT 
        dps.date_str,
        dps.seller,
        dps.order_count,
        dps.total_revenue,
        dps.total_cost,
        dps.total_profit
    FROM daily_profit_summary_cache dps
    WHERE (start_date_param IS NULL OR dps.date_str >= start_date_param::TEXT)
      AND (end_date_param IS NULL OR dps.date_str <= end_date_param::TEXT)
      AND (seller_account_param IS NULL OR dps.seller = seller_account_param)
      AND (search_term = '' OR 
           dps.seller ILIKE '%' || search_term || '%')
    ORDER BY dps.date_str DESC, dps.seller;
END;
$$;
-- Create a function to refresh the materialized view periodically
CREATE OR REPLACE FUNCTION refresh_cache_if_needed()
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    last_refresh TIMESTAMP WITH TIME ZONE;
    cache_age INTERVAL;
BEGIN
    -- Check if we have a record of the last refresh
    -- For now, we'll just refresh the materialized view
    -- In a production environment, you'd want to track the last refresh time
    REFRESH MATERIALIZED VIEW CONCURRENTLY daily_profit_summary_cache;
END;
$$;
-- Create a trigger function to invalidate/update cache when daraz orders change
CREATE OR REPLACE FUNCTION update_profit_cache_on_order_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Refresh the cache asynchronously (doesn't block the transaction)
    -- In a real implementation, you might queue this for later processing
    -- For now, we'll just schedule a refresh by marking the cache as stale
    -- This would typically be handled by an external job scheduler
    
    -- Option 1: Mark cache as stale (you'd need a cache metadata table)
    -- INSERT INTO cache_metadata (cache_name, is_stale, updated_at) 
    -- VALUES ('daily_profit_summary_cache', TRUE, NOW()) 
    -- ON CONFLICT (cache_name) DO UPDATE SET is_stale = TRUE, updated_at = NOW();
    
    -- Option 2: Schedule refresh via a job queue table (simpler approach)
    -- INSERT INTO cache_refresh_queue (cache_name, scheduled_at) 
    -- VALUES ('daily_profit_summary_cache', NOW() + INTERVAL '5 minutes');
    
    -- For now, we'll just return
    RETURN COALESCE(NEW, OLD);
END;
$$;
-- Create triggers to update cache on daraz orders changes
DROP TRIGGER IF EXISTS refresh_profit_cache_after_insert ON daraz_orders;
DROP TRIGGER IF EXISTS refresh_profit_cache_after_update ON daraz_orders;
DROP TRIGGER IF EXISTS refresh_profit_cache_after_delete ON daraz_orders;
CREATE TRIGGER refresh_profit_cache_after_insert
    AFTER INSERT ON daraz_orders
    FOR EACH STATEMENT
    EXECUTE FUNCTION update_profit_cache_on_order_change();
CREATE TRIGGER refresh_profit_cache_after_update  
    AFTER UPDATE ON daraz_orders
    FOR EACH STATEMENT
    EXECUTE FUNCTION update_profit_cache_on_order_change();
CREATE TRIGGER refresh_profit_cache_after_delete
    AFTER DELETE ON daraz_orders
    FOR EACH STATEMENT
    EXECUTE FUNCTION update_profit_cache_on_order_change();
-- Create function for optimized order profit calculation with caching considerations
CREATE OR REPLACE FUNCTION get_optimized_order_report(
    page_param INTEGER DEFAULT 1,
    limit_param INTEGER DEFAULT 50,
    search_term TEXT DEFAULT '',
    start_date_param DATE DEFAULT NULL,
    end_date_param DATE DEFAULT NULL,
    sync_status_param TEXT DEFAULT 'all',
    seller_account_param TEXT DEFAULT NULL
)
RETURNS TABLE(
    order_primary_id UUID,
    order_number TEXT,
    invoice_number TEXT,
    order_status TEXT,
    delivered_at TIMESTAMPTZ,
    delivered_by_daraz TIMESTAMPTZ,
    created_at TIMESTAMPTZ,
    seller_account TEXT,
    total_revenue NUMERIC,
    total_purchase_cost NUMERIC,
    estimated_profit NUMERIC,
    profit_percentage NUMERIC,
    sync_status TEXT
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    offset_param INTEGER;
BEGIN
    offset_param := (page_param - 1) * limit_param;
    
    RETURN QUERY
    SELECT 
        r.order_primary_id,
        r.order_number,
        r.invoice_number,
        r.order_status,
        r.delivered_at,
        r.delivered_by_daraz,
        r.created_at,
        r.seller_account,
        r.total_revenue,
        r.total_purchase_cost,
        r.estimated_profit,
        r.profit_percentage,
        CASE 
            WHEN r.daraz_fees IS NOT NULL AND r.estimated_profit IS NOT NULL 
            THEN 'synced' 
            ELSE 'not_synced' 
        END AS sync_status
    FROM daraz_order_report_view r
    WHERE (search_term = '' OR 
           r.order_number ILIKE '%' || search_term || '%' OR
           COALESCE(r.invoice_number, '') ILIKE '%' || search_term || '%')
      AND (start_date_param IS NULL OR 
           COALESCE(r.delivered_by_daraz, r.delivered_at)::DATE >= start_date_param)
      AND (end_date_param IS NULL OR 
           COALESCE(r.delivered_by_daraz, r.delivered_at)::DATE <= end_date_param)
      AND (seller_account_param IS NULL OR r.seller_account = seller_account_param)
      AND r.order_status IN ('Delivered', 'Customer Return Delivered')
      AND (sync_status_param = 'all' OR 
           (sync_status_param = 'synced' AND r.daraz_fees IS NOT NULL AND r.estimated_profit IS NOT NULL) OR
           (sync_status_param = 'not_synced' AND (r.daraz_fees IS NULL OR r.estimated_profit IS NULL)))
    ORDER BY 
        COALESCE(r.delivered_by_daraz, r.delivered_at) DESC NULLS LAST,
        r.delivered_at DESC NULLS LAST,
        r.created_at DESC
    OFFSET offset_param
    LIMIT limit_param;
END;
$$;
-- Create function to get optimized order count for pagination
CREATE OR REPLACE FUNCTION get_order_report_count(
    search_term TEXT DEFAULT '',
    start_date_param DATE DEFAULT NULL,
    end_date_param DATE DEFAULT NULL,
    sync_status_param TEXT DEFAULT 'all',
    seller_account_param TEXT DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    count_result BIGINT;
BEGIN
    SELECT COUNT(*)
    INTO count_result
    FROM daraz_order_report_view r
    WHERE (search_term = '' OR 
           r.order_number ILIKE '%' || search_term || '%' OR
           COALESCE(r.invoice_number, '') ILIKE '%' || search_term || '%')
      AND (start_date_param IS NULL OR 
           COALESCE(r.delivered_by_daraz, r.delivered_at)::DATE >= start_date_param)
      AND (end_date_param IS NULL OR 
           COALESCE(r.delivered_by_daraz, r.delivered_at)::DATE <= end_date_param)
      AND (seller_account_param IS NULL OR r.seller_account = seller_account_param)
      AND r.order_status IN ('Delivered', 'Customer Return Delivered')
      AND (sync_status_param = 'all' OR 
           (sync_status_param = 'synced' AND r.daraz_fees IS NOT NULL AND r.estimated_profit IS NOT NULL) OR
           (sync_status_param = 'not_synced' AND (r.daraz_fees IS NULL OR r.estimated_profit IS NULL)));
           
    RETURN count_result;
END;
$$;
-- Grant permissions on new functions
GRANT EXECUTE ON FUNCTION get_cached_daily_profit_summary(TEXT, TEXT, DATE, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_cache_if_needed() TO authenticated;
GRANT EXECUTE ON FUNCTION get_optimized_order_report(INTEGER, INTEGER, TEXT, DATE, DATE, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_order_report_count(TEXT, DATE, DATE, TEXT, TEXT) TO authenticated;
-- Add comments to document the functions
COMMENT ON FUNCTION get_cached_daily_profit_summary(TEXT, TEXT, DATE, DATE, TEXT) IS 'Function to get daily profit summary with caching for better performance';
COMMENT ON FUNCTION refresh_cache_if_needed() IS 'Function to refresh materialized view cache when needed';
COMMENT ON FUNCTION get_optimized_order_report(INTEGER, INTEGER, TEXT, DATE, DATE, TEXT, TEXT) IS 'Optimized function to get paginated order report data';
COMMENT ON FUNCTION get_order_report_count(TEXT, DATE, DATE, TEXT, TEXT) IS 'Function to get count of orders for pagination';
