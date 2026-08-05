-- Add courier_id column to marketplace_orders table
ALTER TABLE marketplace_orders 
ADD COLUMN IF NOT EXISTS courier_id UUID REFERENCES couriers(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_marketplace_orders_courier_id ON marketplace_orders(courier_id);
