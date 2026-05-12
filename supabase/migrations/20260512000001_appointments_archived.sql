ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_appointments_archived
  ON public.appointments(booking_id, archived);
