-- Add marketplace_sync_status, website_sync_status, and approval_status to the products table
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS marketplace_sync_status TEXT DEFAULT 'Done',
ADD COLUMN IF NOT EXISTS website_sync_status TEXT DEFAULT 'Done',
ADD COLUMN IF NOT EXISTS approval_status TEXT DEFAULT 'Approved',
ADD COLUMN IF NOT EXISTS daraz_product_url TEXT;

-- Add check constraints to enforce allowed values
ALTER TABLE products
DROP CONSTRAINT IF EXISTS chk_marketplace_sync_status,
DROP CONSTRAINT IF EXISTS chk_website_sync_status,
DROP CONSTRAINT IF EXISTS chk_approval_status;

ALTER TABLE products
ADD CONSTRAINT chk_marketplace_sync_status CHECK (marketplace_sync_status IN ('Pending', 'Done')),
ADD CONSTRAINT chk_website_sync_status CHECK (website_sync_status IN ('Pending', 'Done')),
ADD CONSTRAINT chk_approval_status CHECK (approval_status IN ('Pending', 'Approved'));

-- Mark existing records as 'Done' and 'Approved'
UPDATE products 
SET marketplace_sync_status = 'Done' 
WHERE marketplace_sync_status IS NULL;

UPDATE products 
SET website_sync_status = 'Done' 
WHERE website_sync_status IS NULL;

UPDATE products 
SET approval_status = 'Approved' 
WHERE approval_status IS NULL;
