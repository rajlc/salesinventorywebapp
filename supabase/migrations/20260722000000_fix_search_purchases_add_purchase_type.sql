-- Create a function to search purchases across product and supplier names
-- Run this in your Supabase SQL Editor

-- Drop the old function if it exists
DROP FUNCTION IF EXISTS search_purchases(text,uuid,date,date,uuid,boolean,integer,integer);

-- Create the new function

CREATE OR REPLACE FUNCTION search_purchases(
    search_term TEXT DEFAULT NULL,
    supplier_filter UUID DEFAULT NULL,
    start_date_filter DATE DEFAULT NULL,
    end_date_filter DATE DEFAULT NULL,
    fiscal_year_filter UUID DEFAULT NULL,
    show_all_flag BOOLEAN DEFAULT FALSE,
    page_number INT DEFAULT 1,
    page_limit INT DEFAULT 50
)
RETURNS TABLE (
    id UUID,
    purchase_date DATE,
    product_id UUID,
    quantity DOUBLE PRECISION,
    unit_amount DOUBLE PRECISION,
    total_amount DOUBLE PRECISION,
    supplier_id UUID,
    payment_type TEXT,
    purchase_type TEXT,
    purchase_name TEXT,
    remarks TEXT,
    created_at TIMESTAMPTZ,
    created_by UUID,
    product_name TEXT,
    supplier_name TEXT,
    total_count BIGINT
) 
LANGUAGE plpgsql
AS $$
DECLARE
    offset_val INT;
    fy_start DATE;
    fy_end DATE;
BEGIN
    offset_val := (page_number - 1) * page_limit;
    
    -- Get fiscal year dates if needed
    IF NOT show_all_flag AND fiscal_year_filter IS NOT NULL THEN
        SELECT fy.start_date, fy.end_date INTO fy_start, fy_end
        FROM fiscal_years fy
        WHERE fy.id = fiscal_year_filter;
    ELSIF NOT show_all_flag AND start_date_filter IS NULL AND end_date_filter IS NULL THEN
        SELECT fy.start_date, fy.end_date INTO fy_start, fy_end
        FROM fiscal_years fy
        WHERE fy.is_active = TRUE
        LIMIT 1;
    END IF;
    
    RETURN QUERY
    WITH filtered_purchases AS (
        SELECT 
            p.id,
            p.purchase_date,
            p.product_id,
            p.quantity::DOUBLE PRECISION,
            p.unit_amount::DOUBLE PRECISION,
            p.total_amount::DOUBLE PRECISION,
            p.supplier_id,
            p.payment_type,
            p.purchase_type,
            p.purchase_name,
            p.remarks,
            p.created_at,
            p.created_by,
            pr.product_name,
            s.supplier_name,
            COUNT(*) OVER() as total_count
        FROM purchases p
        LEFT JOIN products pr ON p.product_id = pr.id
        LEFT JOIN suppliers s ON p.supplier_id = s.id
        WHERE 
            -- Fiscal year filter
            (show_all_flag OR 
             (fy_start IS NOT NULL AND p.purchase_date >= fy_start AND p.purchase_date <= fy_end) OR
             (start_date_filter IS NOT NULL AND p.purchase_date >= start_date_filter) OR
             (end_date_filter IS NOT NULL AND p.purchase_date <= end_date_filter))
            -- Date range filters
            AND (start_date_filter IS NULL OR p.purchase_date >= start_date_filter)
            AND (end_date_filter IS NULL OR p.purchase_date <= end_date_filter)
            -- Supplier filter
            AND (supplier_filter IS NULL OR p.supplier_id = supplier_filter)
            -- Search filter (product name, supplier name, or remarks)
            AND (
                search_term IS NULL OR
                search_term = '' OR
                pr.product_name ILIKE '%' || search_term || '%' OR
                s.supplier_name ILIKE '%' || search_term || '%' OR
                p.remarks ILIKE '%' || search_term || '%'
            )
        ORDER BY p.purchase_date DESC, p.created_at DESC
        LIMIT page_limit
        OFFSET offset_val
    )
    SELECT 
        fp.id,
        fp.purchase_date,
        fp.product_id,
        fp.quantity,
        fp.unit_amount,
        fp.total_amount,
        fp.supplier_id,
        fp.payment_type,
        fp.purchase_type,
        fp.purchase_name,
        fp.remarks,
        fp.created_at,
        fp.created_by,
        fp.product_name,
        fp.supplier_name,
        fp.total_count
    FROM filtered_purchases fp;
END;
$$;
