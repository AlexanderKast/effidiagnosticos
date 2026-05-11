-- =============================================================================
-- MIGRACIÓN CONSOLIDADA — Efficommerce Scheduler
-- Proyecto Supabase: cglcbrodulzssfohtjpt
-- Idempotente: usa IF NOT EXISTS / ADD COLUMN IF NOT EXISTS
-- Aplicar en: Supabase SQL Editor
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 0. Extensiones requeridas
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ---------------------------------------------------------------------------
-- 1. Tablas base: commercial_calendars y commercial_groups
--    (deben existir antes que las FK que las referencian)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS commercial_calendars (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  commercial_id TEXT,
  name          TEXT        NOT NULL,
  email         TEXT        NOT NULL,
  calendar_id   TEXT        NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'inactive')),
  empresa       TEXT,
  country       TEXT        NOT NULL DEFAULT 'CO',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commercial_groups (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT        NOT NULL,
  description TEXT,
  country     TEXT,
  active      BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS commercial_group_members (
  group_id      UUID NOT NULL REFERENCES commercial_groups(id)      ON DELETE CASCADE,
  commercial_id UUID NOT NULL REFERENCES commercial_calendars(id)   ON DELETE CASCADE,
  PRIMARY KEY (group_id, commercial_id)
);

-- ---------------------------------------------------------------------------
-- 2. oauth_tokens — almacena el token OAuth de Google para la cuenta principal
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS oauth_tokens (
  id            UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  account_key   TEXT        NOT NULL UNIQUE,   -- 'default' para la cuenta principal
  provider      TEXT        NOT NULL DEFAULT 'google',
  access_token  TEXT        NOT NULL,
  refresh_token TEXT        NOT NULL,
  token_type    TEXT        NOT NULL DEFAULT 'Bearer',
  expires_at    TIMESTAMPTZ,
  scope         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------------------------
-- 3. Columnas nuevas en booking_configs (existente)
-- ---------------------------------------------------------------------------

ALTER TABLE booking_configs
  ADD COLUMN IF NOT EXISTS use_supabase_backend BOOLEAN  NOT NULL DEFAULT true;

ALTER TABLE booking_configs
  ADD COLUMN IF NOT EXISTS gcal_calendar_id     TEXT     NOT NULL DEFAULT 'primary';

ALTER TABLE booking_configs
  ADD COLUMN IF NOT EXISTS assignment_type      TEXT     NOT NULL DEFAULT 'individual';

-- CHECK constraint para assignment_type (idempotente con bloque DO)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'booking_configs_assignment_type_check'
      AND table_name = 'booking_configs'
  ) THEN
    ALTER TABLE booking_configs
      ADD CONSTRAINT booking_configs_assignment_type_check
        CHECK (assignment_type IN ('individual', 'group'));
  END IF;
END $$;

ALTER TABLE booking_configs
  ADD COLUMN IF NOT EXISTS commercial_group_id  UUID;

-- FK booking_configs.commercial_group_id → commercial_groups
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'booking_configs_commercial_group_id_fkey'
      AND table_name = 'booking_configs'
  ) THEN
    ALTER TABLE booking_configs
      ADD CONSTRAINT booking_configs_commercial_group_id_fkey
        FOREIGN KEY (commercial_group_id)
        REFERENCES commercial_groups(id)
        ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 4. appointments — tabla principal de reservas
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS appointments (
  id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id            TEXT        NOT NULL,
  lead_name             TEXT        NOT NULL,
  lead_email            TEXT        NOT NULL,
  lead_company          TEXT,
  lead_notes            TEXT,
  form_data             JSONB       NOT NULL DEFAULT '{}',
  appointment_date      DATE        NOT NULL,
  start_time            TEXT        NOT NULL,  -- "09:00"
  end_time              TEXT        NOT NULL,  -- "09:30"
  duration_minutes      INTEGER     NOT NULL DEFAULT 30,
  timezone              TEXT        NOT NULL DEFAULT 'America/Bogota',
  status                TEXT        NOT NULL DEFAULT 'confirmed'
                                    CHECK (status IN ('pending', 'confirmed', 'cancelled', 'no_show')),
  assigned_commercial_id UUID        REFERENCES commercial_calendars(id) ON DELETE SET NULL,
  gcal_event_id         TEXT,
  gcal_html_link        TEXT,
  gcal_sync_status      TEXT        NOT NULL DEFAULT 'pending'
                                    CHECK (gcal_sync_status IN ('pending', 'synced', 'failed', 'skipped')),
  gcal_synced_at        TIMESTAMPTZ,
  gcal_last_error       TEXT,
  gcal_sync_attempts    INTEGER     NOT NULL DEFAULT 0,
  source                TEXT        NOT NULL DEFAULT 'web',
  ip_address            TEXT,
  user_agent            TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FK appointments.assigned_commercial_id (por si la tabla ya existía sin la FK)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'appointments_assigned_commercial_id_fkey'
      AND table_name = 'appointments'
  ) THEN
    ALTER TABLE appointments
      ADD CONSTRAINT appointments_assigned_commercial_id_fkey
        FOREIGN KEY (assigned_commercial_id)
        REFERENCES commercial_calendars(id)
        ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Índices útiles para appointments
