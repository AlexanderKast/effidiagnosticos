-- =============================================================================
-- Seed: Grupos comerciales por país
-- Idempotente: no inserta si ya existe un grupo con ese country
-- =============================================================================

-- 1. Crear los grupos
INSERT INTO public.commercial_groups (name, description, country, active)
SELECT v.name, v.description, v.country, v.active
FROM (VALUES
  ('Equipo Guatemala',       'Equipo comercial Guatemala',       'GT', true),
  ('Equipo Costa Rica',      'Equipo comercial Costa Rica',      'CR', true),
  ('Equipo Rep. Dominicana', 'Equipo comercial Rep. Dominicana', 'DO', true),
  ('Equipo Ecuador',         'Equipo comercial Ecuador',         'EC', true)
) AS v(name, description, country, active)
WHERE NOT EXISTS (
  SELECT 1 FROM public.commercial_groups g WHERE g.country = v.country
);

-- 2. Asignar todos los comerciales activos a su grupo de país
INSERT INTO public.commercial_group_members (group_id, commercial_id)
SELECT g.id, c.id
FROM public.commercial_groups g
JOIN public.commercial_calendars c
  ON c.country = g.country
 AND c.status  = 'active'
WHERE g.country IN ('GT', 'CR', 'DO', 'EC')
ON CONFLICT DO NOTHING;

-- 3. Verificación: grupos con sus miembros
SELECT
  g.country,
  g.name   AS grupo,
  COUNT(m.commercial_id) AS miembros
FROM public.commercial_groups g
LEFT JOIN public.commercial_group_members m ON m.group_id = g.id
GROUP BY g.id, g.country, g.name
ORDER BY g.country;
