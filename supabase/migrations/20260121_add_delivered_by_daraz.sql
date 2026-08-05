-- Add delivered_by_daraz column to track Daraz's official delivery timestamp
ALTER TABLE daraz_orders 
ADD COLUMN delivered_by_daraz TIMESTAMP WITH TIME ZONE;

-- Add comment explaining the column
COMMENT ON COLUMN daraz_orders.delivered_by_daraz IS 'Official delivery timestamp from Daraz platform, captured during order sync';
