
REVOKE EXECUTE ON FUNCTION public.is_team_delegate(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_match_referee(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.current_user_active() FROM PUBLIC, anon, authenticated;
