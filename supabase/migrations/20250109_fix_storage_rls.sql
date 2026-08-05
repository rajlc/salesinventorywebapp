-- Allow authenticated users to upload files to the 'mobile-captures' bucket
create policy "Authenticated users can upload mobile captures"
on storage.objects for insert
with check (
  bucket_id = 'mobile-captures' 
  and auth.role() = 'authenticated'
);

-- Allow authenticated users to view files in the 'mobile-captures' bucket
create policy "Authenticated users can view mobile captures"
on storage.objects for select
using (
  bucket_id = 'mobile-captures' 
  and auth.role() = 'authenticated'
);

-- Allow authenticated users to update their own files (optional, but good practice)
create policy "Authenticated users can update their own mobile captures"
on storage.objects for update
using (
  bucket_id = 'mobile-captures' 
  and auth.uid() = owner
);

-- Allow authenticated users to delete their own files
create policy "Authenticated users can delete their own mobile captures"
on storage.objects for delete
using (
  bucket_id = 'mobile-captures' 
  and auth.uid() = owner
);
