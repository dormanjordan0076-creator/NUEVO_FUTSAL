-- ============================================================
-- FASE 1 · Multi-campeonato
-- Idempotente. Ejecutar en el SQL Editor de Supabase.
-- Requiere que RLS_DELEGADO.sql ya se haya corrido.
-- ============================================================

-- 1) Rol super_admin
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid
    WHERE t.typname = 'app_role' AND e.enumlabel = 'super_admin'
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'super_admin';
  END IF;
END $$;

-- 2) Columnas extendidas en championships
ALTER TABLE public.championships ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.championships ADD COLUMN IF NOT EXISTS season text;
ALTER TABLE public.championships ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE public.championships ADD COLUMN IF NOT EXISTS cover_url text;
ALTER TABLE public.championships ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE public.championships ADD COLUMN IF NOT EXISTS end_date date;
ALTER TABLE public.championships ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE public.championships ADD COLUMN IF NOT EXISTS organizer text;
ALTER TABLE public.championships ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'in_progress';
ALTER TABLE public.championships ADD COLUMN IF NOT EXISTS created_by uuid;

ALTER TABLE public.championships DROP CONSTRAINT IF EXISTS championships_status_check;
ALTER TABLE public.championships ADD CONSTRAINT championships_status_check
  CHECK (status IN ('draft','in_progress','finished','archived'));

-- 3) user_roles ahora se puede alcanzar por campeonato
ALTER TABLE public.user_roles ADD COLUMN IF NOT EXISTS championship_id uuid
  REFERENCES public.championships(id) ON DELETE CASCADE;

-- Único por (user, role, championship) — permite NULL para roles globales (super_admin)
DROP INDEX IF EXISTS user_roles_user_id_role_key;
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;
CREATE UNIQUE INDEX IF NOT EXISTS user_roles_user_role_champ_key
  ON public.user_roles(user_id, role, COALESCE(championship_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- 4) Migración de datos: TODO admin existente → super_admin (global, championship_id = NULL)
--    Los admin/delegado/arbitro existentes quedan además atados al campeonato activo.
DO $$
DECLARE active_champ uuid;
BEGIN
  SELECT id INTO active_champ FROM public.championships WHERE is_active = true ORDER BY created_at ASC LIMIT 1;

  IF active_champ IS NOT NULL THEN
    -- Asignar campeonato a los roles existentes sin championship_id
    UPDATE public.user_roles
       SET championship_id = active_champ
     WHERE championship_id IS NULL
       AND role IN ('admin','delegado','arbitro');

    -- Duplicar cada admin como super_admin global
    INSERT INTO public.user_roles (user_id, role, championship_id)
    SELECT DISTINCT user_id, 'super_admin'::app_role, NULL
      FROM public.user_roles
     WHERE role = 'admin'
       AND NOT EXISTS (
         SELECT 1 FROM public.user_roles ur2
          WHERE ur2.user_id = user_roles.user_id AND ur2.role = 'super_admin'
       );
  END IF;
END $$;

-- 5) Owner del campeonato existente
UPDATE public.championships c
   SET created_by = (SELECT user_id FROM public.user_roles WHERE role = 'super_admin' LIMIT 1)
 WHERE created_by IS NULL;

-- 6) Helpers
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin');
$$;

CREATE OR REPLACE FUNCTION public.has_role_in_championship(_role app_role, _champ uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
     WHERE user_id = auth.uid()
       AND role = _role
       AND (championship_id = _champ OR championship_id IS NULL)
  );
$$;

CREATE OR REPLACE FUNCTION public.user_championships()
RETURNS TABLE(championship_id uuid, role app_role) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  -- Si es super_admin, devuelve todos los campeonatos
  SELECT c.id, 'super_admin'::app_role
    FROM public.championships c
   WHERE EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'super_admin')
  UNION
  SELECT ur.championship_id, ur.role
    FROM public.user_roles ur
   WHERE ur.user_id = auth.uid()
     AND ur.championship_id IS NOT NULL;
$$;

GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role_in_championship(app_role, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_championships() TO authenticated;

-- 7) RLS · championships
ALTER TABLE public.championships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS championships_public_select ON public.championships;
CREATE POLICY championships_public_select ON public.championships FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS championships_super_all ON public.championships;
CREATE POLICY championships_super_all ON public.championships FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS championships_admin_update ON public.championships;
CREATE POLICY championships_admin_update ON public.championships FOR UPDATE TO authenticated
  USING (public.has_role_in_championship('admin', id))
  WITH CHECK (public.has_role_in_championship('admin', id));

-- 8) RLS · user_roles (super_admin gestiona todo; admin del campeonato gestiona su campeonato)
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_roles_self_select ON public.user_roles;
CREATE POLICY user_roles_self_select ON public.user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_super_admin() OR public.has_role_in_championship('admin', championship_id));

DROP POLICY IF EXISTS user_roles_super_all ON public.user_roles;
CREATE POLICY user_roles_super_all ON public.user_roles FOR ALL TO authenticated
  USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS user_roles_admin_all ON public.user_roles;
CREATE POLICY user_roles_admin_all ON public.user_roles FOR ALL TO authenticated
  USING (championship_id IS NOT NULL AND public.has_role_in_championship('admin', championship_id) AND role <> 'super_admin')
  WITH CHECK (championship_id IS NOT NULL AND public.has_role_in_championship('admin', championship_id) AND role <> 'super_admin');

-- ============================================================
-- FIN. Después de correr, recargá el schema cache (icono junto a Run).
-- ============================================================
