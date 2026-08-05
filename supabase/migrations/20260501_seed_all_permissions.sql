-- Seed all permissions into page_roles table
-- Uses upsert to avoid duplicates if run multiple times
-- First ensure page_url column exists
ALTER TABLE page_roles ADD COLUMN IF NOT EXISTS page_url TEXT;

-- Clear existing incomplete data and reseed completely
DELETE FROM page_roles;

-- Reset sequence if exists
-- (page_roles likely uses UUID, so no sequence to reset)

-- Insert ALL permissions
INSERT INTO page_roles (main_role, sub_role, page_url) VALUES
  -- Inventory
  ('Inventory', 'Inventory List',     '/dashboard/inventory/product-list'),
  ('Inventory', 'Stock Adjustment',   '/dashboard/inventory/stock-adjustment'),
  ('Inventory', 'Stock Ledger',       '/dashboard/inventory/stock-ledger'),
  ('Inventory', 'Stock Valuation',    '/dashboard/inventory/stock-ledger'),
  ('Inventory', 'Damaged Goods',      '/dashboard/inventory/damaged-stocks'),
  ('Inventory', 'Wholesale Price',    '/dashboard/inventory/wholesale-price'),
  ('Inventory', 'Field Data Entry',   '/dashboard/mobile-uploads'),

  -- Daraz
  ('Daraz', 'Order Entry',            '/dashboard/sales/daraz/sales-entry'),
  ('Daraz', 'Order List',             '/dashboard/sales/daraz/dashboard'),
  ('Daraz', 'Daily Sales Report',     '/dashboard/sales/daraz/dashboard'),
  ('Daraz', 'Account Summary',        '/dashboard/sales/daraz/dashboard'),
  ('Daraz', 'Order Status Sync',      '/dashboard/sales/daraz/dashboard'),
  ('Daraz', 'Order Sync',             '/dashboard/sales/daraz/dashboard'),
  ('Daraz', 'Profit Tracker',         '/dashboard/sales/daraz/dashboard'),
  ('Daraz', 'Sales Report',           '/dashboard/sales/daraz/dashboard'),
  ('Daraz', 'Update Order Status',    '/dashboard/sales/daraz/update-status'),
  ('Daraz', 'Average Sales Price',    '/dashboard/sales/daraz/average-sales-price'),


  -- Store Sales
  ('Store Sales', 'Store Post',        '/dashboard/sales/store-sales'),

  -- Sales Analytics
  ('Sales Analytics', 'Sales Analytics', '/dashboard/sales/analytics'),

  -- Purchase
  ('Purchase', 'Purchase Entry',       '/dashboard/purchase/purchase-entry'),
  ('Purchase', 'All Purchase List',    '/dashboard/purchase/dashboard'),
  ('Purchase', 'Daily Report',         '/dashboard/purchase/dashboard'),
  ('Purchase', 'Purchase List',        '/dashboard/purchase/dashboard'),
  ('Purchase', 'Buy/sell (Suppliers)', '/dashboard/purchase/dashboard'),
  ('Purchase', 'Purchase Reports',     '/dashboard/purchase/dashboard'),
  ('Purchase', 'Inventory Reports',    '/dashboard/purchase/inventory-price-reports'),

  -- Suppliers
  ('Suppliers', 'Supplier List',        '/dashboard/suppliers'),
  ('Suppliers', 'Suppliers Transaction','/dashboard/suppliers'),
  ('Suppliers', 'Suppliers Ledger',     '/dashboard/suppliers'),

  -- Finance
  ('Finance', 'Finance',               '/dashboard/account'),

  -- Settings
  ('Settings', 'Stores Management',    '/dashboard/settings/stores'),
  ('Settings', 'Fiscal Years',         '/dashboard/settings/fiscal-years'),
  ('Settings', 'Logistics Management', '/dashboard/settings/logistics-api'),
  ('Settings', 'Approval Center',      '/dashboard/settings/approvals'),
  ('Settings', 'Restore Backup',       '/dashboard/settings/backup'),
  ('Settings', 'Staff Management',     '/dashboard/staff-management'),
  ('Settings', 'Role Management',      '/dashboard/settings/roles'),
  ('Settings', 'Sync Settings',        '/dashboard/settings/sync-settings');
