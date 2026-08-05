-- Update the select policy to allow ANYONE (including Next.js server) to view files in the 'mobile-captures' bucket
-- First, drop the old restrictive policy if it exists (or we can just create a new broader one, but cleaner to replace)

drop policy if exists "Authenticated users can view mobile captures" on storage.objects;

create policy "Public can view mobile captures"
on storage.objects for select
using (
  bucket_id = 'mobile-captures'
);
