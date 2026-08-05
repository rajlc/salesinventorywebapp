-- Add item_status column to daraz_order_items to support partial returns
ALTER TABLE daraz_order_items ADD COLUMN IF NOT EXISTS item_status TEXT;

-- Create an index on item_status for faster filtering in ledger queries
CREATE INDEX IF NOT EXISTS idx_daraz_order_items_status ON daraz_order_items(item_status);
