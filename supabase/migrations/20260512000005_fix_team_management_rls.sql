-- ============================================================
-- FIX: los líderes (lider_area, lider_comercial_pais, lider_comercial)
-- no podían ver ni gestionar a su equipo porque:
--   1. "profiles" nunca tuvo policy para leer/editar perfiles ajenos
--      (solo "auth.uid() = user_id"), así que UsersManager solo
--      mostraba al propio líder, nunca a sus subordinados.
--   2. "commercial_calendars" solo tenía policy de SELECT para líderes,
--      no de UPDATE, así que no podían vincular un comercial a un usuario.
-- user_roles ya soportaba esto (user_roles_leaders_manage_team), por eso
-- David (lider_comercial_pais, Ecuador) veía el rol pero no el perfil
-- ni podía vincular/gestionar al comercial.
-- ============================================================

-- ── profiles: líderes ven y editan a su equipo ─────────────

DROP POLICY IF EXISTS "Leaders can view team profiles" ON public.profiles;
CREATE POLICY "Leaders can view team profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    public.get_user_role(auth.uid()) IN ('root', 'admin')
    OR (
      public.get_user_role(auth.uid()) IN ('lider_area', 'lider_comercial_pais', 'lider_comercial')
      AND user_id IN (SELECT subordinate_id FROM public.get_subordinate_user_ids(auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Leaders can update team profiles" ON public.profiles;
CREATE POLICY "Leaders can update team profiles"
  ON public.profiles FOR UPDATE TO authenticated
  USING (
    public.get_user_role(auth.uid()) IN ('root', 'admin')
    OR (
      public.get_user_role(auth.uid()) IN ('lider_area', 'lider_comercial_pais', 'lider_comercial')
      AND user_id IN (SELECT subordinate_id FROM public.get_subordinate_user_ids(auth.uid()))
    )
  );

-- ── commercial_calendars: líderes pueden vincular/desvincular ──
-- (ya podían ver todos vía "commercial_calendars_leaders_read";
--  faltaba poder actualizarlos para asignar el user_id)

DROP POLICY IF EXISTS "Leaders can link commercial_calendars" ON public.commercial_calendars;
CREATE POLICY "Leaders can link commercial_calendars"
  ON public.commercial_calendars FOR UPDATE TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('root', 'admin', 'lider_area', 'lider_comercial_pais', 'lider_comercial'))
  WITH CHECK (public.get_user_role(auth.uid()) IN ('root', 'admin', 'lider_area', 'lider_comercial_pais', 'lider_comercial'));
