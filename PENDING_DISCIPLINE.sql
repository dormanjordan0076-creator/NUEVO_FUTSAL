-- =====================================================================
-- FASE 4 — Disciplina: sanciones de jugadores
-- Ejecutar manualmente. Idempotente.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.player_sanctions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  championship_id   uuid NOT NULL REFERENCES public.championships(id) ON DELETE CASCADE,
  category_id       uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  player_id         uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  team_id           uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  -- Origen: 'roja' (tarjeta directa), 'acumulacion' (5 amarillas), 'comite' (resolución)
  source            text NOT NULL CHECK (source IN ('roja','acumulacion','comite')),
  reason            text,
  match_id          uuid REFERENCES public.matches(id) ON DELETE SET NULL,
  observation_id    uuid REFERENCES public.match_observations(id) ON DELETE SET NULL,
  matches_total     integer NOT NULL CHECK (matches_total > 0),
  matches_served    integer NOT NULL DEFAULT 0 CHECK (matches_served >= 0),
  status            text NOT NULL DEFAULT 'activa' CHECK (status IN ('activa','cumplida','anulada')),
  created_by        uuid REFERENCES auth.users(id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_player_sanctions_champ    ON public.player_sanctions(championship_id);
CREATE INDEX IF NOT EXISTS idx_player_sanctions_player   ON public.player_sanctions(player_id);
CREATE INDEX IF NOT EXISTS idx_player_sanctions_status   ON public.player_sanctions(status);

-- GRANTS (Data API)
GRANT SELECT ON public.player_sanctions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.player_sanctions TO authenticated;
GRANT ALL ON public.player_sanctions TO service_role;

-- RLS
ALTER TABLE public.player_sanctions ENABLE ROW LEVEL SECURITY;

-- Lectura pública (mismo criterio que estadísticas)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname='public' AND tablename='player_sanctions'
       AND policyname='sanctions_read_all'
  ) THEN
    CREATE POLICY "sanctions_read_all" ON public.player_sanctions
      FOR SELECT USING (true);
  END IF;
END $$;

-- Escritura: admins (el comité opera como admin en este proyecto)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
     WHERE schemaname='public' AND tablename='player_sanctions'
       AND policyname='sanctions_admin_write'
  ) THEN
    CREATE POLICY "sanctions_admin_write" ON public.player_sanctions
      FOR ALL TO authenticated
      USING (public.has_role(auth.uid(),'admin'))
      WITH CHECK (public.has_role(auth.uid(),'admin'));
  END IF;
END $$;

-- Trigger updated_at
CREATE OR REPLACE FUNCTION public.tg_player_sanctions_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_player_sanctions_updated_at ON public.player_sanctions;
CREATE TRIGGER trg_player_sanctions_updated_at
  BEFORE UPDATE ON public.player_sanctions
  FOR EACH ROW EXECUTE FUNCTION public.tg_player_sanctions_updated_at();
