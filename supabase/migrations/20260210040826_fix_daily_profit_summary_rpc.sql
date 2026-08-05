CREATE OR REPLACE FUNCTION get_cached_daily_profit_summary(
    search_term TEXT DEFAULT '',
    sync_status_param TEXT DEFAULT 'all',
    start_date_param TEXT DEFAULT NULL,
    end_date_param TEXT DEFAULT NULL,
    seller_account_param TEXT DEFAULT NULL
) 
RETURNS TABLE (
    "date" TEXT,
    seller TEXT,
    order_count BIGINT,
    revenue NUMERIC,
    cost NUMERIC,
    profit NUMERIC,
    missing BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dps.date_str::TEXT as "date",
        dps.seller::TEXT as seller,
        dps.order_count::BIGINT as order_count,
        dps.total_revenue::NUMERIC as revenue,
        dps.total_cost::NUMERIC as cost,
        dps.total_profit::NUMERIC as profit,
        0::BIGINT as missing -- Materialized view doesn't have missing count yet
    FROM daily_profit_summary_cache dps
    WHERE (start_date_param IS NULL OR dps.date_str >= start_date_param)
      AND (end_date_param IS NULL OR dps.date_str <= end_date_param)
      AND (seller_account_param IS NULL OR dps.seller = seller_account_param)
      AND (search_term = '' OR dps.seller ILIKE '%' || search_term || '%')
    ORDER BY dps.date_str DESC, dps.seller;
END;
$$ LANGUAGE plpgsql;;
