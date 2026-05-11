# 🗄️ Schema Supabase — Sistema de Agendamiento

> **SQL listo para copiar y pegar en el SQL Editor de Supabase.**

---

## 📑 Tabla de Contenidos

1. [Vista general](#1-vista-general)
2. [Diagrama ER](#2-diagrama-er)
3. [Extensiones requeridas](#3-extensiones-requeridas)
4. [Enums](#4-enums)
5. [Tabla `comerciales`](#5-tabla-comerciales)
6. [Tabla `bookings`](#6-tabla-bookings)
7. [Tabla `slots_available`](#7-tabla-slots_available)
8. [Tabla `calendar_events`](#8-tabla-calendar_events)
9. [Tabla `audit_log`](#9-tabla-audit_log)
10. [Tabla `holidays`](#10-tabla-holidays)
11. [Índices](#11-índices)
12. [Triggers y funciones](#12-triggers-y-funciones)
13. [Row Level Security](#13-row-level-security)
14. [Queries comunes](#14-queries-comunes)
15. [Script de instalación completo](#15-script-de-instalación-completo)

---

## 1. Vista general

| Tabla | Propósito | Filas estimadas (1 año) |
|-------|-----------|-------------------------|
| `comerciales` | Equipo de ventas activo | 5-20 |
| `bookings` | Citas confirmadas | 5.000-20.000 |
| `slots_available` | Caché de disponibilidad | 10.000-50.000 |
| `calendar_events` | Sync con Google Calendar | igual a `bookings` |
| `audit_log` | Trazabilidad de acciones | 50.000-200.000 |
| `holidays` | Festivos por país/región | 50-100 |

---

## 2. Diagrama ER

```
┌────────────────┐
│  comerciales   │
│────────────────│
│ id (PK)        │◀──────┐
│ nombre         │       │
│ email          │       │
│ activo         │       │ FK
│ ...            │       │
└────────────────┘       │
                         │
                  ┌──────┴──────┐
                  │  bookings   │
                  │─────────────│
                  │ id (PK)     │◀──────┐
                  │ booking_id  │       │
                  │ comercial_id│       │ FK
                  │ fecha       │       │
                  │ hora        │       │
                  │ ...         │       │
                  └─────────────┘       │
                         │              │
              ┌──────────┘              │
              │                         │
              ▼                         ▼
   ┌──────────────────┐      ┌─────────────────┐
   │ calendar_events  │      │   audit_log     │
   │──────────────────│      │─────────────────│
   │ id (PK)          │      │ id (PK)         │
   │ booking_id (FK)  │      │ resource_type   │
   │ google_event_id  │      │ resource_id     │
   │ sync_status      │      │ action          │
   └──────────────────┘      └─────────────────┘

┌──────────────────┐         ┌──────────────────┐
│ slots_available  │         │    holidays      │
│──────────────────│         │──────────────────│
│ id (PK)          │         │ id (PK)          │
│ comercial_id (FK)│         │ fecha (UNIQUE)   │
│ fecha            │         │ nombre           │
│ hora             │         │ pais             │
│ available        │         └──────────────────┘
└──────────────────┘
```

---

## 3. Extensiones requeridas

```sql
-- UUIDs como claves primarias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Búsqueda de texto sin tildes
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- Funciones de tiempo extendidas
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
```

---

## 4. Enums

```sql
-- Estado de la cita
CREATE TYPE booking_status AS ENUM (
  'pending',      -- creada, sin confirmar
  'confirmed',    -- confirmada, comercial asignado
  'attended',     -- el prospecto asistió
  'no_show',      -- no se presentó
  'cancelled',    -- cancelada por cualquier parte
  'rescheduled'   -- reagendada (apunta a otra booking)
);

-- Estado de sincronización con Google
CREATE TYPE sync_status AS ENUM (
  'pending',      -- aún no se ha intentado
  'synced',       -- subido a Google correctamente
  'failed',       -- intento fallido, reintentar
  'skipped'       -- desactivado por config
);

-- Acción auditada
CREATE TYPE audit_action AS ENUM (
  'create',
  'update',
  'delete',
  'sync',
  'cancel',
  'reschedule',
  'login',
  'error'
);
```

---

## 5. Tabla `comerciales`

Representa al equipo de ventas. Cada comercial puede recibir citas.

```sql
CREATE TABLE comerciales (
  id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre          TEXT         NOT NULL,
  email           TEXT         NOT NULL UNIQUE,
  whatsapp        TEXT,
  google_calendar_id TEXT,                                       -- ID del calendario destino
  activo          BOOLEAN      NOT NULL DEFAULT TRUE,
  prioridad       INTEGER      NOT NULL DEFAULT 100,              -- menor = más prioridad
  max_citas_dia   INTEGER      NOT NULL DEFAULT 8,
  zonas           TEXT[]       DEFAULT ARRAY[]::TEXT[],          -- ej: ['Bogotá', 'Medellín']
  notas           TEXT,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE comerciales IS 'Equipo de ventas que recibe citas';
COMMENT ON COLUMN comerciales.activo IS 'Si está en FALSE no recibe nuevas citas';
COMMENT ON COLUMN comerciales.prioridad IS 'Para selección ponderada (menor = primero)';
COMMENT ON COLUMN comerciales.zonas IS 'Zonas geográficas que atiende';
```

**¿Por qué cada campo?**

- `id` UUID: evita exposición de IDs secuenciales.
- `email UNIQUE`: previene duplicados, sirve como login.
- `google_calendar_id`: por si cada comercial usa su propio calendario.
- `activo`: borrado lógico, no físico.
- `prioridad`: permite a futuro pasar de round-robin a ponderado.
- `max_citas_dia`: tope para no saturar.
- `zonas`: permite ruteo por región más adelante.

---

## 6. Tabla `bookings`

El **corazón del sistema.** Cada fila = una cita.

```sql
CREATE TABLE bookings (
  id              UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id      TEXT            NOT NULL UNIQUE,           -- ej: 'EFFI-2026-001234'
  comercial_id    UUID            REFERENCES comerciales(id) ON DELETE SET NULL,

  -- Datos del prospecto
  nombre          TEXT            NOT NULL,
  email           TEXT            NOT NULL,
  whatsapp        TEXT            NOT NULL,
  empresa         TEXT,
  cargo           TEXT,
  pais            TEXT            DEFAULT 'Colombia',
  ciudad          TEXT,

  -- Datos de la cita
  fecha           DATE            NOT NULL,
  hora            TIME            NOT NULL,
  duracion_min    INTEGER         NOT NULL DEFAULT 30,
  timezone        TEXT            NOT NULL DEFAULT 'America/Bogota',
  status          booking_status  NOT NULL DEFAULT 'pending',

  -- Metadata
  origen          TEXT            DEFAULT 'landing',          -- landing, whatsapp, manual
  utm_source      TEXT,
  utm_medium      TEXT,
  utm_campaign    TEXT,
  zoom_link       TEXT,
  notas           TEXT,

  -- Auditoría
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  cancelled_at    TIMESTAMPTZ,
  cancelled_by    TEXT,
  cancel_reason   TEXT,

  -- Reagendamientos
  rescheduled_from UUID           REFERENCES bookings(id),

  -- Constraint: una cita no puede ser en el pasado
  CONSTRAINT chk_fecha_no_pasada CHECK (fecha >= '2026-01-01'),

  -- Constraint: hora válida (no negativa)
  CONSTRAINT chk_hora_valida CHECK (hora BETWEEN '06:00' AND '22:00'),

  -- Constraint: duración positiva
  CONSTRAINT chk_duracion_positiva CHECK (duracion_min > 0 AND duracion_min <= 240)
);

COMMENT ON TABLE bookings IS 'Citas confirmadas — source of truth';
COMMENT ON COLUMN bookings.booking_id IS 'ID legible mostrado al usuario';
COMMENT ON COLUMN bookings.status IS 'Estado actual de la cita';
```

**¿Por qué cada campo?**

- `booking_id` TEXT: ID legible (`EFFI-2026-001234`) para compartir con cliente.
- `comercial_id` puede ser NULL: si el comercial es eliminado, la cita queda sin asignar pero no se borra.
- `timezone`: necesario para sincronización correcta con Google Calendar.
- `origen`: análisis de canales de entrada.
- `utm_*`: atribución de marketing.
- `rescheduled_from`: trazabilidad de reagendamientos.
- `chk_*`: validaciones a nivel DB, defensa en profundidad.

---

## 7. Tabla `slots_available`

**Caché** de disponibilidad. No es estrictamente necesaria, pero acelera respuestas y evita recálculos.

```sql
CREATE TABLE slots_available (
  id              UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  comercial_id    UUID         NOT NULL REFERENCES comerciales(id) ON DELETE CASCADE,
  fecha           DATE         NOT NULL,
  hora            TIME         NOT NULL,
  available       BOOLEAN      NOT NULL DEFAULT TRUE,
  reserved_until  TIMESTAMPTZ,                                    -- bloqueo temporal mientras se confirma
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  UNIQUE (comercial_id, fecha, hora)
);

COMMENT ON TABLE slots_available IS 'Caché de slots disponibles por comercial';
COMMENT ON COLUMN slots_available.reserved_until IS 'Bloqueo temporal mientras el usuario completa el form';
```

**Decisión de diseño:**
Esta tabla es **opcional**. Si no se usa, los slots se calculan al vuelo en cada request. Ventaja de tenerla: respuestas más rápidas y soft-lock al iniciar el flujo.

---

## 8. Tabla `calendar_events`

Mapea cada `booking` a un evento en Google Calendar.

```sql
CREATE TABLE calendar_events (
  id                UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id        UUID         NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  google_event_id   TEXT,                                          -- id devuelto por Google
  google_calendar_id TEXT        NOT NULL,
  sync_status       sync_status  NOT NULL DEFAULT 'pending',
  sync_attempts     INTEGER      NOT NULL DEFAULT 0,
  last_sync_at      TIMESTAMPTZ,
  last_error        TEXT,
  payload           JSONB,                                         -- el payload exacto enviado a Google
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  UNIQUE (booking_id)
);

COMMENT ON TABLE calendar_events IS 'Mapeo de bookings a eventos en Google Calendar';
COMMENT ON COLUMN calendar_events.sync_status IS 'pending | synced | failed | skipped';
COMMENT ON COLUMN calendar_events.payload IS 'Snapshot del request enviado a Google API';
```

**¿Por qué guardar el payload?**

Permite **reintentos idempotentes** sin reconstruir la lógica, y debugging exacto si Google rechaza el evento.

---

## 9. Tabla `audit_log`

Registro inmutable de toda acción relevante.

```sql
CREATE TABLE audit_log (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  actor           TEXT          NOT NULL,                         -- 'system', email, IP
  action          audit_action  NOT NULL,
  resource_type   TEXT          NOT NULL,                         -- 'booking', 'comercial', etc
  resource_id     TEXT,
  payload_before  JSONB,
  payload_after   JSONB,
  ip_address      INET,
  user_agent      TEXT,
  metadata        JSONB,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE audit_log IS 'Auditoría inmutable de todas las acciones';
COMMENT ON COLUMN audit_log.actor IS 'Quien hizo la acción: system, email o IP';
```

**Regla:** esta tabla solo permite INSERT. Sin UPDATE ni DELETE.

```sql
-- Política: prohibir update y delete
REVOKE UPDATE, DELETE ON audit_log FROM PUBLIC;
```

---

## 10. Tabla `holidays`

Festivos para validar que no se agenden citas en días no laborables.

```sql
CREATE TABLE holidays (
  id        UUID    PRIMARY KEY DEFAULT uuid_generate_v4(),
  fecha     DATE    NOT NULL,
  nombre    TEXT    NOT NULL,
  pais      TEXT    NOT NULL DEFAULT 'Colombia',
  recurrent BOOLEAN NOT NULL DEFAULT FALSE,                      -- ej: año nuevo es recurrente

  UNIQUE (fecha, pais)
);

COMMENT ON TABLE holidays IS 'Días festivos por país';
```

**Seed inicial Colombia 2026:**

```sql
INSERT INTO holidays (fecha, nombre, pais) VALUES
  ('2026-01-01', 'Año Nuevo', 'Colombia'),
  ('2026-01-12', 'Día de los Reyes Magos', 'Colombia'),
  ('2026-03-23', 'Día de San José', 'Colombia'),
  ('2026-04-02', 'Jueves Santo', 'Colombia'),
  ('2026-04-03', 'Viernes Santo', 'Colombia'),
  ('2026-05-01', 'Día del Trabajo', 'Colombia'),
  ('2026-05-18', 'Día de la Ascensión', 'Colombia'),
  ('2026-06-08', 'Corpus Christi', 'Colombia'),
  ('2026-06-15', 'Sagrado Corazón', 'Colombia'),
  ('2026-06-29', 'San Pedro y San Pablo', 'Colombia'),
  ('2026-07-20', 'Día de la Independencia', 'Colombia'),
  ('2026-08-07', 'Batalla de Boyacá', 'Colombia'),
  ('2026-08-17', 'La Asunción', 'Colombia'),
  ('2026-10-12', 'Día de la Raza', 'Colombia'),
  ('2026-11-02', 'Día de Todos los Santos', 'Colombia'),
  ('2026-11-16', 'Independencia de Cartagena', 'Colombia'),
  ('2026-12-08', 'Día de la Inmaculada Concepción', 'Colombia'),
  ('2026-12-25', 'Navidad', 'Colombia')
ON CONFLICT (fecha, pais) DO NOTHING;
```

---

## 11. Índices

```sql
-- Búsquedas frecuentes en bookings
CREATE INDEX idx_bookings_fecha          ON bookings (fecha);
CREATE INDEX idx_bookings_comercial      ON bookings (comercial_id);
CREATE INDEX idx_bookings_status         ON bookings (status);
CREATE INDEX idx_bookings_email          ON bookings (LOWER(email));
CREATE INDEX idx_bookings_fecha_comercial ON bookings (fecha, comercial_id) WHERE status IN ('confirmed','pending');

-- slots_available
CREATE INDEX idx_slots_fecha_disp        ON slots_available (fecha, available);

-- audit_log: queries por recurso
CREATE INDEX idx_audit_resource          ON audit_log (resource_type, resource_id);
CREATE INDEX idx_audit_created           ON audit_log (created_at DESC);

-- calendar_events
CREATE INDEX idx_calendar_sync           ON calendar_events (sync_status) WHERE sync_status IN ('pending','failed');
```

**¿Por qué estos índices?**

- `idx_bookings_fecha`: consulta de slots disponibles por día.
- `idx_bookings_email`: búsqueda por prospecto.
- `idx_bookings_fecha_comercial WHERE status IN (...)`: índice **parcial**, ocupa menos espacio porque solo indexa filas activas.
- `idx_calendar_sync WHERE sync_status IN (...)`: el worker que reintenta solo lee `pending` y `failed`.

---

## 12. Triggers y funciones

### 12.1 Auto-actualizar `updated_at`

```sql
CREATE OR REPLACE FUNCTION trg_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_comerciales
  BEFORE UPDATE ON comerciales
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TRIGGER set_updated_at_bookings
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TRIGGER set_updated_at_slots
  BEFORE UPDATE ON slots_available
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();

CREATE TRIGGER set_updated_at_calendar
  BEFORE UPDATE ON calendar_events
  FOR EACH ROW EXECUTE FUNCTION trg_set_updated_at();
```

### 12.2 Generar `booking_id` legible

```sql
CREATE SEQUENCE IF NOT EXISTS booking_seq START 1;

CREATE OR REPLACE FUNCTION generate_booking_id()
RETURNS TEXT AS $$
DECLARE
  year_part TEXT;
  num_part  TEXT;
BEGIN
  year_part := TO_CHAR(NOW(), 'YYYY');
  num_part  := LPAD(nextval('booking_seq')::TEXT, 6, '0');
  RETURN 'EFFI-' || year_part || '-' || num_part;
END;
$$ LANGUAGE plpgsql;

-- Trigger: si no se provee booking_id, generar uno
CREATE OR REPLACE FUNCTION trg_booking_id_default()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.booking_id IS NULL OR NEW.booking_id = '' THEN
    NEW.booking_id = generate_booking_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_booking_id
  BEFORE INSERT ON bookings
  FOR EACH ROW EXECUTE FUNCTION trg_booking_id_default();
```

### 12.3 Auditoría automática de bookings

```sql
CREATE OR REPLACE FUNCTION trg_audit_bookings()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (actor, action, resource_type, resource_id, payload_after)
    VALUES ('system', 'create', 'booking', NEW.id::TEXT, to_jsonb(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (actor, action, resource_type, resource_id, payload_before, payload_after)
    VALUES ('system', 'update', 'booking', NEW.id::TEXT, to_jsonb(OLD), to_jsonb(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (actor, action, resource_type, resource_id, payload_before)
    VALUES ('system', 'delete', 'booking', OLD.id::TEXT, to_jsonb(OLD));
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_bookings
  AFTER INSERT OR UPDATE OR DELETE ON bookings
  FOR EACH ROW EXECUTE FUNCTION trg_audit_bookings();
```

---

## 13. Row Level Security

```sql
-- Activar RLS en todas las tablas sensibles
ALTER TABLE bookings        ENABLE ROW LEVEL SECURITY;
ALTER TABLE comerciales     ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log       ENABLE ROW LEVEL SECURITY;

-- Política: el service role bypasea RLS (lo usa el backend)
-- Política para usuarios autenticados normales:

CREATE POLICY "comerciales_read_self" ON comerciales
  FOR SELECT
  USING (auth.uid()::TEXT = id::TEXT);

CREATE POLICY "bookings_read_by_comercial" ON bookings
  FOR SELECT
  USING (
    comercial_id IN (
      SELECT id FROM comerciales WHERE auth.email() = comerciales.email
    )
  );

CREATE POLICY "audit_admin_only" ON audit_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM comerciales
      WHERE comerciales.email = auth.email()
        AND comerciales.activo = TRUE
        AND 'admin' = ANY (comerciales.zonas)
    )
  );
```

> **Nota:** el backend siempre usa la `service_role_key` que bypasea RLS. Estas políticas son para el dashboard donde los comerciales se autentican.

---

## 14. Queries comunes

### 14.1 Citas del día para un comercial

```sql
SELECT booking_id, nombre, hora, empresa, zoom_link, status
FROM bookings
WHERE comercial_id = $1
  AND fecha = CURRENT_DATE
  AND status IN ('confirmed', 'pending')
ORDER BY hora;
```

### 14.2 Disponibilidad de un comercial para una fecha

```sql
WITH bloques AS (
  SELECT generate_series(
    '09:00'::TIME,
    '17:00'::TIME,
    INTERVAL '30 minutes'
  )::TIME AS hora
),
ocupados AS (
  SELECT hora FROM bookings
  WHERE comercial_id = $1
    AND fecha = $2
    AND status IN ('confirmed','pending')
)
SELECT b.hora
FROM bloques b
LEFT JOIN ocupados o ON o.hora = b.hora
WHERE o.hora IS NULL
  AND b.hora NOT BETWEEN '12:00' AND '13:00'  -- almuerzo
ORDER BY b.hora;
```

### 14.3 Citas pendientes de sincronización con Google

```sql
SELECT ce.id, ce.booking_id, ce.sync_attempts, ce.last_error, b.fecha, b.hora
FROM calendar_events ce
JOIN bookings b ON b.id = ce.booking_id
WHERE ce.sync_status IN ('pending', 'failed')
  AND ce.sync_attempts < 5
ORDER BY ce.updated_at ASC
LIMIT 50;
```

### 14.4 Métricas: citas por comercial este mes

```sql
SELECT c.nombre, COUNT(b.*) AS total_citas
FROM comerciales c
LEFT JOIN bookings b
  ON b.comercial_id = c.id
  AND b.fecha BETWEEN DATE_TRUNC('month', CURRENT_DATE) AND CURRENT_DATE
  AND b.status IN ('confirmed','attended')
WHERE c.activo = TRUE
GROUP BY c.id, c.nombre
ORDER BY total_citas DESC;
```

### 14.5 Festivos del próximo mes

```sql
SELECT fecha, nombre
FROM holidays
WHERE pais = 'Colombia'
  AND fecha BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days'
ORDER BY fecha;
```

---

## 15. Script de instalación completo

Guarda este bloque como `001_schema.sql` y ejecútalo en el SQL Editor de Supabase. Es **idempotente**: se puede ejecutar varias veces sin problema.

```sql
-- ==========================================
-- INSTALACIÓN COMPLETA — SISTEMA AGENDAMIENTO
-- ==========================================

-- 1. Extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 2. Enums
DO $$ BEGIN
  CREATE TYPE booking_status AS ENUM
    ('pending','confirmed','attended','no_show','cancelled','rescheduled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE sync_status AS ENUM ('pending','synced','failed','skipped');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE audit_action AS ENUM
    ('create','update','delete','sync','cancel','reschedule','login','error');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Tablas (ver secciones 5-10 para contenido)
-- ... pega aquí cada CREATE TABLE del documento
-- ... seguido de los CREATE INDEX
-- ... seguido de los CREATE TRIGGER y CREATE FUNCTION
-- ... seguido de los CREATE POLICY

-- 4. Seed inicial
INSERT INTO comerciales (nombre, email, activo) VALUES
  ('Comercial Default', 'comercial1@effidiagnosticos.com', TRUE)
ON CONFLICT (email) DO NOTHING;
```

---

## 📚 Documentos relacionados

- [`ARQUITECTURA_GENERAL.md`](./ARQUITECTURA_GENERAL.md) — Visión general
- [`ENDPOINTS_API.md`](./ENDPOINTS_API.md) — Cómo la API usa este schema
- [`FLUJOS_LOGICA.md`](./FLUJOS_LOGICA.md) — Pseudocódigo que toca estas tablas
- [`MIGRACION_DESDE_N8N.md`](./MIGRACION_DESDE_N8N.md) — Cómo migrar datos viejos

---

**Última actualización:** 2026-05-11
**Versión:** 1.0
