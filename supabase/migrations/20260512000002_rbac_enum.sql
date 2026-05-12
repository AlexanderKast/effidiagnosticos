-- Extender app_role enum con roles del área comercial
-- DEBE ir en migration separada porque los nuevos valores
-- no se pueden usar en el mismo transaction en PG < 16

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'root';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'lider_area';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'lider_comercial_pais';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'lider_comercial';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'comercial';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'setter';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'closer';
