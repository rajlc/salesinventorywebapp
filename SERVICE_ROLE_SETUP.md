# Add Service Role Key to Environment Variables

You need to add your Supabase **Service Role Key** to your `.env.local` file.

## Steps:

1. **Get your Service Role Key from Supabase:**
   - Go to https://supabase.com/dashboard
   - Select your project
   - Go to **Settings** → **API**
   - Copy the **`service_role` secret key** (NOT the anon key!)

2. **Add to `.env.local`:**
   Open `inventory-app/web/.env.local` and add:
   ```
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   ```

3. **Restart your dev server:**
   - Stop the server (Ctrl+C)
   - Run `npm run dev` again

4. **Try Staff Management again** - it should work now!

⚠️ **IMPORTANT**: The service role key bypasses RLS, so NEVER expose it to the client side. Only use it in server actions.
