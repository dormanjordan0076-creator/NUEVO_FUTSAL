import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveChampionship } from "@/lib/championship";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Users } from "lucide-react";
import { toast } from "sonner";

export function ParticipacionesTab() {
  const { activeId } = useActiveChampionship();
  const qc = useQueryClient();

  const categories = useQuery({
    queryKey: ["admin", "categories", activeId],
    enabled: !!activeId,
    queryFn: async () =>
      (await supabase.from("categories").select("*").eq("championship_id", activeId!).order("sort_order")).data ?? [],
  });

  const teams = useQuery({
    queryKey: ["admin", "teams", activeId],
    enabled: !!activeId,
    queryFn: async () =>
      (await supabase.from("teams").select("id,name,logo_url,primary_color").eq("championship_id", activeId!).order("name")).data ?? [],
  });

  const parts = useQuery({
    queryKey: ["admin", "team_participations", activeId],
    enabled: !!activeId,
    queryFn: async () =>
      (await (supabase as any).from("team_participations").select("*").eq("championship_id", activeId!)).data ?? [],
  });

  const [categoryId, setCategoryId] = useState<string>("");
  const groups = useQuery({
    queryKey: ["admin", "groups", categoryId],
    enabled: !!categoryId,
    queryFn: async () =>
      (await (supabase as any).from("groups").select("*").eq("category_id", categoryId).order("sort_order")).data ?? [],
  });

  const [teamId, setTeamId] = useState("");
  const [groupId, setGroupId] = useState<string>("none");

  const teamById = useMemo(() => new Map<string, any>((teams.data ?? []).map((t: any) => [t.id, t])), [teams.data]);
  const groupById = useMemo(() => new Map<string, any>((groups.data ?? []).map((g: any) => [g.id, g])), [groups.data]);
  const catById = useMemo(() => new Map<string, any>((categories.data ?? []).map((c: any) => [c.id, c])), [categories.data]);

  const filtered = (parts.data ?? []).filter((p: any) => !categoryId || p.category_id === categoryId);

  async function add() {
    if (!activeId || !categoryId || !teamId) return toast.error("Elegí categoría y equipo");
    const payload: any = {
      team_id: teamId,
      championship_id: activeId,
      category_id: categoryId,
      group_id: groupId === "none" ? null : groupId,
      status: "active",
    };
    const { error } = await (supabase as any).from("team_participations").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Participación creada");
    setTeamId(""); setGroupId("none");
    qc.invalidateQueries({ queryKey: ["admin", "team_participations", activeId] });
  }

  async function updateGroup(id: string, newGroupId: string | null) {
    const { error } = await (supabase as any).from("team_participations").update({ group_id: newGroupId }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin", "team_participations", activeId] });
  }

  async function remove(id: string) {
    if (!confirm("¿Quitar participación?")) return;
    const { error } = await (supabase as any).from("team_participations").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["admin", "team_participations", activeId] });
  }

  if (!activeId) return <div className="p-6 text-sm text-muted-foreground">Seleccioná un campeonato activo.</div>;

  return (
    <Card><CardContent className="p-5">
      <h2 className="mb-3 text-sm font-black uppercase tracking-widest">Participaciones (equipos por categoría)</h2>

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <div className="min-w-[200px] flex-1">
          <Label>Categoría</Label>
          <Select value={categoryId} onValueChange={(v) => { setCategoryId(v); setGroupId("none"); }}>
            <SelectTrigger><SelectValue placeholder="Elegí categoría" /></SelectTrigger>
            <SelectContent>{(categories.data ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="min-w-[200px] flex-1">
          <Label>Equipo</Label>
          <Select value={teamId} onValueChange={setTeamId}>
            <SelectTrigger><SelectValue placeholder="Elegí equipo" /></SelectTrigger>
            <SelectContent>{(teams.data ?? []).map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="min-w-[160px]">
          <Label>Grupo</Label>
          <Select value={groupId} onValueChange={setGroupId} disabled={!categoryId}>
            <SelectTrigger><SelectValue placeholder="Sin grupo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin grupo</SelectItem>
              {(groups.data ?? []).map((g: any) => <SelectItem key={g.id} value={g.id}>Grupo {g.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={add} className="gap-1.5"><Plus className="h-4 w-4" /> Añadir</Button>
      </div>

      <div className="space-y-1">
        {filtered.map((p: any) => {
          const t = teamById.get(p.team_id);
          const c = catById.get(p.category_id);
          const g = p.group_id ? groupById.get(p.group_id) : null;
          return (
            <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card/50 px-3 py-2 text-sm">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold">{t?.name ?? p.team_id.slice(0, 8)}</span>
              <Badge variant="outline" className="text-[10px]">{c?.name ?? "?"}</Badge>
              {categoryId === p.category_id ? (
                <Select value={p.group_id ?? "none"} onValueChange={(v) => updateGroup(p.id, v === "none" ? null : v)}>
                  <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin grupo</SelectItem>
                    {(groups.data ?? []).map((gr: any) => <SelectItem key={gr.id} value={gr.id}>Grupo {gr.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : (
                <Badge variant="secondary" className="text-[10px]">{g ? `Grupo ${g.name}` : "Sin grupo"}</Badge>
              )}
              <Badge variant="secondary" className="ml-auto text-[10px] capitalize">{p.status}</Badge>
              <Button size="icon" variant="ghost" onClick={() => remove(p.id)}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="rounded-lg border border-dashed p-8 text-center text-xs text-muted-foreground">
            {categoryId ? "Sin equipos en esta categoría" : "Elegí una categoría o creá una participación"}
          </div>
        )}
      </div>
    </CardContent></Card>
  );
}
