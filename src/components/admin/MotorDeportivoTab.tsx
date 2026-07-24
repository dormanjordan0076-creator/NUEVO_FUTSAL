import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useActiveChampionship } from "@/lib/championship";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

import { Plus, Trash2, ArrowUp, ArrowDown, Pencil, ListChecks, Users } from "lucide-react";
import { toast } from "sonner";
import {
  PHASE_KINDS,
  PHASE_PRESETS,
  isTablePhase,
  countPhaseMatches,
  type Phase,
  type PhaseKind,
} from "@/lib/phases";

export function MotorDeportivoTab({ initialCategoryId }: { initialCategoryId?: string } = {}) {
  const { activeId } = useActiveChampionship();
  const qc = useQueryClient();
  const [categoryId, setCategoryId] = useState<string>(initialCategoryId ?? "");

  const categories = useQuery({
    queryKey: ["admin", "categories", activeId],
    enabled: !!activeId,
    queryFn: async () =>
      (await supabase.from("categories").select("*").eq("championship_id", activeId!).order("sort_order" as any, { ascending: true })).data ?? [],
  });

  const phases = useQuery({
    queryKey: ["admin", "phases", activeId, categoryId],
    enabled: !!activeId && !!categoryId,
    queryFn: async () =>
      ((await (supabase as any)
        .from("phases")
        .select("*")
        .eq("championship_id", activeId!)
        .eq("category_id", categoryId)
        .order("display_order")).data ?? []) as Phase[],
  });

  const invalidatePhases = () =>
    qc.invalidateQueries({ queryKey: ["admin", "phases", activeId, categoryId] });

  const [dlgOpen, setDlgOpen] = useState(false);
  const [editingPhase, setEditingPhase] = useState<Phase | null>(null);

  async function addPreset(name: string, kind: PhaseKind) {
    if (!activeId || !categoryId) return;
    const nextOrder = (phases.data?.length ?? 0);
    const { error } = await (supabase as any).from("phases").insert({
      championship_id: activeId,
      category_id: categoryId,
      name,
      kind,
      display_order: nextOrder,
      status: "active",
    });
    if (error) return toast.error(error.message);
    toast.success(`Fase "${name}" agregada`);
    invalidatePhases();
  }

  async function move(phase: Phase, dir: -1 | 1) {
    const list = phases.data ?? [];
    const idx = list.findIndex((p) => p.id === phase.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= list.length) return;
    const other = list[swapIdx];
    const { error: e1 } = await (supabase as any).from("phases").update({ display_order: other.display_order }).eq("id", phase.id);
    const { error: e2 } = await (supabase as any).from("phases").update({ display_order: phase.display_order }).eq("id", other.id);
    if (e1 || e2) return toast.error((e1 ?? e2)!.message);
    invalidatePhases();
  }

  async function removePhase(phase: Phase) {
    const matches = await countPhaseMatches(phase.id);
    if (matches > 0) return toast.error(`No se puede eliminar: la fase tiene ${matches} partido(s).`);
    if (!confirm(`¿Eliminar la fase "${phase.name}"?`)) return;
    const { error } = await (supabase as any).from("phases").delete().eq("id", phase.id);
    if (error) return toast.error(error.message);
    toast.success("Fase eliminada");
    invalidatePhases();
  }

  if (!activeId) return <div className="p-6 text-sm text-muted-foreground">Seleccioná un campeonato activo.</div>;

  return (
    <Card>
      <CardContent className="space-y-5 p-5">
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest">Motor deportivo</h2>
          <p className="text-xs text-muted-foreground">Configurá las fases y clasificados de cada categoría. La clasificación entre fases es manual.</p>
        </div>

        <div className="max-w-sm">
          <Label>Categoría</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger><SelectValue placeholder="Elegí categoría" /></SelectTrigger>
            <SelectContent>
              {(categories.data ?? []).map((c: any) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!categoryId && (
          <div className="rounded-lg border border-dashed p-8 text-center text-xs text-muted-foreground">
            Seleccioná una categoría para configurar sus fases.
          </div>
        )}

        {categoryId && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-bold uppercase text-muted-foreground">Agregar fase:</span>
              {PHASE_PRESETS.map((p) => (
                <Button key={p.name} size="sm" variant="outline" onClick={() => addPreset(p.name, p.kind)} className="gap-1.5">
                  <Plus className="h-3 w-3" /> {p.name}
                </Button>
              ))}
              <Button size="sm" variant="secondary" onClick={() => { setEditingPhase(null); setDlgOpen(true); }} className="gap-1.5">
                <Plus className="h-3 w-3" /> Personalizada
              </Button>
            </div>

            <div className="space-y-2">
              {(phases.data ?? []).map((ph, idx) => (
                <PhaseRow
                  key={ph.id}
                  phase={ph}
                  first={idx === 0}
                  last={idx === (phases.data?.length ?? 0) - 1}
                  onMoveUp={() => move(ph, -1)}
                  onMoveDown={() => move(ph, 1)}
                  onEdit={() => { setEditingPhase(ph); setDlgOpen(true); }}
                  onDelete={() => removePhase(ph)}
                  onChanged={invalidatePhases}
                  categoryId={categoryId}
                  championshipId={activeId}
                />
              ))}
              {(phases.data ?? []).length === 0 && (
                <div className="rounded-lg border border-dashed p-8 text-center text-xs text-muted-foreground">
                  Sin fases todavía. Agregá una desde los botones de arriba.
                </div>
              )}
            </div>
          </>
        )}

        <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
          <PhaseFormDialog
            phase={editingPhase}
            championshipId={activeId}
            categoryId={categoryId}
            nextOrder={phases.data?.length ?? 0}
            onSaved={() => { setDlgOpen(false); invalidatePhases(); }}
          />
        </Dialog>
      </CardContent>
    </Card>
  );
}

