-- ============================================================
-- Consolidación multi-campeonato (PENDIENTE de aplicar)
-- Ejecutar manualmente en el proyecto Supabase uxwntlunyeykrzoymart
-- desde SQL Editor o mediante `supabase db push`.
-- Idempotente.
-- ============================================================

-- 0) Defensivo: asegurar columnas críticas en tablas preexistentes
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS championship_id uuid REFERENCES public.championships(id) ON DELETE CASCADE;

-- 1) CATEGORIES · columnas nuevas
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS age_condition text;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS use_groups boolean NOT NULL DEFAULT false;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS groups_count int NOT NULL DEFAULT 0;
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS display_order int NOT NULL DEFAULT 0;
ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_status_check;
ALTER TABLE public.categories ADD CONSTRAINT categories_status_check
  CHECK (status IN ('active','paused','finished'));

-- 2) CHAMPIONSHIPS · campos opcionales de configuración
ALTER TABLE public.championships ADD COLUMN IF NOT EXISTS status text;
ALTER TABLE public.championships ADD COLUMN IF NOT EXISTS season text;
ALTER TABLE public.championships ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.championships ADD COLUMN IF NOT EXISTS location text;
ALTER TABLE public.championships ADD COLUMN IF NOT EXISTS organizer text;
ALTER TABLE public.championships ADD COLUMN IF NOT EXISTS logo_url text;
ALTER TABLE public.championships ADD COLUMN IF NOT EXISTS cover_url text;
ALTER TABLE public.championships ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE public.championships ADD COLUMN IF NOT EXISTS end_date date;

-- 3) GROUPS (championship_id + category_id + display_order)
CREATE TABLE IF NOT EXISTS public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  championship_id uuid REFERENCES public.championships(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  display_order int NOT NULL DEFAULT 0,
  sort_order int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT groups_status_check CHECK (status IN ('active','paused','finished')),
  CONSTRAINT groups_category_name_key UNIQUE (category_id, name)
);
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS championship_id uuid REFERENCES public.championships(id) ON DELETE CASCADE;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS display_order int NOT NULL DEFAULT 0;

GRANT SELECT ON public.groups TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated;
GRANT ALL ON public.groups TO service_role;

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "groups readable by all" ON public.groups;
CREATE POLICY "groups readable by all" ON public.groups FOR SELECT USING (true);
DROP POLICY IF EXISTS "admins manage groups" ON public.groups;
CREATE POLICY "admins manage groups" ON public.groups FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4) TEAM_PARTICIPATIONS
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

-- Defensive: si la tabla ya existía sin estas columnas (corrida parcial previa)
ALTER TABLE public.team_participations ADD COLUMN IF NOT EXISTS championship_id uuid REFERENCES public.championships(id) ON DELETE CASCADE;
ALTER TABLE public.team_participations ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.categories(id) ON DELETE CASCADE;
ALTER TABLE public.team_participations ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL;
ALTER TABLE public.team_participations ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

GRANT SELECT ON public.team_participations TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_participations TO authenticated;
GRANT ALL ON public.team_participations TO service_role;

ALTER TABLE public.team_participations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "team_participations readable by all" ON public.team_participations;
CREATE POLICY "team_participations readable by all" ON public.team_participations FOR SELECT USING (true);
DROP POLICY IF EXISTS "admins manage team_participations" ON public.team_participations;
CREATE POLICY "admins manage team_participations" ON public.team_participations FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

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

-- 5) Índices
CREATE INDEX IF NOT EXISTS idx_groups_championship ON public.groups(championship_id);
CREATE INDEX IF NOT EXISTS idx_groups_category ON public.groups(category_id);
CREATE INDEX IF NOT EXISTS idx_tp_championship ON public.team_participations(championship_id);
CREATE INDEX IF NOT EXISTS idx_tp_team ON public.team_participations(team_id);
CREATE INDEX IF NOT EXISTS idx_tp_category ON public.team_participations(category_id);

-- ============================================================
-- 6) MOTOR DEPORTIVO: fases configurables por categoría
-- ============================================================

CREATE TABLE IF NOT EXISTS public.phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  championship_id uuid NOT NULL REFERENCES public.championships(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'liga',
  display_order int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT phases_kind_check CHECK (kind IN ('grupos','liga','eliminacion','ida_vuelta','manual')),
  CONSTRAINT phases_status_check CHECK (status IN ('active','archived'))
);

-- Defensive: si phases ya existía sin estas columnas
ALTER TABLE public.phases ADD COLUMN IF NOT EXISTS championship_id uuid REFERENCES public.championships(id) ON DELETE CASCADE;
ALTER TABLE public.phases ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.categories(id) ON DELETE CASCADE;
ALTER TABLE public.phases ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'liga';
ALTER TABLE public.phases ADD COLUMN IF NOT EXISTS display_order int NOT NULL DEFAULT 0;
ALTER TABLE public.phases ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';

GRANT SELECT ON public.phases TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.phases TO authenticated;
GRANT ALL ON public.phases TO service_role;

ALTER TABLE public.phases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "phases readable by all" ON public.phases;
CREATE POLICY "phases readable by all" ON public.phases FOR SELECT USING (true);
DROP POLICY IF EXISTS "admins manage phases" ON public.phases;
CREATE POLICY "admins manage phases" ON public.phases FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_phases_championship ON public.phases(championship_id);
CREATE INDEX IF NOT EXISTS idx_phases_category_order ON public.phases(category_id, display_order);

CREATE TABLE IF NOT EXISTS public.phase_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phase_id uuid NOT NULL REFERENCES public.phases(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  seed int NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT phase_participants_unique UNIQUE (phase_id, team_id)
);

GRANT SELECT ON public.phase_participants TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.phase_participants TO authenticated;
GRANT ALL ON public.phase_participants TO service_role;

ALTER TABLE public.phase_participants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "phase_participants readable by all" ON public.phase_participants;
CREATE POLICY "phase_participants readable by all" ON public.phase_participants FOR SELECT USING (true);
DROP POLICY IF EXISTS "admins manage phase_participants" ON public.phase_participants;
CREATE POLICY "admins manage phase_participants" ON public.phase_participants FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS idx_phase_participants_phase ON public.phase_participants(phase_id);

-- matches.phase_id (opcional, nullable para no romper partidos existentes)
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS phase_id uuid NULL REFERENCES public.phases(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_matches_phase ON public.matches(phase_id);
