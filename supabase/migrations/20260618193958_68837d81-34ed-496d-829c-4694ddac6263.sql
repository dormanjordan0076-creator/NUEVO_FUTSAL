
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin','delegado');
CREATE TYPE public.player_position AS ENUM ('arquero','defensa','ala','pivot','universal');
CREATE TYPE public.tournament_phase AS ENUM ('grupos','liguilla_a','liguilla_b','semifinal','tercer_lugar','final');
CREATE TYPE public.match_status AS ENUM ('pendiente','en_juego','finalizado','suspendido','reprogramado');
CREATE TYPE public.event_type AS ENUM ('gol','autogol','amarilla','roja','asistencia','mvp');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_all_auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user_roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Trigger: crear perfil + asignar rol al registrarse (primer usuario = admin)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_role app_role;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    v_role := 'admin';
  ELSE
    v_role := 'delegado';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, v_role);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ updated_at helper ============
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ============ CHAMPIONSHIPS ============
CREATE TABLE public.championships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  year INT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  yellow_cards_for_suspension INT NOT NULL DEFAULT 2,
  red_card_suspension_matches INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.championships TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.championships TO authenticated;
GRANT ALL ON public.championships TO service_role;
ALTER TABLE public.championships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "champ_select_all" ON public.championships FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "champ_admin_write" ON public.championships FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER champ_updated BEFORE UPDATE ON public.championships FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ TEAMS ============
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  championship_id UUID NOT NULL REFERENCES public.championships(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  logo_url TEXT,
  primary_color TEXT DEFAULT '#1e40af',
  secondary_color TEXT DEFAULT '#ffffff',
  delegate_name TEXT,
  delegate_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  phone TEXT,
  email TEXT,
  participation_year INT,
  group_name TEXT, -- 'A' o 'B'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.teams TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.teams TO authenticated;
GRANT ALL ON public.teams TO service_role;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "teams_select_all" ON public.teams FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "teams_admin_write" ON public.teams FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER teams_updated BEFORE UPDATE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_teams_champ ON public.teams(championship_id);

-- ============ PLAYERS ============
CREATE TABLE public.players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  photo_url TEXT,
  jersey_number INT,
  birth_date DATE,
  national_id TEXT,
  position player_position NOT NULL DEFAULT 'universal',
  phone TEXT,
  email TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.players TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.players TO authenticated;
GRANT ALL ON public.players TO service_role;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "players_select_all" ON public.players FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "players_admin_write" ON public.players FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER players_updated BEFORE UPDATE ON public.players FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_players_team ON public.players(team_id);

-- ============ MATCHES ============
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  championship_id UUID NOT NULL REFERENCES public.championships(id) ON DELETE CASCADE,
  phase tournament_phase NOT NULL DEFAULT 'grupos',
  group_name TEXT,
  matchday INT,
  match_date TIMESTAMPTZ,
  venue TEXT,
  referee_main TEXT,
  referee_assistant TEXT,
  home_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  away_team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  home_score INT,
  away_score INT,
  status match_status NOT NULL DEFAULT 'pendiente',
  mvp_player_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  duration_minutes INT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.matches TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.matches TO authenticated;
GRANT ALL ON public.matches TO service_role;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "matches_select_all" ON public.matches FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "matches_admin_write" ON public.matches FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER matches_updated BEFORE UPDATE ON public.matches FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE INDEX idx_matches_champ ON public.matches(championship_id);
CREATE INDEX idx_matches_date ON public.matches(match_date);

-- ============ MATCH EVENTS ============
CREATE TABLE public.match_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  player_id UUID REFERENCES public.players(id) ON DELETE SET NULL,
  type event_type NOT NULL,
  minute INT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.match_events TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.match_events TO authenticated;
GRANT ALL ON public.match_events TO service_role;
ALTER TABLE public.match_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "events_select_all" ON public.match_events FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "events_admin_write" ON public.match_events FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE INDEX idx_events_match ON public.match_events(match_id);
CREATE INDEX idx_events_player ON public.match_events(player_id);

-- ============ SUSPENSIONS ============
CREATE TABLE public.suspensions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  championship_id UUID NOT NULL REFERENCES public.championships(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  matches_remaining INT NOT NULL DEFAULT 1,
  origin_match_id UUID REFERENCES public.matches(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.suspensions TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.suspensions TO authenticated;
GRANT ALL ON public.suspensions TO service_role;
ALTER TABLE public.suspensions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "susp_select_all" ON public.suspensions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "susp_admin_write" ON public.suspensions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ NEWS ============
CREATE TABLE public.news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  championship_id UUID REFERENCES public.championships(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.news TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.news TO authenticated;
GRANT ALL ON public.news TO service_role;
ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;
CREATE POLICY "news_select_public" ON public.news FOR SELECT TO anon, authenticated USING (published = true OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "news_admin_write" ON public.news FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Campeonato inicial
INSERT INTO public.championships (name, year, is_active)
VALUES ('Campeonato Integración Profesional Futsal', EXTRACT(YEAR FROM now())::INT, true);
