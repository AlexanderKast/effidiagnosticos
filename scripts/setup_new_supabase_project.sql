-- ============================================================
-- SETUP COMPLETO — Nuevo proyecto Supabase effidiagnosticos
-- Proyecto: cglcbrodulzssfohtjpt
-- Pegar en SQL Editor → Run
-- ============================================================

-- ============================================================
-- PARTE 1: Schema base (migración original)
-- ============================================================

-- Enum de roles
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Tabla de roles de usuario
CREATE TABLE public.user_roles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role       app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Función SECURITY DEFINER para evitar recursión RLS
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY "Users can view own roles"
  ON public.user_roles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Función para updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Tabla principal de configuraciones de booking
CREATE TABLE public.booking_configs (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id               TEXT NOT NULL UNIQUE,
  name                     TEXT NOT NULL,
  area                     TEXT NOT NULL DEFAULT '',
  country                  TEXT NOT NULL DEFAULT '',
  title                    TEXT NOT NULL,
  subtitle                 TEXT NOT NULL DEFAULT '',
  duration                 INTEGER NOT NULL DEFAULT 30,
  topics                   JSONB NOT NULL DEFAULT '[]',
  target_audience          JSONB NOT NULL DEFAULT '[]',
  not_for                  JSONB NOT NULL DEFAULT '[]',
  expectations             JSONB NOT NULL DEFAULT '[]',
  policy_text              TEXT NOT NULL DEFAULT '',
  require_policy_acceptance BOOLEAN NOT NULL DEFAULT true,
  n8n_get_availability_url TEXT NOT NULL DEFAULT '',
  n8n_create_booking_url   TEXT NOT NULL DEFAULT '',
  active                   BOOLEAN NOT NULL DEFAULT true,
  -- Migración 2: form_fields
  form_fields              JSONB NOT NULL DEFAULT '[
    {"id": "name", "label": "Nombre completo", "type": "text", "required": true, "placeholder": "Tu nombre"},
    {"id": "email", "label": "Email", "type": "email", "required": true, "placeholder": "tu@email.com"},
    {"id": "company", "label": "Empresa", "type": "text", "required": false, "placeholder": "Nombre de tu empresa"},
    {"id": "notes", "label": "Notas adicionales", "type": "textarea", "required": false, "placeholder": "¿Algo que debamos saber antes de la reunión?"}
  ]',
  -- Migración 3: tracking_pixels
  tracking_pixels          JSONB DEFAULT '[]',
  -- Migración 4: feature flag backend + calendar ID por comercial
  use_supabase_backend     BOOLEAN NOT NULL DEFAULT false,
  gcal_calendar_id         TEXT NOT NULL DEFAULT 'primary',
  created_at               TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at               TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

COMMENT ON COLUMN public.booking_configs.tracking_pixels IS 'Array of tracking pixel configurations: [{platform, pixelId, events: [{eventName, triggerOn}]}]';
COMMENT ON COLUMN public.booking_configs.use_supabase_backend IS 'When true, BookingPage calls Edge Functions instead of n8n_*_url fields';
COMMENT ON COLUMN public.booking_configs.gcal_calendar_id IS 'ID del calendario del comercial (ej: juan@effi.com). Tu cuenta principal debe tener acceso compartido a ese calendario.';

ALTER TABLE public.booking_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active bookings"
  ON public.booking_configs FOR SELECT
  USING (active = true);

CREATE POLICY "Admins can view all bookings"
  ON public.booking_configs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert bookings"
  ON public.booking_configs FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update bookings"
  ON public.booking_configs FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete bookings"
  ON public.booking_configs FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_booking_configs_updated_at
  BEFORE UPDATE ON public.booking_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabla de perfiles de usuario
CREATE TABLE public.profiles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  email      TEXT,
  full_name  TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- PARTE 2: Nuevas tablas — backend nativo sin N8N
-- ============================================================

-- oauth_tokens: tokens Google encriptados (AES-256-CBC en Edge Function)
CREATE TABLE public.oauth_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider      TEXT NOT NULL DEFAULT 'google',
  account_key   TEXT NOT NULL DEFAULT 'default',
  access_token  TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at    TIMESTAMP WITH TIME ZONE NOT NULL,
  scope         TEXT,
  token_type    TEXT NOT NULL DEFAULT 'Bearer',
  created_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (provider, account_key)
);

