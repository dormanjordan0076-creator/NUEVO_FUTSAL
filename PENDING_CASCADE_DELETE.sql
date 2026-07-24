-- =========================================================================
-- PENDING_CASCADE_DELETE.sql
-- Corrige el borrado de campeonatos: agrega ON DELETE CASCADE en todas las
-- FKs que apuntan a public.championships y sus dependencias.
-- NO se ejecuta automáticamente. Correr manualmente desde el panel SQL.
-- =========================================================================

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT
      tc.table_schema,
      tc.table_name,
      tc.constraint_name,
      kcu.column_name,
      ccu.table_name AS foreign_table_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
     AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
     AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND ccu.table_name IN ('championships','categories','groups','phases','teams','matches','players')
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I DROP CONSTRAINT %I',
      r.table_schema, r.table_name, r.constraint_name
    );
    EXECUTE format(
      'ALTER TABLE %I.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.%I(id) ON DELETE CASCADE',
      r.table_schema, r.table_name, r.constraint_name, r.column_name, r.foreign_table_name
    );
  END LOOP;
END $$;
