import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveChampionship } from "@/lib/championship";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, UserCheck } from "lucide-react";
import { toast } from "sonner";

export function DelegadosTab() {
  const { activeId } = useActiveChampionship();
  const qc = useQueryClient();

  const teams = useQuery({
    queryKey: ["admin", "teams", activeId],
    enabled: !!activeId,
    queryFn: async () =>
      (await supabase.from("teams").select("id,name").eq("championship_id", activeId!).order("name")).data ?? [],
  });

  const users = useQuery({
    queryKey: ["admin", "delegado-users", activeId],
    enabled: !!activeId,
    queryFn: async () => {
      // Usuarios con rol delegado en este campeonato (o global)
      const { data } = await supabase
        .from("user_roles")
        .select("user_id, championship_id")
        .eq("role", "delegado");
      return (data ?? []).filter((r: any) => !r.championship_id || r.championship_id === activeId);
    },
  });

  const delegates = useQuery({
    queryKey: ["admin", "team_delegates", activeId],
    enabled: !!activeId,
    queryFn: async () =>
      (await (supabase as any).from("team_delegates").select("*").eq("championship_id", activeId!)).data ?? [],
  });

  const [teamId, setTeamId] = useState("");
  const [userId, setUserId] = useState("");

  async function add() {
    if (!teamId || !userId || !activeId) return toast.error("Elegí equipo y usuario");
    const { error } = await (supabase as any).from("team_delegates").insert({
      team_id: teamId, user_id: userId, championship_id: activeId, role_label: "principal",
    });
    if (error) return toast.error(error.message);
    toast.success("Delegado asignado");
    setTeamId(""); setUserId("");
    qc.invalidateQueries({ queryKey: ["admin", "team_delegates", activeId] });
  }

  if (!activeId) return <div className="p-6 text-sm text-muted-foreground">Seleccioná un campeonato activo.</div>;

  const teamById = new Map((teams.data ?? []).map((t: any) => [t.id, t.name]));

  return (
    <Card><CardContent className="p-5">
      <h2 className="mb-3 text-sm font-black uppercase tracking-widest">Delegados por equipo</h2>
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div className="min-w-[220px] flex-1"><Label>Equipo</Label>
          <Select value={teamId} onValueChange={setTeamId}>
            <SelectTrigger><SelectValue placeholder="Elegí equipo" /></SelectTrigger>
            <SelectContent>{(teams.data ?? []).map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="min-w-[220px] flex-1"><Label>Usuario delegado</Label>
          <Select value={userId} onValueChange={setUserId}>
            <SelectTrigger><SelectValue placeholder="Elegí usuario" /></SelectTrigger>
            <SelectContent>
              {(users.data ?? []).map((u: any) => <SelectItem key={u.user_id} value={u.user_id}>{u.user_id.slice(0, 8)}…</SelectItem>)}
              {(users.data ?? []).length === 0 && <div className="p-2 text-xs text-muted-foreground">Creá primero un usuario con rol Delegado en la pestaña Usuarios</div>}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={add} className="gap-1.5"><Plus className="h-4 w-4" /> Asignar</Button>
      </div>

      <div className="space-y-1">
        {(delegates.data ?? []).map((d: any) => (
          <div key={d.id} className="flex items-center gap-2 rounded-lg border border-border bg-card/50 px-3 py-2 text-sm">
            <UserCheck className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 font-semibold">{teamById.get(d.team_id) ?? d.team_id.slice(0, 8)}</span>
            <Badge variant="outline" className="text-[10px]">{d.role_label ?? "delegado"}</Badge>
            <span className="text-xs text-muted-foreground">{d.user_id.slice(0, 8)}…</span>
            <Button size="icon" variant="ghost" onClick={async () => {
              if (!confirm("Quitar delegado?")) return;
              const { error } = await (supabase as any).from("team_delegates").delete().eq("id", d.id);
              if (error) return toast.error(error.message);
              qc.invalidateQueries({ queryKey: ["admin", "team_delegates", activeId] });
            }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        ))}
        {(delegates.data ?? []).length === 0 && <div className="rounded-lg border border-dashed p-8 text-center text-xs text-muted-foreground">Sin delegados asignados</div>}
      </div>
    </CardContent></Card>
  );
}
