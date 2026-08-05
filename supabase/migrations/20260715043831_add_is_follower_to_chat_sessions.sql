-- ============================================================
-- Migration: Add is_follower flag to daraz_chat_sessions
-- Purpose : Persist buyer follower status so it survives
--           message retention cleanup (7-day delete policy).
-- ============================================================

ALTER TABLE public.daraz_chat_sessions
    ADD COLUMN IF NOT EXISTS is_follower BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS followed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.daraz_chat_sessions.is_follower IS
    'TRUE when Daraz has confirmed this buyer followed the store. Persisted here so follower badge survives message retention cleanup.';

COMMENT ON COLUMN public.daraz_chat_sessions.followed_at IS
    'Timestamp when the buyer follow confirmation was first detected in chat.';
