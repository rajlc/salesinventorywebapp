-- Migration: Atomic queue claim for daraz_delayed_messages
-- Fixes the TOCTOU race condition where multiple concurrent workers
-- (cron + webhook + sync) could process the same message twice.
--
-- Uses PostgreSQL's FOR UPDATE SKIP LOCKED pattern — the standard
-- way to implement a race-condition-proof job queue.

CREATE OR REPLACE FUNCTION claim_pending_delayed_messages(p_limit INT DEFAULT 10)
RETURNS SETOF daraz_delayed_messages
LANGUAGE sql
AS $$
    UPDATE daraz_delayed_messages
    SET
        status     = 'processing',
        updated_at = NOW()
    WHERE id IN (
        SELECT id
        FROM daraz_delayed_messages
        WHERE status = 'pending'
          AND scheduled_at <= NOW()
        ORDER BY scheduled_at ASC
        LIMIT p_limit
        FOR UPDATE SKIP LOCKED  -- Skip rows already locked by another worker
    )
    RETURNING *;
$$;

-- Grant access to authenticated users (server-side admin client uses service role which bypasses RLS anyway)
GRANT EXECUTE ON FUNCTION claim_pending_delayed_messages(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION claim_pending_delayed_messages(INT) TO service_role;

-- Also add a cleanup: reset any tasks stuck in 'processing' for >5 minutes
-- (handles cases where a worker crashed mid-task)
CREATE OR REPLACE FUNCTION reset_stuck_delayed_messages()
RETURNS INT
LANGUAGE sql
AS $$
    WITH updated AS (
        UPDATE daraz_delayed_messages
        SET
            status        = 'pending',
            error_message = 'Reset: was stuck in processing state',
            updated_at    = NOW()
        WHERE status = 'processing'
          AND updated_at < NOW() - INTERVAL '5 minutes'
        RETURNING id
    )
    SELECT COUNT(*)::INT FROM updated;
$$;

GRANT EXECUTE ON FUNCTION reset_stuck_delayed_messages() TO service_role;
