-- Tabla de comerciales con sus calendarios de Google
-- Permite agrupar por país y asignar a bookings con dropdown

CREATE TABLE public.commercial_calendars (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  commercial_id   INTEGER,                          -- ID legado del Google Sheet
  name            TEXT NOT NULL,
  email           TEXT NOT NULL,
  calendar_id     TEXT NOT NULL,                    -- ID del calendario compartido (normalmente = email)
  status          TEXT NOT NULL DEFAULT 'active'
                  CHECK (status IN ('active', 'inactive')),
  empresa         TEXT,
  country         TEXT NOT NULL DEFAULT 'CO',       -- ISO 3166-1 alpha-2
  created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_commercial_calendars_country ON public.commercial_calendars(country);
CREATE INDEX idx_commercial_calendars_status  ON public.commercial_calendars(status);

ALTER TABLE public.commercial_calendars ENABLE ROW LEVEL SECURITY;

-- Admins gestionan, público no puede ver emails de comerciales
CREATE POLICY "Admins can manage commercial_calendars"
  ON public.commercial_calendars FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role full access on commercial_calendars"
  ON public.commercial_calendars FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER update_commercial_calendars_updated_at
  BEFORE UPDATE ON public.commercial_calendars
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed: comerciales existentes del Google Sheet
INSERT INTO public.commercial_calendars
  (commercial_id, name, email, calendar_id, status, empresa, country)
VALUES
  (3,  'Geraldine Saldarriaga',   'comercial3.effixonline@gmail.com',  'comercial3.effixonline@gmail.com',  'active', NULL, 'CO'),
  (4,  'Disneida Carvajal',        'comercial4.efficommerce@gmail.com', 'comercial4.efficommerce@gmail.com', 'active', NULL, 'CO'),
  (5,  'Diana Marcela Martinez',   'comercial4.effisystems@gmail.com',  'comercial4.effisystems@gmail.com',  'active', NULL, 'CO'),
  (6,  'Sandra Milena Quitero',    'comercial5.effisystems@gmail.com',  'comercial5.effisystems@gmail.com',  'active', NULL, 'CO'),
  (7,  'Yulieth Marcela Patiño',   'comercial7.efficommerce@gmail.com', 'comercial7.efficommerce@gmail.com', 'active', NULL, 'CO'),
  (8,  'Yuliana Shirley Sanchez',  'comercial7.effisystems@gmail.com',  'comercial7.effisystems@gmail.com',  'active', NULL, 'CO'),
  (9,  'Nidia Lucia Jaramillo',    'comercial8.efficommerce@gmail.com', 'comercial8.efficommerce@gmail.com', 'active', NULL, 'CO'),
  (10, 'Manuela Herrera',          'comercial1.efficommerce@gmail.com', 'comercial1.efficommerce@gmail.com', 'active', NULL, 'CO'),
  (11, 'Fabricio Peredo',          'comercial3.efficommerce@gmail.com', 'comercial3.efficommerce@gmail.com', 'active', NULL, 'CO'),
  (12, 'Keith Miranda Manjarrez',  'comercial5.efficommerce@gmail.com', 'comercial5.efficommerce@gmail.com', 'active', NULL, 'CO');
