-- Migration to link marketplace_orders.delivery_branch_id to courier_locations(id)

-- 1. Drop existing Foreign Key constraints (check both potential names)
ALTER TABLE marketplace_orders 
DROP CONSTRAINT IF EXISTS marketplace_orders_delivery_branch_id_fkey;

ALTER TABLE marketplace_orders 
DROP CONSTRAINT IF EXISTS fk_marketplace_delivery_branch;

-- Drop the accidentally created duplicate constraint
ALTER TABLE marketplace_orders 
DROP CONSTRAINT IF EXISTS marketplace_orders_delivery_branch_id_courier_locations_fkey;

-- Drop the correct constraint if it exists (to allow re-running this script without error)
ALTER TABLE marketplace_orders 
DROP CONSTRAINT IF EXISTS fk_marketplace_courier_branch;

-- 2. Clear existing delivery_branch_id values because IDs from delivery_locations won't match courier_locations IDs
-- This prevents the ADD CONSTRAINT from failing due to "insert or update on table violates foreign key constraint"
UPDATE marketplace_orders 
SET delivery_branch_id = NULL 
WHERE delivery_branch_id IS NOT NULL;

-- 3. Add new Foreign Key constraint referencing courier_locations
ALTER TABLE marketplace_orders
ADD CONSTRAINT fk_marketplace_courier_branch
FOREIGN KEY (delivery_branch_id)
REFERENCES courier_locations(id);