CREATE INDEX IF NOT EXISTS idx_appointments_booking_date
  ON appointments(booking_id, appointment_date);

CREATE INDEX IF NOT EXISTS idx_appointments_commercial_date
  ON appointments(assigned_commercial_id, appointment_date);

CREATE INDEX IF NOT EXISTS idx_appointments_status
  ON appointments(status);

CREATE INDEX IF NOT EXISTS idx_appointments_lead_email
  ON appointments(lead_email);

-- ---------------------------------------------------------------------------
-- 5. availability_locks — prevenir double-booking (lock optimista)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS availability_locks (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id  TEXT        NOT NULL,
  slot_date   DATE        NOT NULL,
  slot_time   TEXT        NOT NULL,   -- "09:00"
  locked_by   UUID        NOT NULL,   -- UUID de la solicitud que adquirió el lock
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT availability_locks_unique_slot UNIQUE (booking_id, slot_date, slot_time)
);

-- Índice para limpieza de locks expirados
CREATE INDEX IF NOT EXISTS idx_availability_locks_created_at
  ON availability_locks(created_at);

-- ---------------------------------------------------------------------------
-- 6. audit_log — registro de operaciones del sistema
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS audit_log (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id  TEXT,
  entity_type TEXT        NOT NULL,   -- 'appointment', 'booking_config', etc.
  entity_id   TEXT,
  action      TEXT        NOT NULL,   -- 'created', 'updated', 'gcal_synced', 'error'
  actor       TEXT,                   -- 'edge_function:create-booking', user_id, etc.
  metadata    JSONB       NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_entity
  ON audit_log(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at
  ON audit_log(created_at);

-- ---------------------------------------------------------------------------
-- 7. Función is_slot_available
--    Verifica que no exista ningún appointment confirmado/pendiente que
--    solape con el slot solicitado para el mismo booking
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION is_slot_available(
  p_booking_id  TEXT,
  p_date        DATE,
  p_start_time  TEXT,
  p_end_time    TEXT
) RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*)
    INTO v_count
    FROM appointments
   WHERE booking_id       = p_booking_id
     AND appointment_date = p_date
     AND status           IN ('pending', 'confirmed')
     -- Hay solapamiento si: start < other_end AND end > other_start
     AND p_start_time     < end_time
     AND p_end_time       > start_time;

  RETURN v_count = 0;
END;
$$;

-- ---------------------------------------------------------------------------
-- 8. Triggers de updated_at
--    update_updated_at_column() ya existe en la BD; solo creamos los triggers
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'set_updated_at_commercial_calendars'
      AND event_object_table = 'commercial_calendars'
  ) THEN
    CREATE TRIGGER set_updated_at_commercial_calendars
      BEFORE UPDATE ON commercial_calendars
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'set_updated_at_commercial_groups'
      AND event_object_table = 'commercial_groups'
  ) THEN
    CREATE TRIGGER set_updated_at_commercial_groups
      BEFORE UPDATE ON commercial_groups
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'set_updated_at_oauth_tokens'
      AND event_object_table = 'oauth_tokens'
  ) THEN
    CREATE TRIGGER set_updated_at_oauth_tokens
      BEFORE UPDATE ON oauth_tokens
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'set_updated_at_appointments'
      AND event_object_table = 'appointments'
  ) THEN
    CREATE TRIGGER set_updated_at_appointments
      BEFORE UPDATE ON appointments
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 9. RLS — Row Level Security
-- ---------------------------------------------------------------------------

