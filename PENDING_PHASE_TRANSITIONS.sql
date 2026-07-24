-- =========================================================================
-- Motor Deportivo · Módulo de Transición Manual entre Fases
-- Ejecutar UNA VEZ en el SQL Editor de Supabase.
-- Idempotente: seguro re-correr.
-- =========================================================================

-- 1) Metadatos de clasificación en phase_participants
ALTER TABLE public.phase_participants
  ADD COLUMN IF NOT EXISTS source_phase_id uuid NULL REFERENCES public.phases(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_group_id uuid NULL REFERENCES public.groups(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_position int NULL,
  ADD COLUMN IF NOT EXISTS classified_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS classified_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS notes text NULL;

CREATE INDEX IF NOT EXISTS idx_phase_participants_team ON public.phase_participants(team_id);
CREATE INDEX IF NOT EXISTS idx_phase_participants_source_phase ON public.phase_participants(source_phase_id);
CREATE INDEX IF NOT EXISTS idx_phase_participants_source_group ON public.phase_participants(source_group_id);

-- 2) Validación: un equipo no puede estar en dos FASES ACTIVAS de la MISMA CATEGORÍA.
--    (En distintas categorías sí puede; en fases archivadas también, para conservar historial.)
CREATE OR REPLACE FUNCTION public.pp_check_one_active_phase_per_category()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_cat uuid;
  new_champ uuid;
  new_status text;
  conflict_count int;
BEGIN
  SELECT category_id, championship_id, status
    INTO new_cat, new_champ, new_status
  FROM public.phases WHERE id = NEW.phase_id;

  IF new_status <> 'active' THEN
    RETURN NEW; -- solo controlamos fases activas
  END IF;

  SELECT COUNT(*) INTO conflict_count
  FROM public.phase_participants pp
  JOIN public.phases ph ON ph.id = pp.phase_id
  WHERE pp.team_id = NEW.team_id
    AND ph.category_id = new_cat
    AND ph.championship_id = new_champ
    AND ph.status = 'active'
    AND pp.phase_id <> NEW.phase_id
    AND (TG_OP = 'INSERT' OR pp.id <> NEW.id);

  IF conflict_count > 0 THEN
    RAISE EXCEPTION 'El equipo ya está clasificado a otra fase activa de esta categoría.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS pp_one_active_phase_trg ON public.phase_participants;
CREATE TRIGGER pp_one_active_phase_trg
  BEFORE INSERT OR UPDATE ON public.phase_participants
  FOR EACH ROW EXECUTE FUNCTION public.pp_check_one_active_phase_per_category();

-- 3) Validación: no permitir eliminar un participante utilizado en partidos de esa misma fase.
CREATE OR REPLACE FUNCTION public.pp_block_delete_if_in_matches()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  used_count int;
BEGIN
  SELECT COUNT(*) INTO used_count
  FROM public.matches m
  WHERE m.phase_id = OLD.phase_id
    AND (m.home_team_id = OLD.team_id OR m.away_team_id = OLD.team_id);

  IF used_count > 0 THEN
    RAISE EXCEPTION 'No se puede quitar: el equipo participa en % partido(s) de esta fase.', used_count
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS pp_block_delete_if_in_matches_trg ON public.phase_participants;
CREATE TRIGGER pp_block_delete_if_in_matches_trg
  BEFORE DELETE ON public.phase_participants
  FOR EACH ROW EXECUTE FUNCTION public.pp_block_delete_if_in_matches();

-- 4) Validación: no permitir eliminar una fase con participantes o con partidos.
CREATE OR REPLACE FUNCTION public.phases_block_delete_if_used()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parts int;
  ms int;
BEGIN
  SELECT COUNT(*) INTO parts FROM public.phase_participants WHERE phase_id = OLD.id;
  SELECT COUNT(*) INTO ms FROM public.matches WHERE phase_id = OLD.id;
  IF parts > 0 THEN
    RAISE EXCEPTION 'No se puede eliminar la fase: tiene % participante(s). Quitalos primero.', parts
      USING ERRCODE = 'check_violation';
  END IF;
  IF ms > 0 THEN
    RAISE EXCEPTION 'No se puede eliminar la fase: tiene % partido(s).', ms
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS phases_block_delete_if_used_trg ON public.phases;
CREATE TRIGGER phases_block_delete_if_used_trg
  BEFORE DELETE ON public.phases
  FOR EACH ROW EXECUTE FUNCTION public.phases_block_delete_if_used();

-- =========================================================================
-- Notas:
--   • UNIQUE(phase_id, team_id) ya evita clasificar dos veces al mismo equipo
--     hacia la misma fase.
--   • ON DELETE de auth.users deja classified_by en NULL para no perder el
--     registro histórico (el equipo/origen quedan).
--   • RLS y GRANTs de phase_participants fueron creados en la migración
--     PENDING_MULTI_CHAMP_CONSOLIDATION.sql y siguen vigentes.
-- =========================================================================
