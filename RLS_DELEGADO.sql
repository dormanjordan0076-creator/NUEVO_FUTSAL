-- ============================================================
-- MIGRACIÓN COMPLETA · Integración Futsal
-- Ejecutalo en el SQL Editor de Supabase.
-- Es 100% idempotente: podés correrlo cuantas veces quieras.
-- ============================================================

-- 0) Base
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- ============================================================
-- 1) TABLAS DEL COMITÉ (observaciones + resoluciones)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.match_observations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  created_by uuid,
  observation_type text NOT NULL DEFAULT 'general',
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pendiente',
  admin_response text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Añadir columnas que pudieran faltar (idempotente)
ALTER TABLE public.match_observations ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';
ALTER TABLE public.match_observations ADD COLUMN IF NOT EXISTS observation_type text NOT NULL DEFAULT 'general';
ALTER TABLE public.match_observations ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pendiente';
ALTER TABLE public.match_observations ADD COLUMN IF NOT EXISTS admin_response text;
ALTER TABLE public.match_observations ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.match_observations ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.match_observations ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Estados válidos
ALTER TABLE public.match_observations DROP CONSTRAINT IF EXISTS match_observations_status_check;
ALTER TABLE public.match_observations ADD CONSTRAINT match_observations_status_check
  CHECK (status IN ('pendiente','en_revision','aceptada','rechazada','resuelta'));

CREATE TABLE IF NOT EXISTS public.match_resolutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  observation_id uuid REFERENCES public.match_observations(id) ON DELETE CASCADE,
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  pdf_url text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.match_resolutions ADD COLUMN IF NOT EXISTS observation_id uuid;
ALTER TABLE public.match_resolutions ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.match_resolutions ADD COLUMN IF NOT EXISTS pdf_url text;
ALTER TABLE public.match_resolutions ADD COLUMN IF NOT EXISTS created_by uuid;
ALTER TABLE public.match_resolutions ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- Trigger updated_at para observaciones
CREATE OR REPLACE FUNCTION public.tg_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
DROP TRIGGER IF EXISTS match_observations_touch ON public.match_observations;
CREATE TRIGGER match_observations_touch BEFORE UPDATE ON public.match_observations
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_updated_at();

-- ============================================================
-- 2) PLANILLA · columnas nuevas en matches (nullable, no rompe nada)
-- ============================================================
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS referee_second text;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS timekeeper text;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS control_table text;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS match_number text;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL;

-- ============================================================
-- 3) ARQUITECTURA CONFIGURABLE (Prioridad 5 · sin lógica todavía)
-- ============================================================
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS format_config jsonb;

CREATE TABLE IF NOT EXISTS public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  phase_type text NOT NULL DEFAULT 'grupos',
  sort_order int NOT NULL DEFAULT 0,
  config jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS phase_id uuid REFERENCES public.phases(id) ON DELETE SET NULL;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL;

-- ============================================================
-- 4) HELPER: aplicar GRANTs sólo si la tabla existe
-- ============================================================
CREATE OR REPLACE FUNCTION public.grant_if_exists(
  _table text,
  _grantees text[],
  _privileges text
) RETURNS void LANGUAGE plpgsql AS $$
DECLARE g text;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name=_table) THEN
    FOREACH g IN ARRAY _grantees LOOP
      EXECUTE format('GRANT %s ON public.%I TO %I', _privileges, _table, g);
    END LOOP;
  END IF;
END;
$$;

-- Lectura pública
SELECT public.grant_if_exists(unnest, ARRAY['anon','authenticated'], 'SELECT')
FROM unnest(ARRAY[
  'teams','players','matches','match_events','categories','championships',
  'suspensions','match_resolutions','news','groups','phases'
]);

-- Escritura autenticada
SELECT public.grant_if_exists(unnest, ARRAY['authenticated'], 'SELECT, INSERT, UPDATE, DELETE')
FROM unnest(ARRAY[
  'teams','players','matches','match_events','categories','championships',
  'suspensions','match_observations','match_resolutions','user_roles','profiles',
  'news','groups','phases'
]);

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role, authenticated;