function PhaseRow({
  phase, first, last, onMoveUp, onMoveDown, onEdit, onDelete, onChanged, categoryId, championshipId,
}: {
  phase: Phase;
  first: boolean; last: boolean;
  onMoveUp: () => void; onMoveDown: () => void;
  onEdit: () => void; onDelete: () => void; onChanged: () => void;
  categoryId: string; championshipId: string;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-border bg-card/50">
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <Badge variant="outline" className="font-mono text-[10px]">#{phase.display_order + 1}</Badge>
        <span className="font-semibold">{phase.name}</span>
        <Badge variant="secondary" className="text-[10px] capitalize">{phase.kind}</Badge>
        {isTablePhase(phase.kind) && <Badge variant="outline" className="text-[10px]">con tabla</Badge>}
        {phase.status === "archived" && <Badge variant="secondary" className="text-[10px]">archivada</Badge>}
        <div className="ml-auto flex items-center gap-1">
          <Button size="icon" variant="ghost" disabled={first} onClick={onMoveUp}><ArrowUp className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" disabled={last} onClick={onMoveDown}><ArrowDown className="h-4 w-4" /></Button>
          <Button size="sm" variant={expanded ? "secondary" : "ghost"} onClick={() => setExpanded((v) => !v)} className="gap-1.5">
            <Users className="h-3.5 w-3.5" /> Clasificados
          </Button>
          <Button size="icon" variant="ghost" onClick={onEdit}><Pencil className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" onClick={onDelete}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      </div>
      {expanded && (
        <div className="border-t px-3 py-3">
          <PhaseParticipants phase={phase} championshipId={championshipId} categoryId={categoryId} onChanged={onChanged} />
        </div>
      )}
    </div>
  );
}

type Participant = {
  id: string;
  phase_id: string;
  team_id: string;
  source_phase_id: string | null;
  source_group_id: string | null;
  source_position: number | null;
  classified_by: string | null;
  classified_at: string;
  notes: string | null;
};

