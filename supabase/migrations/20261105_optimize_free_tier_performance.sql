-- =============================================================================
-- Supabase Free Tier (Nano) Performance, Disk IO & Login Reliability Optimization
-- =============================================================================

-- 1. Clean up thousands of accumulated AI reply marker rows & stale locks in app_settings
DELETE FROM public.app_settings
WHERE key LIKE 'ai_replied_msg_%'
   OR key LIKE 'ai_reply_lock_%';

-- 2. Composite indexes for Daraz Chat Sessions & Messages (eliminates sequential scans)
CREATE INDEX IF NOT EXISTS idx_daraz_chat_sessions_store_last_msg
    ON public.daraz_chat_sessions (store_id, last_message_time DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_daraz_chat_messages_session_send_time
    ON public.daraz_chat_messages (session_id, send_time DESC);

-- 3. Partial index for Delayed Auto-Messages Cron Queue (zero-cost idle checks)
CREATE INDEX IF NOT EXISTS idx_daraz_delayed_messages_active_status
    ON public.daraz_delayed_messages (status, scheduled_at)
    WHERE status IN ('pending', 'processing');

-- 4. Composite & GIN indexes for Daraz Orders lookup by store, date, and buyer_id
CREATE INDEX IF NOT EXISTS idx_daraz_orders_store_order_date
    ON public.daraz_orders (store_id, order_date DESC)
    WHERE (deleted IS NULL OR deleted = false);

CREATE INDEX IF NOT EXISTS idx_daraz_orders_items_detail_gin
    ON public.daraz_orders USING gin (items_detail jsonb_path_ops);

-- 5. Refresh query planner statistics (runs cleanly inside Supabase SQL Editor transaction block)
ANALYZE public.app_settings;
ANALYZE public.daraz_chat_sessions;
ANALYZE public.daraz_chat_messages;
ANALYZE public.daraz_delayed_messages;
ANALYZE public.daraz_orders;

