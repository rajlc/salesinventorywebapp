# Daraz Sync Setup Guide

## 1. Database Setup (Critical)
You encountered a `Database Error: Could not find the table 'public.daraz_api_tokens'`.
This means the database table to store your login tokens hasn't been created yet.

**Action:**
Run the SQL file in your Supabase SQL Editor:
`Database/migrations/20251221_create_daraz_api_tokens.sql`

## 2. Ngrok Setup (Localhost to HTTPS)
Daraz requires an HTTPS URL for the "Callback URL". We use `ngrok` to create a secure tunnel to your local computer (localhost:3000).

**How to Start Ngrok:**
1.  Open a terminal/command prompt.
2.  Run: `ngrok http 3000`
3.  Copy the "Forwarding" URL (e.g., `https://abcd-1234.ngrok-free.dev`).

**Updating Configuration:**
Every time you restart ngrok, the URL changes. You must update it in two places:
1.  **Your App (.env.local):**
    Update `NEXT_PUBLIC_APP_URL=https://your-new-url.ngrok-free.dev`
2.  **Daraz Seller Center (App Settings):**
    Update the "Callback URL" to `https://your-new-url.ngrok-free.dev/api/daraz/auth/callback`

*Note: In your previous message, you saw a successful Auth URL generation because the environment variable was set correctly. The 500 Error was only due to the missing database table.*