function PhaseParticipants({
  phase, championshipId, categoryId, onChanged,
}: { phase: Phase; championshipId: string; categoryId: string; onChanged: () => void }) {
  const qc = useQueryClient();

 
  const teams = useQuery({
  queryKey: ["admin", "teams", championshipId, categoryId],
  enabled: !!championshipId && !!categoryId,

  queryFn: async () => {

    const { data, error } = await supabase
      .from("teams")
      .select("*")
      .eq("championship_id", championshipId)
      .eq("category_id", categoryId)
      .order("name");

    if (error) throw error;

    return data ?? [];
  },
});

  // Todas las fases de la categoría (para elegir "origen")
  const allPhases = useQuery({
    queryKey: ["admin", "phases", championshipId, categoryId],
    queryFn: async () =>
      ((await (supabase as any).from("phases")
        .select("id,name,kind,display_order,status")
        .eq("championship_id", championshipId)
        .eq("category_id", categoryId)
        .order("display_order")).data ?? []) as Pick<Phase, "id" | "name" | "kind" | "display_order" | "status">[],
  });

  // Grupos de la categoría
  const groups = useQuery({
    queryKey: ["admin", "groups", championshipId, categoryId],
    queryFn: async () =>
      ((await (supabase as any).from("groups")
        .select("id,name,category_id")
        .eq("championship_id", championshipId)
        .eq("category_id", categoryId)
        .order("display_order")).data ?? []) as { id: string; name: string }[],
  });

  const current = useQuery({
    queryKey: ["admin", "phase_participants", phase.id],
    queryFn: async () =>
      ((await (supabase as any).from("phase_participants").select("*").eq("phase_id", phase.id).order("classified_at", { ascending: true })).data ?? []) as Participant[],
  });

  const tById = useMemo(() => new Map((teams.data ?? []).map((t: any) => [t.id, t])), [teams.data]);
  const phById = useMemo(() => new Map((allPhases.data ?? []).map((p) => [p.id, p])), [allPhases.data]);
  const gById = useMemo(() => new Map((groups.data ?? []).map((g) => [g.id, g])), [groups.data]);

  const currentTeamIds = new Set((current.data ?? []).map((c) => c.team_id));

  // Equipos disponibles = inscritos en la categoría y NO clasificados aún a esta fase.
  const availableTeams = useMemo(() => {

    return (teams.data ?? []).filter(
        (t:any)=>!currentTeamIds.has(t.id)
    );

}, [teams.data, current.data]);

  // Estado del formulario "clasificar equipo"
  const [teamId, setTeamId] = useState<string>("");
  const [srcPhaseId, setSrcPhaseId] = useState<string>("__none__");
  const [srcGroupId, setSrcGroupId] = useState<string>("__none__");
  const [srcPos, setSrcPos] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setTeamId(""); setSrcPhaseId("__none__"); setSrcGroupId("__none__"); setSrcPos(""); setNotes("");
  }

  async function addParticipant() {
    if (!teamId) return toast.error("Elegí un equipo");
    setSaving(true);
    const { data: userRes } = await supabase.auth.getUser();
    const payload: any = {
      phase_id: phase.id,
      team_id: teamId,
      source_phase_id: srcPhaseId === "__none__" ? null : srcPhaseId,
      source_group_id: srcGroupId === "__none__" ? null : srcGroupId,
      source_position: srcPos ? Number(srcPos) : null,
      notes: notes.trim() || null,
      classified_by: userRes.user?.id ?? null,
    };
    const { error } = await (supabase as any).from("phase_participants").insert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Equipo clasificado");
    resetForm();
    qc.invalidateQueries({ queryKey: ["admin", "phase_participants", phase.id] });
    onChanged();
  }

  async function removeParticipant(p: Participant) {
    if (!confirm(`¿Quitar a ${tById.get(p.team_id)?.name ?? "este equipo"} de la fase?`)) return;
    const { error } = await (supabase as any).from("phase_participants").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Participante quitado");
    qc.invalidateQueries({ queryKey: ["admin", "phase_participants", phase.id] });
    onChanged();
  }

  if ((teams.data ?? []).length === 0) {
    return <div className="text-xs text-muted-foreground">No existen equipos registrados para esta categoría.</div>;
  }

  // Fases posibles como "origen": todas menos la actual.
  const sourcePhaseOptions = (allPhases.data ?? []).filter((p) => p.id !== phase.id);

  return (
    <div className="space-y-4">
      {/* Lista actual */}
      <div>
        <div className="mb-2 text-xs font-bold uppercase text-muted-foreground">
          <ListChecks className="mr-1 inline h-3.5 w-3.5" />
          Clasificados a esta fase ({(current.data ?? []).length})
        </div>
        {(current.data ?? []).length === 0 ? (
          <div className="rounded border border-dashed p-4 text-center text-xs text-muted-foreground">Sin equipos clasificados aún.</div>
        ) : (
          <div className="space-y-1.5">
            {(current.data ?? []).map((p) => {
              const t: any = tById.get(p.team_id);
              const src = p.source_phase_id ? phById.get(p.source_phase_id) : null;
              const grp = p.source_group_id ? gById.get(p.source_group_id) : null;
              return (
                <div key={p.id} className="flex flex-wrap items-center gap-2 rounded border border-border bg-background/50 px-3 py-2 text-sm">
                  <span className="font-semibold">{t?.name ?? "—"}</span>
                  {(src || grp || p.source_position) && (
                    <span className="text-[11px] text-muted-foreground">
                      Origen:{" "}
                      {src && <Badge variant="outline" className="mr-1 text-[10px]">{src.name}</Badge>}
                      {grp && <Badge variant="outline" className="mr-1 text-[10px]">Grupo {grp.name}</Badge>}
                      {p.source_position && <Badge variant="outline" className="text-[10px]">Pos {p.source_position}</Badge>}
                    </span>
                  )}
                  {p.notes && <span className="text-[11px] italic text-muted-foreground">"{p.notes}"</span>}
                  <span className="ml-auto text-[10px] text-muted-foreground">
                    {new Date(p.classified_at).toLocaleString()}
                  </span>
                  <Button size="icon" variant="ghost" onClick={() => removeParticipant(p)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Formulario nueva clasificación */}
      <div className="rounded-lg border border-border bg-muted/30 p-3">
        <div className="mb-2 text-xs font-bold uppercase text-muted-foreground">Clasificar equipo</div>
        <div className="grid gap-2 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Equipo</Label>
            <Select value={teamId} onValueChange={setTeamId}>
              <SelectTrigger><SelectValue placeholder={availableTeams.length ? "Elegí equipo" : "Sin equipos disponibles"} /></SelectTrigger>
              <SelectContent>
                {availableTeams.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Fase de origen (opcional)</Label>
            <Select value={srcPhaseId} onValueChange={setSrcPhaseId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin origen</SelectItem>
                {sourcePhaseOptions.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Grupo de origen (opcional)</Label>
            <Select value={srcGroupId} onValueChange={setSrcGroupId} disabled={(groups.data ?? []).length === 0}>
              <SelectTrigger><SelectValue placeholder={(groups.data ?? []).length ? "Sin grupo" : "Sin grupos"} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Sin grupo</SelectItem>
                {(groups.data ?? []).map((g) => <SelectItem key={g.id} value={g.id}>Grupo {g.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Posición obtenida (opcional)</Label>
            <Input type="number" min={1} value={srcPos} onChange={(e) => setSrcPos(e.target.value)} placeholder="Ej: 2" />
          </div>
          <div className="sm:col-span-2">
            <Label className="text-xs">Notas (opcional)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Motivo de la clasificación…" />
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <Button size="sm" onClick={addParticipant} disabled={saving || !teamId}>
            <Plus className="mr-1 h-3.5 w-3.5" /> Clasificar
          </Button>
        </div>
      </div>
    </div>
  );
}

function PhaseFormDialog({
  phase, championshipId, categoryId, nextOrder, onSaved,
}: {
  phase: Phase | null;
  championshipId: string;
  categoryId: string;
  nextOrder: number;
  onSaved: () => void;
}) {
  const [name, setName] = useState(phase?.name ?? "");
  const [kind, setKind] = useState<PhaseKind>(phase?.kind ?? "liga");
  const [status, setStatus] = useState<"active" | "archived">(phase?.status ?? "active");

  async function save() {
    if (!name.trim()) return toast.error("Escribí un nombre");
    if (phase) {
      const { error } = await (supabase as any).from("phases")
        .update({ name: name.trim(), kind, status })
        .eq("id", phase.id);
      if (error) return toast.error(error.message);
      toast.success("Fase actualizada");
    } else {
      const { error } = await (supabase as any).from("phases").insert({
        championship_id: championshipId,
        category_id: categoryId,
        name: name.trim(),
        kind,
        display_order: nextOrder,
        status,
      });
      if (error) return toast.error(error.message);
      toast.success("Fase creada");
    }
    onSaved();
  }

  return (
    <DialogContent className="max-w-md">
      <DialogHeader><DialogTitle>{phase ? "Editar fase" : "Nueva fase"}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Nombre</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Copa Oro, Repechaje…" /></div>
        <div>
          <Label>Tipo</Label>
          <Select value={kind} onValueChange={(v) => setKind(v as PhaseKind)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {PHASE_KINDS.map((k) => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Estado</Label>
          <Select value={status} onValueChange={(v) => setStatus(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Activa</SelectItem>
              <SelectItem value="archived">Archivada</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={save}>{phase ? "Guardar" : "Crear"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
