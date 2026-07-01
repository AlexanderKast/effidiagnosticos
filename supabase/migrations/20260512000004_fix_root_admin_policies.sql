-- ============================================================
-- FIX: políticas que quedaron atadas solo a has_role('admin')
-- después de la migración RBAC, que promovió a los admins a 'root'.
-- Sin esto, ningún usuario puede gestionar bookings, grupos
-- comerciales, calendarios comerciales, roles o audit_log.
-- ============================================================

-- ── user_roles ──────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('root', 'admin'));

-- ── booking_configs ─────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can view all bookings" ON public.booking_configs;
CREATE POLICY "Admins can view all bookings"
  ON public.booking_configs FOR SELECT TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('root', 'admin'));

DROP POLICY IF EXISTS "Admins can insert bookings" ON public.booking_configs;
CREATE POLICY "Admins can insert bookings"
  ON public.booking_configs FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role(auth.uid()) IN ('root', 'admin'));

DROP POLICY IF EXISTS "Admins can update bookings" ON public.booking_configs;
CREATE POLICY "Admins can update bookings"
  ON public.booking_configs FOR UPDATE TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('root', 'admin'));

DROP POLICY IF EXISTS "Admins can delete bookings" ON public.booking_configs;
CREATE POLICY "Admins can delete bookings"
  ON public.booking_configs FOR DELETE TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('root', 'admin'));

-- ── commercial_groups / commercial_group_members ───────────
DROP POLICY IF EXISTS "Admins manage commercial_groups" ON public.commercial_groups;
CREATE POLICY "Admins manage commercial_groups"
  ON public.commercial_groups FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('root', 'admin'))
  WITH CHECK (public.get_user_role(auth.uid()) IN ('root', 'admin'));

DROP POLICY IF EXISTS "Admins manage group_members" ON public.commercial_group_members;
CREATE POLICY "Admins manage group_members"
  ON public.commercial_group_members FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('root', 'admin'))
  WITH CHECK (public.get_user_role(auth.uid()) IN ('root', 'admin'));

-- ── commercial_calendars ────────────────────────────────────
DROP POLICY IF EXISTS "Admins can manage commercial_calendars" ON public.commercial_calendars;
CREATE POLICY "Admins can manage commercial_calendars"
  ON public.commercial_calendars FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('root', 'admin'))
  WITH CHECK (public.get_user_role(auth.uid()) IN ('root', 'admin'));

-- ── audit_log ───────────────────────────────────────────────
DROP POLICY IF EXISTS "Admins can read audit log" ON public.audit_log;
CREATE POLICY "Admins can read audit log"
  ON public.audit_log FOR SELECT TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('root', 'admin'));
