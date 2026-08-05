-- ============================================================
-- Migration: Create Daraz Chat & AI Tables
-- Purpose : Support messaging, AI auto-replies, and message queues.
-- ============================================================

-- 1. Chat Settings Table (One config per online store)
CREATE TABLE IF NOT EXISTS public.daraz_chat_settings (
    store_id                 UUID        PRIMARY KEY REFERENCES public.online_stores(id) ON DELETE CASCADE,
    messaging_enabled        BOOLEAN     NOT NULL DEFAULT TRUE,
    ai_enabled               BOOLEAN     NOT NULL DEFAULT FALSE,
    auto_reply_on_new_order  BOOLEAN     NOT NULL DEFAULT FALSE,
    new_order_template       TEXT        NOT NULL DEFAULT 'Thank you for your order! We have received it and are preparing it. Please click below to follow our store for the latest updates!',
    new_order_delay_minutes  INT         NOT NULL DEFAULT 1 CHECK (new_order_delay_minutes >= 0),
    app_url                  TEXT,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Chat Templates / Rules (Exact Match and Keyword Match)
CREATE TABLE IF NOT EXISTS public.daraz_chat_rules (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id      UUID        NOT NULL REFERENCES public.online_stores(id) ON DELETE CASCADE,
    match_type    TEXT        NOT NULL CHECK (match_type IN ('exact', 'keyword')),
    pattern       TEXT        NOT NULL,
    reply_content TEXT        NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (store_id, match_type, pattern)
);

-- 3. Chat Sessions Table (Caches buyer-seller chat threads)
CREATE TABLE IF NOT EXISTS public.daraz_chat_sessions (
    session_id           TEXT        PRIMARY KEY,
    store_id             UUID        NOT NULL REFERENCES public.online_stores(id) ON DELETE CASCADE,
    buyer_id             TEXT        NOT NULL,
    title                TEXT        NOT NULL,
    head_url             TEXT,
    unread_count         INT         NOT NULL DEFAULT 0,
    last_message_id      TEXT,
    last_message_time    TIMESTAMPTZ,
    last_message_summary TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Chat Messages Table (Caches chat logs with tags for retention filters)
CREATE TABLE IF NOT EXISTS public.daraz_chat_messages (
    message_id        TEXT        PRIMARY KEY,
    session_id        TEXT        NOT NULL REFERENCES public.daraz_chat_sessions(session_id) ON DELETE CASCADE,
    from_account_id   TEXT        NOT NULL,
    from_account_type TEXT        NOT NULL, -- '1' for seller, '2' for buyer
    to_account_id     TEXT        NOT NULL,
    to_account_type   TEXT        NOT NULL,
    content           TEXT        NOT NULL,
    template_id       TEXT        NOT NULL DEFAULT '1', -- '1' = Text, '3' = Image, etc.
    send_time         TIMESTAMPTZ NOT NULL,
    auto_reply        BOOLEAN     NOT NULL DEFAULT FALSE,
    tags              TEXT[]      NOT NULL DEFAULT '{}',
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Delayed Messages Queue Table (Handles delayed automation tasks)
CREATE TABLE IF NOT EXISTS public.daraz_delayed_messages (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id      UUID        NOT NULL REFERENCES public.online_stores(id) ON DELETE CASCADE,
    order_id      TEXT        NOT NULL,
    session_id    TEXT, -- Might be populated later after calling open session
    template_id   TEXT        NOT NULL DEFAULT '1',
    txt           TEXT,
    scheduled_at  TIMESTAMPTZ NOT NULL,
    status        TEXT        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
    error_message TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (store_id, order_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_daraz_chat_rules_store ON public.daraz_chat_rules(store_id);
CREATE INDEX IF NOT EXISTS idx_daraz_chat_sessions_store ON public.daraz_chat_sessions(store_id);
CREATE INDEX IF NOT EXISTS idx_daraz_chat_messages_session ON public.daraz_chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_daraz_chat_messages_send_time ON public.daraz_chat_messages(send_time);
CREATE INDEX IF NOT EXISTS idx_daraz_delayed_messages_status_sched ON public.daraz_delayed_messages(status, scheduled_at);

-- RLS Configuration
ALTER TABLE public.daraz_chat_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daraz_chat_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daraz_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daraz_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daraz_delayed_messages ENABLE ROW LEVEL SECURITY;

-- Auth policies (allowing authenticated staff/admin users full access)
CREATE POLICY "auth_full_access_chat_settings" ON public.daraz_chat_settings FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "auth_full_access_chat_rules" ON public.daraz_chat_rules FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "auth_full_access_chat_sessions" ON public.daraz_chat_sessions FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "auth_full_access_chat_messages" ON public.daraz_chat_messages FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "auth_full_access_delayed_messages" ON public.daraz_delayed_messages FOR ALL TO authenticated USING (TRUE) WITH CHECK (TRUE);

-- 6. Retention Policy Cleanup Function
CREATE OR REPLACE FUNCTION public.clean_daraz_chat_messages()
RETURNS VOID AS $$
BEGIN
    -- Delete untagged messages older than 48 hours
    DELETE FROM public.daraz_chat_messages
    WHERE (tags IS NULL OR cardinality(tags) = 0)
      AND send_time < NOW() - INTERVAL '48 hours';

    -- Delete tagged messages older than 15 days
    DELETE FROM public.daraz_chat_messages
    WHERE (tags IS NOT NULL AND cardinality(tags) > 0)
      AND send_time < NOW() - INTERVAL '15 days';
END;
$$ LANGUAGE plpgsql;

-- Trigger to keep updated_at columns in sync
CREATE OR REPLACE FUNCTION public.update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_daraz_chat_settings_modtime BEFORE UPDATE ON public.daraz_chat_settings FOR EACH ROW EXECUTE PROCEDURE public.update_modified_column();
CREATE TRIGGER update_daraz_chat_rules_modtime BEFORE UPDATE ON public.daraz_chat_rules FOR EACH ROW EXECUTE PROCEDURE public.update_modified_column();
CREATE TRIGGER update_daraz_chat_sessions_modtime BEFORE UPDATE ON public.daraz_chat_sessions FOR EACH ROW EXECUTE PROCEDURE public.update_modified_column();
CREATE TRIGGER update_daraz_delayed_messages_modtime BEFORE UPDATE ON public.daraz_delayed_messages FOR EACH ROW EXECUTE PROCEDURE public.update_modified_column();