-- Habilitar RLS en todas las tablas nuevas
ALTER TABLE commercial_calendars     ENABLE ROW LEVEL SECURITY;
ALTER TABLE commercial_groups        ENABLE ROW LEVEL SECURITY;
ALTER TABLE commercial_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_tokens             ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments             ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_locks       ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log                ENABLE ROW LEVEL SECURITY;

-- ---- commercial_calendars ----

DROP POLICY IF EXISTS "service_role_all_commercial_calendars" ON commercial_calendars;
CREATE POLICY "service_role_all_commercial_calendars"
  ON commercial_calendars FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "admins_select_commercial_calendars" ON commercial_calendars;
CREATE POLICY "admins_select_commercial_calendars"
  ON commercial_calendars FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins_insert_commercial_calendars" ON commercial_calendars;
CREATE POLICY "admins_insert_commercial_calendars"
  ON commercial_calendars FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins_update_commercial_calendars" ON commercial_calendars;
CREATE POLICY "admins_update_commercial_calendars"
  ON commercial_calendars FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins_delete_commercial_calendars" ON commercial_calendars;
CREATE POLICY "admins_delete_commercial_calendars"
  ON commercial_calendars FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- ---- commercial_groups ----

DROP POLICY IF EXISTS "service_role_all_commercial_groups" ON commercial_groups;
CREATE POLICY "service_role_all_commercial_groups"
  ON commercial_groups FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "admins_select_commercial_groups" ON commercial_groups;
CREATE POLICY "admins_select_commercial_groups"
  ON commercial_groups FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins_insert_commercial_groups" ON commercial_groups;
CREATE POLICY "admins_insert_commercial_groups"
  ON commercial_groups FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins_update_commercial_groups" ON commercial_groups;
CREATE POLICY "admins_update_commercial_groups"
  ON commercial_groups FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins_delete_commercial_groups" ON commercial_groups;
CREATE POLICY "admins_delete_commercial_groups"
  ON commercial_groups FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- ---- commercial_group_members ----

DROP POLICY IF EXISTS "service_role_all_commercial_group_members" ON commercial_group_members;
CREATE POLICY "service_role_all_commercial_group_members"
  ON commercial_group_members FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "admins_select_commercial_group_members" ON commercial_group_members;
CREATE POLICY "admins_select_commercial_group_members"
  ON commercial_group_members FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins_insert_commercial_group_members" ON commercial_group_members;
CREATE POLICY "admins_insert_commercial_group_members"
  ON commercial_group_members FOR INSERT
  TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins_delete_commercial_group_members" ON commercial_group_members;
CREATE POLICY "admins_delete_commercial_group_members"
  ON commercial_group_members FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- ---- oauth_tokens — solo service_role ----

DROP POLICY IF EXISTS "service_role_all_oauth_tokens" ON oauth_tokens;
CREATE POLICY "service_role_all_oauth_tokens"
  ON oauth_tokens FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ---- appointments — service_role + admins pueden leer ----

DROP POLICY IF EXISTS "service_role_all_appointments" ON appointments;
CREATE POLICY "service_role_all_appointments"
  ON appointments FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "admins_select_appointments" ON appointments;
CREATE POLICY "admins_select_appointments"
  ON appointments FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- ---- availability_locks — solo service_role ----

DROP POLICY IF EXISTS "service_role_all_availability_locks" ON availability_locks;
CREATE POLICY "service_role_all_availability_locks"
  ON availability_locks FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ---- audit_log — service_role + admins pueden leer ----

DROP POLICY IF EXISTS "service_role_all_audit_log" ON audit_log;
CREATE POLICY "service_role_all_audit_log"
  ON audit_log FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "admins_select_audit_log" ON audit_log;
CREATE POLICY "admins_select_audit_log"
  ON audit_log FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- 10. Verificación final — listar tablas creadas
-- ---------------------------------------------------------------------------

SELECT
  tablename,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = current_schema()
  AND tablename IN (
    'commercial_calendars',
    'commercial_groups',
    'commercial_group_members',
    'oauth_tokens',
    'appointments',
    'availability_locks',
    'audit_log'
  )
ORDER BY tablename;
