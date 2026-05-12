-- ============================================================
-- MIGRATION: RBAC completo para área comercial
-- Depende de 20260512000002_rbac_enum.sql (enum ya extendido)
-- ============================================================

-- ── 1. user_roles: un rol por usuario + jerarquía ──────────────

-- Limpiar duplicados (keep el más antiguo por usuario)
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at) AS rn
  FROM user_roles
)
DELETE FROM user_roles WHERE id IN (SELECT id FROM ranked WHERE rn > 1);

-- Cambiar a único por usuario (era por user_id+role)
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_key UNIQUE (user_id);

-- Campos de jerarquía y contexto
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS reports_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS country    TEXT DEFAULT 'CO',
  ADD COLUMN IF NOT EXISTS area       TEXT;

-- ── 2. commercial_calendars: link a auth.users ─────────────────

ALTER TABLE public.commercial_calendars
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL UNIQUE;

-- ── 3. Funciones helper (SECURITY DEFINER bypass RLS) ──────────

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS public.app_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_user_country(_user_id UUID)
RETURNS TEXT
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT country FROM public.user_roles WHERE user_id = _user_id LIMIT 1;
$$;

-- Retorna todos los subordinados (directos + indirectos)
CREATE OR REPLACE FUNCTION public.get_subordinate_user_ids(_leader_id UUID)
RETURNS TABLE(subordinate_id UUID)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH RECURSIVE sub AS (
    SELECT user_id FROM public.user_roles WHERE reports_to = _leader_id
    UNION ALL
    SELECT ur.user_id FROM public.user_roles ur
    INNER JOIN sub s ON ur.reports_to = s.user_id
  )
  SELECT user_id FROM sub;
$$;

-- Función principal de visibilidad de appointments
CREATE OR REPLACE FUNCTION public.can_view_appointment(_assigned_commercial_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_role    public.app_role;
  v_country TEXT;
BEGIN
  v_role := public.get_user_role(auth.uid());

  -- root / admin / lider_area ven todo
  IF v_role IN ('root', 'admin', 'lider_area') THEN
    RETURN true;
  END IF;

  -- Sin asignación → solo admins (ya cubierto arriba)
  IF _assigned_commercial_id IS NULL THEN
    RETURN false;
  END IF;

  -- lider_comercial_pais: ve comerciales de su país
  IF v_role = 'lider_comercial_pais' THEN
    v_country := public.get_user_country(auth.uid());
    RETURN EXISTS (
      SELECT 1 FROM public.commercial_calendars cc
      JOIN public.user_roles ur ON ur.user_id = cc.user_id
      WHERE cc.id = _assigned_commercial_id
        AND ur.country = v_country
    );
  END IF;

  -- lider_comercial: ve su equipo completo (recursivo)
  IF v_role = 'lider_comercial' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.commercial_calendars cc
      WHERE cc.id = _assigned_commercial_id
        AND (
          cc.user_id IN (SELECT subordinate_id FROM public.get_subordinate_user_ids(auth.uid()))
          OR cc.user_id = auth.uid()
        )
    );
  END IF;

  -- comercial / setter / closer: solo los suyos
  IF v_role IN ('comercial', 'setter', 'closer') THEN
    RETURN EXISTS (
      SELECT 1 FROM public.commercial_calendars
      WHERE id = _assigned_commercial_id AND user_id = auth.uid()
    );
  END IF;

  RETURN false;
END;
$$;

-- Función para verificar si puede reasignar el comercial
CREATE OR REPLACE FUNCTION public.can_reassign_commercial()
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.get_user_role(auth.uid()) IN ('root', 'admin', 'lider_area', 'lider_comercial_pais', 'lider_comercial');
$$;

-- ── 4. RLS appointments: reemplazar políticas admin-only ───────

DROP POLICY IF EXISTS "Admins can read all appointments"   ON public.appointments;
DROP POLICY IF EXISTS "Admins can update appointments"     ON public.appointments;
DROP POLICY IF EXISTS "Admins can delete appointments"     ON public.appointments;

-- SELECT: visibilidad por rol (usa función SECURITY DEFINER)
CREATE POLICY "appointments_select_rbac"
  ON public.appointments FOR SELECT TO authenticated
  USING (public.can_view_appointment(assigned_commercial_id));

-- UPDATE: cualquier rol que puede ver el registro puede actualizarlo
-- (la restricción de qué campos puede cambiar se aplica con el trigger)
CREATE POLICY "appointments_update_rbac"
  ON public.appointments FOR UPDATE TO authenticated
  USING (public.can_view_appointment(assigned_commercial_id));

-- DELETE: solo admin/root
CREATE POLICY "appointments_delete_rbac"
  ON public.appointments FOR DELETE TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('root', 'admin'));

-- ── 5. Trigger: impedir reasignación no autorizada ─────────────

CREATE OR REPLACE FUNCTION public.enforce_commercial_assignment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Si la asignación no cambió, no hay nada que verificar
  IF NEW.assigned_commercial_id IS NOT DISTINCT FROM OLD.assigned_commercial_id THEN
    RETURN NEW;
  END IF;
  -- Solo líderes y admins pueden reasignar
  IF NOT public.can_reassign_commercial() THEN
    RAISE EXCEPTION 'No tienes permisos para cambiar el comercial asignado';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_commercial_assignment ON public.appointments;
CREATE TRIGGER trg_enforce_commercial_assignment
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_commercial_assignment();

-- ── 6. RLS commercial_calendars: ampliar acceso ────────────────

-- Usuarios ven su propio perfil de comercial (para auto-asignación y login)
CREATE POLICY "commercial_calendars_own_profile"
  ON public.commercial_calendars FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Líderes ven todos los comerciales (para dropdown de reasignación)
CREATE POLICY "commercial_calendars_leaders_read"
  ON public.commercial_calendars FOR SELECT TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('root', 'admin', 'lider_area', 'lider_comercial_pais', 'lider_comercial'));

-- ── 7. RLS user_roles: líderes gestionan su equipo ─────────────

-- Ver y modificar roles de subordinados
CREATE POLICY "user_roles_leaders_manage_team"
  ON public.user_roles FOR ALL TO authenticated
  USING (
    public.get_user_role(auth.uid()) IN ('root', 'admin')
    OR (
      public.get_user_role(auth.uid()) IN ('lider_area', 'lider_comercial_pais', 'lider_comercial')
      AND user_id IN (SELECT subordinate_id FROM public.get_subordinate_user_ids(auth.uid()))
    )
  );
