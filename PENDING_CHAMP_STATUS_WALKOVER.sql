-- =====================================================================
-- FASE 3 — Historial de campeonatos + Walkover / estados de partido
-- Ejecutar manualmente. Idempotente (defensivo).
-- =====================================================================

-- 1) CAMPEONATOS: estandarizar status a { activo, finalizado }
--    Mantiene compatibilidad con is_active (no lo borramos aún).
ALTER TABLE public.championships
  ADD COLUMN IF NOT EXISTS status text;

UPDATE public.championships
   SET status = CASE
     WHEN status IS NOT NULL AND status <> '' THEN status
     WHEN is_active = true THEN 'activo'
     ELSE 'finalizado'
   END
 WHERE status IS NULL OR status = '';

ALTER TABLE public.championships
  ALTER COLUMN status SET DEFAULT 'activo';

-- Constraint suave: solo estos valores.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'championships_status_check'
  ) THEN
    ALTER TABLE public.championships
      ADD CONSTRAINT championships_status_check
      CHECK (status IN ('activo','finalizado'));
  END IF;
END $$;

-- 2) MATCHES: tipo de resultado (walkover, suspendido, etc.)
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS result_type text NOT NULL DEFAULT 'normal';

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'matches_result_type_check'
  ) THEN
    ALTER TABLE public.matches
      ADD CONSTRAINT matches_result_type_check
      CHECK (result_type IN ('normal','walkover','suspendido','reprogramado','abandonado'));
  END IF;
END $$;

-- Ganador por walkover (referencia a teams; nullable).
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS walkover_winner_team_id uuid
    REFERENCES public.teams(id) ON DELETE SET NULL;

-- 3) CONFIG por campeonato: marcador por walkover (default 3-0)
ALTER TABLE public.championships
  ADD COLUMN IF NOT EXISTS walkover_score_winner  integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS walkover_score_loser   integer NOT NULL DEFAULT 0;

-- Nota: la exclusión de walkover del cálculo de goleadores/tarjetas
-- se hace en la capa de aplicación filtrando result_type = 'normal'
-- al leer match_events (no altera datos existentes).
