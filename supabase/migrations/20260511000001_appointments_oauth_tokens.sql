-- ============================================================
-- MIGRATION: New tables for Supabase-native backend
-- Replaces N8N dependency with Edge Functions + token manager
-- ============================================================

-- 1. Feature flag: enables Edge Functions backend per booking config
ALTER TABLE public.booking_configs
  ADD COLUMN IF NOT EXISTS use_supabase_backend BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.booking_configs.use_supabase_backend IS
  'When true, BookingPage calls Edge Functions instead of n8n_*_url fields';

-- 2. oauth_tokens — encrypted Google OAuth tokens
CREATE TABLE IF NOT EXISTS public.oauth_tokens (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider     TEXT NOT NULL DEFAULT 'google',
  account_key  TEXT NOT NULL DEFAULT 'default',  -- allows multiple Google accounts
  access_token TEXT NOT NULL,                    -- AES-256-CBC encrypted
  refresh_token TEXT NOT NULL,                   -- AES-256-CBC encrypted
  expires_at   TIMESTAMP WITH TIME ZONE NOT NULL,
  scope        TEXT,
  token_type   TEXT NOT NULL DEFAULT 'Bearer',
  created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (provider, account_key)
);

ALTER TABLE public.oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Only service role can touch oauth_tokens (Edge Functions use service key)
CREATE POLICY "Service role only on oauth_tokens"
  ON public.oauth_tokens
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_oauth_tokens_updated_at
  BEFORE UPDATE ON public.oauth_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. appointments — actual booked appointments (source of truth)
CREATE TABLE IF NOT EXISTS public.appointments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id      TEXT NOT NULL REFERENCES public.booking_configs(booking_id) ON DELETE RESTRICT,

  -- Lead info (from form)
  lead_name       TEXT NOT NULL,
  lead_email      TEXT NOT NULL,
  lead_company    TEXT,
  lead_notes      TEXT,
  form_data       JSONB NOT NULL DEFAULT '{}',   -- all extra form fields

  -- Scheduling
  appointment_date DATE NOT NULL,
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  timezone        TEXT NOT NULL DEFAULT 'America/Bogota',
  duration_minutes INTEGER NOT NULL DEFAULT 30,

  -- Status
  status          TEXT NOT NULL DEFAULT 'confirmed'
                  CHECK (status IN ('pending', 'confirmed', 'cancelled', 'rescheduled', 'completed', 'no_show')),

  -- Google Calendar sync
  gcal_event_id   TEXT,
  gcal_html_link  TEXT,
  gcal_sync_status TEXT NOT NULL DEFAULT 'pending'
                  CHECK (gcal_sync_status IN ('pending', 'synced', 'failed', 'skipped')),
  gcal_sync_attempts INTEGER NOT NULL DEFAULT 0,
  gcal_last_error TEXT,
  gcal_synced_at  TIMESTAMP WITH TIME ZONE,

  -- Notifications
  confirmation_sent_at TIMESTAMP WITH TIME ZONE,
  reminder_sent_at     TIMESTAMP WITH TIME ZONE,
  whatsapp_sent_at     TIMESTAMP WITH TIME ZONE,

  -- Meta
  source          TEXT DEFAULT 'web',            -- 'web', 'api', 'admin'
  ip_address      INET,
  user_agent      TEXT,
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_appointments_booking_id    ON public.appointments(booking_id);
CREATE INDEX idx_appointments_date          ON public.appointments(appointment_date);
CREATE INDEX idx_appointments_email         ON public.appointments(lead_email);
CREATE INDEX idx_appointments_status        ON public.appointments(status);
CREATE INDEX idx_appointments_gcal_status   ON public.appointments(gcal_sync_status) WHERE gcal_sync_status IN ('pending', 'failed');

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

-- Public can INSERT (submit booking form)
CREATE POLICY "Anyone can create appointments"
  ON public.appointments
  FOR INSERT
  WITH CHECK (true);

-- Admins can read and manage all appointments
CREATE POLICY "Admins can read all appointments"
  ON public.appointments
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update appointments"
  ON public.appointments
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete appointments"
  ON public.appointments
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Service role full access (Edge Functions)
CREATE POLICY "Service role full access on appointments"
  ON public.appointments
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. availability_locks — prevents double-booking during concurrent requests
CREATE TABLE IF NOT EXISTS public.availability_locks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id  TEXT NOT NULL,
  slot_date   DATE NOT NULL,
  slot_time   TIME NOT NULL,
  locked_by   TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  expires_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now() + INTERVAL '5 minutes',
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (booking_id, slot_date, slot_time)
);

CREATE INDEX idx_availability_locks_expires ON public.availability_locks(expires_at);

ALTER TABLE public.availability_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on locks"
  ON public.availability_locks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Auto-cleanup function for expired locks
CREATE OR REPLACE FUNCTION public.cleanup_expired_locks()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.availability_locks WHERE expires_at < now();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- 5. audit_log — immutable event log
CREATE TABLE IF NOT EXISTS public.audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id  TEXT,
  entity_type TEXT NOT NULL,   -- 'appointment', 'booking_config', 'oauth_token', etc.
  entity_id   TEXT,
  action      TEXT NOT NULL,   -- 'created', 'updated', 'cancelled', 'gcal_synced', 'error', etc.
  actor       TEXT,            -- user_id, 'edge_function', 'cron_job', etc.
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_entity       ON public.audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_action       ON public.audit_log(action);
CREATE INDEX idx_audit_log_created_at   ON public.audit_log(created_at DESC);
CREATE INDEX idx_audit_log_request_id   ON public.audit_log(request_id) WHERE request_id IS NOT NULL;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Audit log: insert-only for everyone, read for admins
CREATE POLICY "Service role can write audit log"
  ON public.audit_log
  FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Admins can read audit log"
  ON public.audit_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Prevent updates/deletes on audit_log (immutable)
CREATE RULE audit_log_no_update AS ON UPDATE TO public.audit_log DO INSTEAD NOTHING;
CREATE RULE audit_log_no_delete AS ON DELETE TO public.audit_log DO INSTEAD NOTHING;

-- 6. Helper: check if a slot is available
CREATE OR REPLACE FUNCTION public.is_slot_available(
  p_booking_id   TEXT,
  p_date         DATE,
  p_start_time   TIME,
  p_end_time     TIME
)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM public.appointments
    WHERE booking_id = p_booking_id
      AND appointment_date = p_date
      AND status NOT IN ('cancelled', 'rescheduled')
      AND (
        (start_time < p_end_time AND end_time > p_start_time)
      )
  );
END;
$$;
