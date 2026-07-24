import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "super_admin" | "admin" | "delegado" | "arbitro";

type RoleRow = { role: AppRole; championship_id: string | null };

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [rolesRows, setRolesRows] = useState<RoleRow[]>([]);
  const [delegateTeamId, setDelegateTeamId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) load(data.session.user.id);
      else setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) load(s.user.id);
      else {
        setRolesRows([]);
        setDelegateTeamId(null);
        setLoading(false);
      }
    });

    async function load(uid: string) {
      const [{ data: rolesData }, { data: teamData }] = await Promise.all([
        supabase.from("user_roles").select("role, championship_id").eq("user_id", uid),
        supabase.from("teams").select("id").eq("delegate_user_id", uid).maybeSingle(),
      ]);
      setRolesRows(((rolesData ?? []) as any[]).map((r) => ({ role: r.role as AppRole, championship_id: r.championship_id ?? null })));
      setDelegateTeamId(teamData?.id ?? null);
      setLoading(false);
    }

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const roles = rolesRows.map((r) => r.role);
  const isSuperAdmin = roles.includes("super_admin");
  const isAdmin = isSuperAdmin || roles.includes("admin");
  const isDelegado = roles.includes("delegado");
  const isArbitro = roles.includes("arbitro");
  const role: AppRole | null = isSuperAdmin ? "super_admin" : roles.includes("admin") ? "admin" : isDelegado ? "delegado" : isArbitro ? "arbitro" : null;

  function hasRoleIn(r: AppRole, championshipId: string | null | undefined) {
    if (isSuperAdmin) return true;
    return rolesRows.some((row) => row.role === r && (row.championship_id === championshipId || row.championship_id === null));
  }

  return { session, user, role, roles, rolesRows, loading, isSuperAdmin, isAdmin, isDelegado, isArbitro, delegateTeamId, hasRoleIn };
}
