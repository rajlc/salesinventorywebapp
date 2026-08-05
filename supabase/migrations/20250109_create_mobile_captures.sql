-- Create table for mobile captures
create table if not exists mobile_captures (
  id uuid default gen_random_uuid() primary key,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  image_path text not null,
  image_url text not null,
  price numeric,
  remarks text,
  group_id uuid, -- To group multiple photos from the same session
  user_id uuid references auth.users(id)
);

-- Enable RLS
alter table mobile_captures enable row level security;

-- Create policy to allow authenticated users to view all captures (or restrict as needed)
create policy "Enable read access for authenticated users" on mobile_captures
  for select using (auth.role() = 'authenticated');

create policy "Enable insert access for authenticated users" on mobile_captures
  for insert with check (auth.role() = 'authenticated');

-- Storage Bucket Setup (This usually needs to be done via dashboard, but providing SQL just in case)
-- insert into storage.buckets (id, name, public) values ('mobile-captures', 'mobile-captures', true);

-- Storage Policies
-- create policy "Give authenticated users access to mobile-captures bucket" on storage.objects
--   for all using (bucket_id = 'mobile-captures' and auth.role() = 'authenticated');
