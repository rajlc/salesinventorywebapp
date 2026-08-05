-- Alter products table default value of website_sync_status to 'Pending'
ALTER TABLE public.products ALTER COLUMN website_sync_status SET DEFAULT 'Pending';
