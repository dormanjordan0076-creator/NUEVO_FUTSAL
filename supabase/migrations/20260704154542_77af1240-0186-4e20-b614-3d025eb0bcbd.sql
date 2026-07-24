
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS referee_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.is_team_delegate(_team_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.teams WHERE id = _team_id AND delegate_user_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.is_match_referee(_match_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.matches WHERE id = _match_id AND referee_user_id = auth.uid())
$$;

CREATE OR REPLACE FUNCTION public.current_user_active()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT active FROM public.profiles WHERE id = auth.uid()), false)
$$;

DROP POLICY IF EXISTS teams_delegate_update ON public.teams;
CREATE POLICY teams_delegate_update ON public.teams
  FOR UPDATE TO authenticated
  USING (delegate_user_id = auth.uid() AND public.current_user_active())
  WITH CHECK (delegate_user_id = auth.uid());

DROP POLICY IF EXISTS players_delegate_all ON public.players;
CREATE POLICY players_delegate_all ON public.players
  FOR ALL TO authenticated
  USING (public.is_team_delegate(team_id) AND public.current_user_active())
  WITH CHECK (public.is_team_delegate(team_id));

DROP POLICY IF EXISTS matches_referee_update ON public.matches;
CREATE POLICY matches_referee_update ON public.matches
  FOR UPDATE TO authenticated
  USING (referee_user_id = auth.uid() AND public.has_role(auth.uid(), 'arbitro') AND public.current_user_active())
  WITH CHECK (referee_user_id = auth.uid());

DROP POLICY IF EXISTS matches_delegate_update ON public.matches;
CREATE POLICY matches_delegate_update ON public.matches
  FOR UPDATE TO authenticated
  USING (
    public.current_user_active() AND (
      public.is_team_delegate(home_team_id) OR public.is_team_delegate(away_team_id)
    )
  )
  WITH CHECK (
    public.is_team_delegate(home_team_id) OR public.is_team_delegate(away_team_id)
  );

DROP POLICY IF EXISTS events_referee_all ON public.match_events;
CREATE POLICY events_referee_all ON public.match_events
  FOR ALL TO authenticated
  USING (public.is_match_referee(match_id) AND public.has_role(auth.uid(), 'arbitro') AND public.current_user_active())
  WITH CHECK (public.is_match_referee(match_id) AND public.has_role(auth.uid(), 'arbitro'));

DROP POLICY IF EXISTS user_roles_admin_all ON public.user_roles;
CREATE POLICY user_roles_admin_all ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS profiles_admin_all ON public.profiles;
CREATE POLICY profiles_admin_all ON public.profiles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_roles TO authenticated;
