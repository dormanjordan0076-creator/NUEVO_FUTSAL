import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Gavel, FileUp, MessageSquare, ExternalLink } from "lucide-react";
import { uploadFile } from "@/lib/storage";
import { useActiveChampionship } from "@/lib/championship";

const OBS_STATUS = ["pendiente", "en_revision", "aceptada", "rechazada", "resuelta", "archivada"] as const;

export function ComiteTab() {
  const qc = useQueryClient();
  const { activeId } = useActiveChampionship();
  const [filter, setFilter] = useState<string>("all");

  // IDs de equipos del campeonato activo, para filtrar observaciones por campeonato.
  const teamIds = useQuery({
    queryKey: ["admin", "comite-team-ids", activeId],
    enabled: !!activeId,
    queryFn: async () => {
      const { data } = await supabase.from("teams").select("id").eq("championship_id", activeId!);
      return (data ?? []).map((t: any) => t.id) as string[];
    },
  });

  const observations = useQuery({
    queryKey: ["admin", "observations", activeId, filter, teamIds.data?.length ?? 0],
    enabled: !!activeId && !!teamIds.data,
    queryFn: async () => {
      const ids = teamIds.data ?? [];
      if (ids.length === 0) return [] as any[];
      let q: any = (supabase as any).from("match_observations")
        .select("*, team:team_id(id,name,logo_url,primary_color), match:match_id(id,match_date,home_team_id,away_team_id,home:home_team_id(name),away:away_team_id(name)), match_resolutions(*)")
        .in("team_id", ids)
        .order("created_at", { ascending: false });
      if (filter !== "all") q = q.eq("status", filter);
      const { data } = await q;
      return (data ?? []) as any[];
    },
  });

  const [resolveFor, setResolveFor] = useState<any>(null);

  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Gavel className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-sm font-black uppercase tracking-widest">Comité de penalización</h2>
              <p className="text-xs text-muted-foreground">Observaciones de los delegados y sus resoluciones oficiales.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs">Estado</Label>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {OBS_STATUS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-3">
          {(observations.data ?? []).map((o: any) => (
            <div key={o.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{o.team?.name}</Badge>
                  <Badge variant="secondary" className="capitalize">{o.observation_type ?? "general"}</Badge>
                  <Badge className={
                    o.status === "resuelta" || o.status === "aceptada" ? "bg-success text-success-foreground" :
                    o.status === "en_revision" ? "bg-warning text-warning-foreground" :
                    o.status === "rechazada" ? "bg-destructive text-destructive-foreground" :
                    "bg-muted text-muted-foreground"
                  }>{(o.status ?? "pendiente").replace("_", " ")}</Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  {o.created_at ? format(new Date(o.created_at), "dd/MM/yyyy HH:mm", { locale: es }) : ""}
                </span>
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Partido: {o.match?.home?.name ?? "—"} vs {o.match?.away?.name ?? "—"}
                {o.match?.match_date && ` · ${format(new Date(o.match.match_date), "dd MMM", { locale: es })}`}
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm">{o.description}</p>

              {o.admin_response && (
                <div className="mt-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
                  <div className="text-xs font-bold uppercase tracking-widest text-primary">Respuesta del comité</div>
                  <p className="mt-1 whitespace-pre-wrap text-sm">{o.admin_response}</p>
                </div>
              )}

              <div className="mt-3">
                <Label className="text-xs">Respuesta del comité</Label>
                <Textarea
                  rows={2}
                  defaultValue={o.admin_response ?? ""}
                  onBlur={async (e) => {
                    const v = e.target.value.trim() || null;
                    if ((o.admin_response ?? null) === v) return;
                    const { error } = await (supabase as any).from("match_observations").update({ admin_response: v }).eq("id", o.id);
                    if (error) return toast.error(error.message);
                    toast.success("Respuesta guardada");
                    qc.invalidateQueries({ queryKey: ["admin", "observations"] });
                  }}
                  placeholder="Escribí una respuesta oficial para el delegado…"
                />
              </div>



              {o.match_resolutions?.length > 0 && (
                <div className="mt-3 rounded-lg border border-success/40 bg-success/5 p-3">
                  <div className="text-xs font-bold uppercase tracking-widest text-success">Resolución publicada</div>
                  {o.match_resolutions.map((r: any) => (
                    <div key={r.id} className="mt-1 text-sm">
                      <div className="font-semibold">{r.title}</div>
                      {r.pdf_url && (
                        <a href={r.pdf_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline">
                          Ver PDF <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Select value={o.status ?? "pendiente"} onValueChange={async (v) => {
                  const { error } = await (supabase as any).from("match_observations").update({ status: v }).eq("id", o.id);
                  if (error) return toast.error(error.message);
                  toast.success("Estado actualizado");
                  qc.invalidateQueries({ queryKey: ["admin", "observations"] });
                }}>
                  <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OBS_STATUS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Button size="sm" className="gap-1.5" onClick={() => setResolveFor(o)}>
                  <FileUp className="h-4 w-4" /> {o.match_resolutions?.length ? "Reemplazar resolución" : "Subir resolución"}
                </Button>
              </div>
            </div>
          ))}
          {(observations.data ?? []).length === 0 && (
            <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
              <MessageSquare className="mx-auto mb-2 h-8 w-8" />
              Sin observaciones para este filtro.
            </div>
          )}
        </div>
      </CardContent>

      <ResolutionDialog
        obs={resolveFor}
        onClose={() => setResolveFor(null)}
        onSaved={() => { qc.invalidateQueries({ queryKey: ["admin", "observations"] }); setResolveFor(null); }}
      />
    </Card>
  );
}

function ResolutionDialog({ obs, onClose, onSaved }: { obs: any; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [sancPlayer, setSancPlayer] = useState<string>("");
  const [sancMatches, setSancMatches] = useState<string>("");
  const [sancReason, setSancReason] = useState<string>("");

  const players = useQuery({
    queryKey: ["comite", "players-of", obs?.team_id],
    enabled: !!obs?.team_id,
    queryFn: async () => (await supabase.from("players").select("id,full_name,jersey_number").eq("team_id", obs!.team_id).order("jersey_number")).data ?? [],
  });

  return (
    <Dialog open={!!obs} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>Publicar resolución del comité</DialogTitle></DialogHeader>
        <div>
          <Label>Título</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Suspensión 2 fechas a jugador N°10" />
        </div>
        <div>
          <Label>Descripción / fundamentación</Label>
          <Textarea rows={4} value={desc} onChange={(e) => setDesc(e.target.value)} />
        </div>
        <div>
          <Label>PDF de resolución (opcional)</Label>
          <Input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>

        <div className="mt-2 rounded-lg border border-dashed p-3">
          <div className="mb-2 text-xs font-black uppercase tracking-widest text-muted-foreground">Sanción a jugador (opcional)</div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-2">
              <Label className="text-xs">Jugador</Label>
              <Select value={sancPlayer || "__none__"} onValueChange={(v) => setSancPlayer(v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Sin sanción" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Sin sanción</SelectItem>
                  {(players.data ?? []).map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.jersey_number ? `#${p.jersey_number} · ` : ""}{p.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Partidos</Label>
              <Input type="number" min={1} value={sancMatches} onChange={(e) => setSancMatches(e.target.value)} placeholder="0" />
            </div>
          </div>
          <div className="mt-2">
            <Label className="text-xs">Motivo</Label>
            <Input value={sancReason} onChange={(e) => setSancReason(e.target.value)} placeholder="Ej: Agresión al árbitro" />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button disabled={saving || !title.trim()} onClick={async () => {
            if (!obs) return;
            setSaving(true);
            try {
              let pdf_url: string | null = null;
              if (file) {
                const path = await uploadFile("resoluciones", file, `${obs.match_id}/`);
                const { data } = supabase.storage.from("resoluciones").getPublicUrl(path);
                pdf_url = data.publicUrl;
              }
              const { data: userData } = await supabase.auth.getUser();
              const uid = userData.user?.id ?? null;
              const { error } = await (supabase as any).from("match_resolutions").insert({
                observation_id: obs.id,
                match_id: obs.match_id,
                title: title.trim(),
                description: desc.trim() || null,
                pdf_url,
                created_by: uid,
              });
              if (error) throw error;

              // Sanción opcional
              const nMatches = Number(sancMatches);
              if (sancPlayer && nMatches > 0) {
                const { data: team } = await (supabase as any).from("teams")
                  .select("championship_id,category_id").eq("id", obs.team_id).maybeSingle();
                const { error: sErr } = await (supabase as any).from("player_sanctions").insert({
                  championship_id: team?.championship_id,
                  category_id: team?.category_id ?? null,
                  player_id: sancPlayer,
                  team_id: obs.team_id,
                  source: "comite",
                  reason: sancReason.trim() || title.trim(),
                  match_id: obs.match_id ?? null,
                  observation_id: obs.id,
                  matches_total: nMatches,
                  created_by: uid,
                });
                if (sErr) throw sErr;
              }

              await (supabase as any).from("match_observations").update({ status: "resuelta" }).eq("id", obs.id);
              toast.success("Resolución publicada");
              onSaved();
            } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
          }}>{saving ? "Guardando…" : "Publicar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