-- ============================================================
-- 5) HELPER: ¿es delegado del equipo?
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_team_delegate(_team_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.teams WHERE id = _team_id AND delegate_user_id = auth.uid());
$$;

-- ============================================================
-- 6) RLS · teams
-- ============================================================
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS teams_public_select ON public.teams;
CREATE POLICY teams_public_select ON public.teams FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS teams_admin_all ON public.teams;
CREATE POLICY teams_admin_all ON public.teams FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
DROP POLICY IF EXISTS teams_delegate_update ON public.teams;
CREATE POLICY teams_delegate_update ON public.teams FOR UPDATE TO authenticated
  USING (delegate_user_id = auth.uid()) WITH CHECK (delegate_user_id = auth.uid());

-- ============================================================
-- 7) RLS · players
-- ============================================================
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS players_public_select ON public.players;
CREATE POLICY players_public_select ON public.players FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS players_admin_all ON public.players;
CREATE POLICY players_admin_all ON public.players FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));
DROP POLICY IF EXISTS players_delegate_all ON public.players;
CREATE POLICY players_delegate_all ON public.players FOR ALL TO authenticated
  USING (public.is_team_delegate(team_id)) WITH CHECK (public.is_team_delegate(team_id));

-- ============================================================
-- 8) RLS · match_observations
--    Delegado: crea/lee/edita las de su equipo mientras estén pendientes.
--    Admin: todo.
-- ============================================================
ALTER TABLE public.match_observations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS observations_admin_all ON public.match_observations;
CREATE POLICY observations_admin_all ON public.match_observations FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

DROP POLICY IF EXISTS observations_delegate_select ON public.match_observations;
CREATE POLICY observations_delegate_select ON public.match_observations FOR SELECT TO authenticated
  USING (public.is_team_delegate(team_id));

DROP POLICY IF EXISTS observations_delegate_insert ON public.match_observations;
CREATE POLICY observations_delegate_insert ON public.match_observations FOR INSERT TO authenticated
  WITH CHECK (public.is_team_delegate(team_id) AND created_by = auth.uid());

DROP POLICY IF EXISTS observations_delegate_update ON public.match_observations;
CREATE POLICY observations_delegate_update ON public.match_observations FOR UPDATE TO authenticated
  USING (public.is_team_delegate(team_id) AND status = 'pendiente')
  WITH CHECK (public.is_team_delegate(team_id) AND status IN ('pendiente','en_revision'));

DROP POLICY IF EXISTS observations_delegate_delete ON public.match_observations;
CREATE POLICY observations_delegate_delete ON public.match_observations FOR DELETE TO authenticated
  USING (public.is_team_delegate(team_id) AND status = 'pendiente');

-- ============================================================
-- 9) RLS · match_resolutions (público lee; admin crea/edita)
-- ============================================================
ALTER TABLE public.match_resolutions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS resolutions_public_select ON public.match_resolutions;
CREATE POLICY resolutions_public_select ON public.match_resolutions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS resolutions_admin_all ON public.match_resolutions;
CREATE POLICY resolutions_admin_all ON public.match_resolutions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

-- ============================================================
-- 10) RLS · groups / phases (admin-only por ahora)
-- ============================================================
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS groups_public_select ON public.groups;
CREATE POLICY groups_public_select ON public.groups FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS groups_admin_all ON public.groups;
CREATE POLICY groups_admin_all ON public.groups FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

ALTER TABLE public.phases ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS phases_public_select ON public.phases;
CREATE POLICY phases_public_select ON public.phases FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS phases_admin_all ON public.phases;
CREATE POLICY phases_admin_all ON public.phases FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role));

-- ============================================================
-- 11) STORAGE · buckets y policies
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES
  ('team-logos','team-logos', true),
  ('player-photos','player-photos', true),
  ('resoluciones','resoluciones', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "auth write logos" ON storage.objects;
CREATE POLICY "auth write logos" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id IN ('team-logos','player-photos','resoluciones'))
  WITH CHECK (bucket_id IN ('team-logos','player-photos','resoluciones'));

-- ============================================================
-- FIN. Ejecutar y recargar el schema cache desde el SQL Editor
-- (icono de refrescar junto al botón Run).
-- ============================================================
