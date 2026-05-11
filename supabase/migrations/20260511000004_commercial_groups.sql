-- Grupos de comerciales para asignación automática en bookings
-- Un booking puede ir a un comercial específico O a un grupo (round-robin)

CREATE TABLE public.commercial_groups (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,           -- "Equipo Colombia", "Soporte MX"
  description TEXT,
  country     TEXT,                    -- NULL = grupo multi-país
  active      BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.commercial_group_members (
  group_id      UUID NOT NULL REFERENCES public.commercial_groups(id) ON DELETE CASCADE,
  commercial_id UUID NOT NULL REFERENCES public.commercial_calendars(id) ON DELETE CASCADE,
  PRIMARY KEY (group_id, commercial_id)
);

ALTER TABLE public.commercial_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage commercial_groups"
  ON public.commercial_groups FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role on commercial_groups"
  ON public.commercial_groups FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Admins manage group_members"
  ON public.commercial_group_members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role on group_members"
  ON public.commercial_group_members FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER update_commercial_groups_updated_at
  BEFORE UPDATE ON public.commercial_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Cambios en booking_configs
ALTER TABLE public.booking_configs
  ADD COLUMN IF NOT EXISTS assignment_type TEXT NOT NULL DEFAULT 'individual'
    CHECK (assignment_type IN ('individual', 'group')),
  ADD COLUMN IF NOT EXISTS commercial_group_id UUID REFERENCES public.commercial_groups(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.booking_configs.assignment_type IS
  'individual = un comercial fijo, group = round-robin entre miembros del grupo';
COMMENT ON COLUMN public.booking_configs.commercial_group_id IS
  'Grupo al que pertenece el booking cuando assignment_type = group';

-- Campo en appointments para saber qué comercial fue asignado
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS assigned_commercial_id UUID REFERENCES public.commercial_calendars(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.appointments.assigned_commercial_id IS
  'Comercial asignado al crear la cita (relevante cuando booking es de tipo group)';
