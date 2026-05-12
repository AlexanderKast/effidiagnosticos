-- ============================================================
-- MIGRATION: Columnas CRM en appointments
-- ============================================================

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS assigned_commercial_name TEXT,
  ADD COLUMN IF NOT EXISTS crm_venta_realizada      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS crm_tipo_marketing       TEXT,
  ADD COLUMN IF NOT EXISTS crm_tipo_cliente         TEXT
    CHECK (crm_tipo_cliente IN (
      'Mercaderia Propia','Free Ecommerce','Dropshipping','Servicios Effi','Mixto'
    )),
  ADD COLUMN IF NOT EXISTS crm_monto_venta          NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS crm_estado_cliente       TEXT
    CHECK (crm_estado_cliente IN (
      'Cerrado','Proceso de cierre','Descartado','Gestión',
      'Pendiente de respuesta','Cliente registrado',
      'NO Interesado','Trabajo','Mentorias'
    )),
  ADD COLUMN IF NOT EXISTS crm_observaciones        TEXT,
  ADD COLUMN IF NOT EXISTS crm_canal_origen         TEXT
    CHECK (crm_canal_origen IN (
      'WhatsApp','Calendario','Instagram','Facebook','TikTok',
      'Referido','Llamada','Email','Otro'
    ));

CREATE INDEX IF NOT EXISTS idx_appointments_crm_estado
  ON public.appointments(booking_id, crm_estado_cliente);

CREATE INDEX IF NOT EXISTS idx_appointments_crm_venta
  ON public.appointments(booking_id, crm_venta_realizada);
