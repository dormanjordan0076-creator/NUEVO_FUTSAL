
-- =========================================================
-- CATEGORÍAS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  championship_id UUID NOT NULL REFERENCES public.championships(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (championship_id, name)
);

GRANT SELECT ON public.categories TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated;
GRANT ALL ON public.categories TO service_role;

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categories readable by all"
  ON public.categories FOR SELECT
  USING (true);

CREATE POLICY "admins manage categories"
  ON public.categories FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_categories_updated
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================================
-- TEAMS — nuevos campos
-- =========================================================
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS short_name TEXT,
  ADD COLUMN IF NOT EXISTS sigla TEXT,
  ADD COLUMN IF NOT EXISTS founded_year INT,
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delegate_role TEXT,
  ADD COLUMN IF NOT EXISTS delegate_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS delegate_registered_at TIMESTAMPTZ;

-- Sigla: 3 o 4 letras (permitir NULL)
ALTER TABLE public.teams
  DROP CONSTRAINT IF EXISTS teams_sigla_length_chk;
ALTER TABLE public.teams
  ADD CONSTRAINT teams_sigla_length_chk
  CHECK (sigla IS NULL OR char_length(sigla) BETWEEN 2 AND 5);

-- =========================================================
-- PLAYERS — nuevos campos
-- =========================================================
DO $$ BEGIN
  CREATE TYPE public.player_status AS ENUM ('activo','suspendido','lesionado','inhabilitado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS is_captain BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_vice_captain BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS status public.player_status NOT NULL DEFAULT 'activo',
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- Dorsal único por equipo (permite NULL múltiples)
CREATE UNIQUE INDEX IF NOT EXISTS players_team_jersey_unique
  ON public.players (team_id, jersey_number)
  WHERE jersey_number IS NOT NULL;

-- Un solo capitán / vice-capitán por equipo
CREATE UNIQUE INDEX IF NOT EXISTS players_team_captain_unique
  ON public.players (team_id)
  WHERE is_captain = true;

CREATE UNIQUE INDEX IF NOT EXISTS players_team_vice_captain_unique
  ON public.players (team_id)
  WHERE is_vice_captain = true;

-- Trigger: capitán y vice no pueden ser el mismo jugador
CREATE OR REPLACE FUNCTION public.players_validate_captain()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_captain AND NEW.is_vice_captain THEN
    RAISE EXCEPTION 'Un jugador no puede ser capitán y vicecapitán a la vez';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_players_captain ON public.players;
CREATE TRIGGER trg_players_captain
  BEFORE INSERT OR UPDATE ON public.players
  FOR EACH ROW EXECUTE FUNCTION public.players_validate_captain();

-- =========================================================
-- STORAGE — permitir a delegados subir escudo/fotos de SU equipo
-- team-logos: path = "<team_id>/..." recomendado
-- player-photos: path = "<team_id>/..." recomendado
-- =========================================================

-- Lectura pública de escudos y fotos (URLs firmadas ya funcionan, esto habilita también acceso público read-only si se requiere)
DROP POLICY IF EXISTS "team-logos read all" ON storage.objects;
CREATE POLICY "team-logos read all"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'team-logos');

DROP POLICY IF EXISTS "player-photos read all" ON storage.objects;
CREATE POLICY "player-photos read all"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'player-photos');

-- Admin: gestión total
DROP POLICY IF EXISTS "team-logos admin write" ON storage.objects;
CREATE POLICY "team-logos admin write"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'team-logos' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'team-logos' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "player-photos admin write" ON storage.objects;
CREATE POLICY "player-photos admin write"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'player-photos' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'player-photos' AND public.has_role(auth.uid(), 'admin'));

-- Delegado: puede subir cualquier archivo (el path lo asigna la app);
-- los updates/deletes se limitan a archivos cuyo primer segmento sea el id
-- de un equipo del cual es delegado.
DROP POLICY IF EXISTS "team-logos delegate insert" ON storage.objects;
CREATE POLICY "team-logos delegate insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'team-logos'
    AND EXISTS (
      SELECT 1 FROM public.teams
      WHERE delegate_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "team-logos delegate modify" ON storage.objects;
CREATE POLICY "team-logos delegate modify"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'team-logos'
    AND EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.delegate_user_id = auth.uid()
        AND (storage.foldername(name))[1] = t.id::text
    )
  );

DROP POLICY IF EXISTS "team-logos delegate delete" ON storage.objects;
CREATE POLICY "team-logos delegate delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'team-logos'
    AND EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.delegate_user_id = auth.uid()
        AND (storage.foldername(name))[1] = t.id::text
    )
  );

DROP POLICY IF EXISTS "player-photos delegate insert" ON storage.objects;
CREATE POLICY "player-photos delegate insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'player-photos'
    AND EXISTS (SELECT 1 FROM public.teams WHERE delegate_user_id = auth.uid())
  );

DROP POLICY IF EXISTS "player-photos delegate modify" ON storage.objects;
CREATE POLICY "player-photos delegate modify"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'player-photos'
    AND EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.delegate_user_id = auth.uid()
        AND (storage.foldername(name))[1] = t.id::text
    )
  );

DROP POLICY IF EXISTS "player-photos delegate delete" ON storage.objects;
CREATE POLICY "player-photos delegate delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'player-photos'
    AND EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.delegate_user_id = auth.uid()
        AND (storage.foldername(name))[1] = t.id::text
    )
  );
