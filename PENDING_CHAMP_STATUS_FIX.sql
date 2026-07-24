-- =========================================================================
-- PENDING_CHAMP_STATUS_FIX.sql
-- Corrige el constraint championships_status_check para admitir los
-- valores usados por la app: 'activo' y 'finalizado'.
-- NO se ejecuta automáticamente. Correr manualmente desde el panel SQL.
-- =========================================================================

ALTER TABLE public.championships
  DROP CONSTRAINT IF EXISTS championships_status_check;

ALTER TABLE public.championships
  ADD CONSTRAINT championships_status_check
  CHECK (status IN ('activo', 'finalizado'));

-- Backfill defensivo por si quedaron valores nulos o distintos.
UPDATE public.championships SET status = 'activo' WHERE status IS NULL;
