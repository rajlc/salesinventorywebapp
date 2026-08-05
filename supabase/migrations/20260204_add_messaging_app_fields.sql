-- Add fields for messaging app integration
ALTER TABLE marketplace_orders 
ADD COLUMN IF NOT EXISTS alternative_phone TEXT;

ALTER TABLE marketplace_orders 
ADD COLUMN IF NOT EXISTS delivery_branch TEXT;

-- Add index for performance on new columns
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_alternative_phone ON marketplace_orders(alternative_phone);
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_delivery_branch ON marketplace_orders(delivery_branch);