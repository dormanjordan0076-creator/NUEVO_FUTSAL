-- ============================================================
-- FASE 2 · Estructura deportiva multi-campeonato
-- Idempotente. Requiere PHASE1_MULTI_CHAMP.sql aplicado.
-- ============================================================

-- =========================================================
-- 1) Extender CATEGORIES
-- =========================================================
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS age_condition text;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS use_groups boolean NOT NULL DEFAULT false;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS groups_count int NOT NULL DEFAULT 0;

ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_status_check;
ALTER TABLE public.categories ADD CONSTRAINT categories_status_check
  CHECK (status IN ('active','paused','finished'));

CREATE UNIQUE INDEX IF NOT EXISTS categories_champ_name_key
  ON public.categories (championship_id, lower(name));

-- =========================================================
-- 2) GROUPS  (pertenecen a una categoría)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT groups_status_check CHECK (status IN ('active','paused','finished')),
  CONSTRAINT groups_category_name_key UNIQUE (category_id, name)
);

GRANT SELECT ON public.groups TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated;
GRANT ALL ON public.groups TO service_role;

-- =========================================================
-- 3) TEAM_PARTICIPATIONS  (participación del equipo por campeonato+categoría)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.team_participations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  championship_id uuid NOT NULL REFERENCES public.championships(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT team_participations_status_check CHECK (status IN ('active','withdrawn','disqualified','finished')),
  CONSTRAINT team_participations_unique UNIQUE (team_id, championship_id, category_id)
);

GRANT SELECT ON public.team_participations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_participations TO authenticated;
GRANT ALL ON public.team_participations TO service_role;

-- Trigger: group_id debe pertenecer a category_id
CREATE OR REPLACE FUNCTION public.tp_check_group_category()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.group_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.groups g WHERE g.id = NEW.group_id AND g.category_id = NEW.category_id) THEN
      RAISE EXCEPTION 'group_id % no pertenece a la categoría %', NEW.group_id, NEW.category_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tp_check_group_category_trg ON public.team_participations;
CREATE TRIGGER tp_check_group_category_trg
  BEFORE INSERT OR UPDATE ON public.team_participations
  FOR EACH ROW EXECUTE FUNCTION public.tp_check_group_category();

-- =========================================================
-- 4) PLAYER_REGISTRATIONS  (inscripción del jugador por participación)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.player_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  team_participation_id uuid NOT NULL REFERENCES public.team_participations(id) ON DELETE CASCADE,
  jersey_number int,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT player_registrations_status_check CHECK (status IN ('active','suspended','injured','disabled','released')),
  CONSTRAINT player_registrations_unique UNIQUE (team_participation_id, player_id),
  CONSTRAINT player_registrations_jersey_unique UNIQUE (team_participation_id, jersey_number)
);

GRANT SELECT ON public.player_registrations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_registrations TO authenticated;
GRANT ALL ON public.player_registrations TO service_role;

-- =========================================================
-- 5) TEAM_DELEGATES  (N:N entre usuarios y equipos, por campeonato)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.team_delegates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  championship_id uuid NOT NULL REFERENCES public.championships(id) ON DELETE CASCADE,
  role_label text DEFAULT 'principal',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT team_delegates_unique UNIQUE (user_id, team_id, championship_id)
);

GRANT SELECT ON public.team_delegates TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_delegates TO authenticated;
GRANT ALL ON public.team_delegates TO service_role;

-- =========================================================
-- 6) Migración de datos existentes (idempotente)
-- =========================================================
DO $$
DECLARE active_champ uuid;
BEGIN
  SELECT id INTO active_champ FROM public.championships WHERE is_active = true ORDER BY created_at ASC LIMIT 1;
  IF active_champ IS NULL THEN RETURN; END IF;

  -- 6a) Cada equipo con category_id → 1 participación
  INSERT INTO public.team_participations (team_id, championship_id, category_id, group_id, status)
  SELECT t.id, COALESCE(t.championship_id, active_champ), t.category_id, NULL, 'active'
    FROM public.teams t
   WHERE t.category_id IS NOT NULL
  ON CONFLICT (team_id, championship_id, category_id) DO NOTHING;

  -- 6b) Cada jugador → 1 inscripción (a la primera participación de su equipo)
  INSERT INTO public.player_registrations (player_id, team_participation_id, jersey_number, status)
  SELECT p.id, tp.id, p.jersey_number,
         CASE COALESCE(p.status,'activo')
           WHEN 'activo' THEN 'active'
           WHEN 'lesionado' THEN 'injured'
           WHEN 'suspendido' THEN 'suspended'
           WHEN 'inhabilitado' THEN 'disabled'
           ELSE 'active'
         END
    FROM public.players p
    JOIN public.team_participations tp ON tp.team_id = p.team_id
   WHERE tp.championship_id = active_champ
  ON CONFLICT (team_participation_id, player_id) DO NOTHING;

  -- 6c) Delegados existentes → team_delegates
  INSERT INTO public.team_delegates (user_id, team_id, championship_id, role_label)
  SELECT t.delegate_user_id, t.id, COALESCE(t.championship_id, active_champ), 'principal'
    FROM public.teams t
   WHERE t.delegate_user_id IS NOT NULL
  ON CONFLICT (user_id, team_id, championship_id) DO NOTHING;