ALTER TABLE public.oauth_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role only on oauth_tokens"
  ON public.oauth_tokens FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER update_oauth_tokens_updated_at
  BEFORE UPDATE ON public.oauth_tokens
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- appointments: citas agendadas (source of truth)
CREATE TABLE public.appointments (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id           TEXT NOT NULL REFERENCES public.booking_configs(booking_id) ON DELETE RESTRICT,
  lead_name            TEXT NOT NULL,
  lead_email           TEXT NOT NULL,
  lead_company         TEXT,
  lead_notes           TEXT,
  form_data            JSONB NOT NULL DEFAULT '{}',
  appointment_date     DATE NOT NULL,
  start_time           TIME NOT NULL,
  end_time             TIME NOT NULL,
  timezone             TEXT NOT NULL DEFAULT 'America/Bogota',
  duration_minutes     INTEGER NOT NULL DEFAULT 30,
  status               TEXT NOT NULL DEFAULT 'confirmed'
                       CHECK (status IN ('pending', 'confirmed', 'cancelled', 'rescheduled', 'completed', 'no_show')),
  gcal_event_id        TEXT,
  gcal_html_link       TEXT,
  gcal_sync_status     TEXT NOT NULL DEFAULT 'pending'
                       CHECK (gcal_sync_status IN ('pending', 'synced', 'failed', 'skipped')),
  gcal_sync_attempts   INTEGER NOT NULL DEFAULT 0,
  gcal_last_error      TEXT,
  gcal_synced_at       TIMESTAMP WITH TIME ZONE,
  confirmation_sent_at TIMESTAMP WITH TIME ZONE,
  reminder_sent_at     TIMESTAMP WITH TIME ZONE,
  whatsapp_sent_at     TIMESTAMP WITH TIME ZONE,
  source               TEXT DEFAULT 'web',
  ip_address           INET,
  user_agent           TEXT,
  created_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_appointments_booking_id  ON public.appointments(booking_id);
CREATE INDEX idx_appointments_date        ON public.appointments(appointment_date);
CREATE INDEX idx_appointments_email       ON public.appointments(lead_email);
CREATE INDEX idx_appointments_status      ON public.appointments(status);
CREATE INDEX idx_appointments_gcal_status ON public.appointments(gcal_sync_status)
  WHERE gcal_sync_status IN ('pending', 'failed');

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create appointments"
  ON public.appointments FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can read all appointments"
  ON public.appointments FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update appointments"
  ON public.appointments FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete appointments"
  ON public.appointments FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role full access on appointments"
  ON public.appointments FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- availability_locks: previene double-booking concurrente
CREATE TABLE public.availability_locks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id TEXT NOT NULL,
  slot_date  DATE NOT NULL,
  slot_time  TIME NOT NULL,
  locked_by  TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now() + INTERVAL '5 minutes',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (booking_id, slot_date, slot_time)
);

CREATE INDEX idx_availability_locks_expires ON public.availability_locks(expires_at);

ALTER TABLE public.availability_locks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on locks"
  ON public.availability_locks FOR ALL TO service_role
  USING (true) WITH CHECK (true);

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

-- audit_log: log inmutable de eventos
CREATE TABLE public.audit_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id  TEXT,
  entity_type TEXT NOT NULL,
  entity_id   TEXT,
  action      TEXT NOT NULL,
  actor       TEXT,
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_log_entity     ON public.audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_action     ON public.audit_log(action);
CREATE INDEX idx_audit_log_created    ON public.audit_log(created_at DESC);
CREATE INDEX idx_audit_log_request_id ON public.audit_log(request_id)
  WHERE request_id IS NOT NULL;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can write audit log"
  ON public.audit_log FOR INSERT TO service_role
  WITH CHECK (true);

CREATE POLICY "Admins can read audit log"
  ON public.audit_log FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE RULE audit_log_no_update AS ON UPDATE TO public.audit_log DO INSTEAD NOTHING;
CREATE RULE audit_log_no_delete AS ON DELETE TO public.audit_log DO INSTEAD NOTHING;

-- Helper: verificar disponibilidad de slot
CREATE OR REPLACE FUNCTION public.is_slot_available(
  p_booking_id TEXT,
  p_date       DATE,
  p_start_time TIME,
  p_end_time   TIME
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
      AND (start_time < p_end_time AND end_time > p_start_time)
  );
END;
$$;

-- ============================================================
-- FIN DEL SETUP
-- Tablas creadas: user_roles, booking_configs, profiles,
--                 oauth_tokens, appointments, availability_locks,
--                 audit_log
-- ============================================================
