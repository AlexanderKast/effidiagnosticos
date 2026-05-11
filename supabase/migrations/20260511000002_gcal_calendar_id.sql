-- Agrega el ID del calendario de Google por booking config
-- Permite que cada booking apunte al calendario del comercial correspondiente
-- usando un solo token OAuth de la cuenta principal (delegated access)

ALTER TABLE public.booking_configs
  ADD COLUMN IF NOT EXISTS gcal_calendar_id TEXT NOT NULL DEFAULT 'primary';

COMMENT ON COLUMN public.booking_configs.gcal_calendar_id IS
  'ID del calendario de Google al que tiene acceso la cuenta principal (ej: juan@effi.com o primary)';