END $$;

-- =========================================================
-- 7) Helpers de seguridad
-- =========================================================
CREATE OR REPLACE FUNCTION public.user_delegate_of_team(_team uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_delegates
     WHERE team_id = _team AND user_id = auth.uid()
    UNION
    SELECT 1 FROM public.teams
     WHERE id = _team AND delegate_user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.user_delegate_of_team(uuid) TO authenticated;

-- =========================================================
-- 8) RLS · groups
-- =========================================================
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS groups_public_select ON public.groups;
CREATE POLICY groups_public_select ON public.groups FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS groups_admin_all ON public.groups;
CREATE POLICY groups_admin_all ON public.groups FOR ALL TO authenticated
  USING (
    public.is_super_admin() OR EXISTS (
      SELECT 1 FROM public.categories c
       WHERE c.id = groups.category_id
         AND public.has_role_in_championship('admin', c.championship_id)
    )
  )
  WITH CHECK (
    public.is_super_admin() OR EXISTS (
      SELECT 1 FROM public.categories c
       WHERE c.id = groups.category_id
         AND public.has_role_in_championship('admin', c.championship_id)
    )
  );

-- =========================================================
-- 9) RLS · team_participations
-- =========================================================
ALTER TABLE public.team_participations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tp_public_select ON public.team_participations;
CREATE POLICY tp_public_select ON public.team_participations FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS tp_admin_all ON public.team_participations;
CREATE POLICY tp_admin_all ON public.team_participations FOR ALL TO authenticated
  USING (public.is_super_admin() OR public.has_role_in_championship('admin', championship_id))
  WITH CHECK (public.is_super_admin() OR public.has_role_in_championship('admin', championship_id));

-- =========================================================
-- 10) RLS · player_registrations
-- =========================================================
ALTER TABLE public.player_registrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pr_public_select ON public.player_registrations;
CREATE POLICY pr_public_select ON public.player_registrations FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS pr_admin_all ON public.player_registrations;
CREATE POLICY pr_admin_all ON public.player_registrations FOR ALL TO authenticated
  USING (
    public.is_super_admin() OR EXISTS (
      SELECT 1 FROM public.team_participations tp
       WHERE tp.id = player_registrations.team_participation_id
         AND public.has_role_in_championship('admin', tp.championship_id)
    )
  )
  WITH CHECK (
    public.is_super_admin() OR EXISTS (
      SELECT 1 FROM public.team_participations tp
       WHERE tp.id = player_registrations.team_participation_id
         AND public.has_role_in_championship('admin', tp.championship_id)
    )
  );

DROP POLICY IF EXISTS pr_delegate_all ON public.player_registrations;
CREATE POLICY pr_delegate_all ON public.player_registrations FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.team_participations tp
       WHERE tp.id = player_registrations.team_participation_id
         AND public.user_delegate_of_team(tp.team_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.team_participations tp
       WHERE tp.id = player_registrations.team_participation_id
         AND public.user_delegate_of_team(tp.team_id)
    )
  );

-- =========================================================
-- 11) RLS · team_delegates
-- =========================================================
ALTER TABLE public.team_delegates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS td_public_select ON public.team_delegates;
CREATE POLICY td_public_select ON public.team_delegates FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS td_admin_all ON public.team_delegates;
CREATE POLICY td_admin_all ON public.team_delegates FOR ALL TO authenticated
  USING (public.is_super_admin() OR public.has_role_in_championship('admin', championship_id))
  WITH CHECK (public.is_super_admin() OR public.has_role_in_championship('admin', championship_id));

-- ============================================================
-- FIN. Recargá el schema (icono de refrescar del SQL Editor).
-- ============================================================
