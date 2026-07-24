import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { TeamBadge } from "@/components/TeamBadge";
import { uploadFile } from "@/lib/storage";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Users, Shield, FileText, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { ObservacionDialog } from "@/components/ObservacionDialog";
import { useActiveChampionship } from "@/lib/championship";

export const Route = createFileRoute("/_authenticated/mi-equipo")({
  head: () => ({ meta: [{ title: "Mi equipo · Integración Futsal" }] }),
  component: MiEquipoPage,
});

const POSITIONS = ["arquero", "defensa", "ala", "pivot", "universal"] as const;
const PLAYER_STATUS = ["activo", "lesionado", "suspendido", "inhabilitado"] as const;

function MiEquipoPage() {
  const { user, isAdmin, isDelegado, loading } = useAuth();
  if (loading) return <div className="p-10 text-center text-sm text-muted-foreground">Cargando…</div>;
  if (!user) return <div className="p-10 text-center">Debés iniciar sesión.</div>;
  if (!isDelegado && !isAdmin) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <Shield className="mx-auto h-10 w-10 text-destructive" />
        <h2 className="mt-3 text-xl font-bold">Acceso restringido</h2>
        <p className="mt-1 text-sm text-muted-foreground">Esta vista es sólo para delegados.</p>
        <Link to="/" className="mt-4 inline-block text-sm font-semibold text-primary hover:underline">Volver al inicio</Link>
      </div>
    );
  }
  return <DelegadoRouter userId={user.id} />;
}

function DelegadoRouter({ userId }: { userId: string }) {
  const { activeId, setActive, championships } = useActiveChampionship();
  // Todos los equipos donde el usuario es delegado (en cualquier campeonato)
  const teams = useQuery({
    queryKey: ["mi-equipo-teams", userId],
    queryFn: async () => (await supabase.from("teams").select("id,name,logo_url,primary_color,championship_id").eq("delegate_user_id", userId)).data ?? [],
  });

  if (teams.isLoading) return <div className="p-10 text-center text-sm text-muted-foreground">Cargando…</div>;
  const all = teams.data ?? [];

  if (all.length === 0) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <Users className="mx-auto h-10 w-10 text-muted-foreground" />
        <h2 className="mt-3 text-xl font-bold">Sin equipo asignado</h2>
        <p className="mt-1 text-sm text-muted-foreground">El administrador todavía no te asignó un equipo en ningún campeonato.</p>
      </div>
    );
  }

  // Filtrar por campeonato activo si hay uno
  const inActive = activeId ? all.filter((t) => t.championship_id === activeId) : [];
  if (activeId && inActive.length === 1) {
    return <DelegadoDashboard teamId={inActive[0].id} />;
  }

  // Si sólo tiene un equipo en total, entrar directo y setear el campeonato correspondiente
  if (all.length === 1) {
    const only = all[0];
    if (only.championship_id && only.championship_id !== activeId) {
      setActive(only.championship_id);
    }
    return <DelegadoDashboard teamId={only.id} />;
  }

  // Múltiples campeonatos: mostrar selector
  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="text-2xl font-black uppercase tracking-tight">Elegí un campeonato</h1>
      <p className="mt-1 text-sm text-muted-foreground">Participás como delegado en varios campeonatos. Seleccioná uno para ver tu equipo.</p>
      <div className="mt-4 grid gap-2">
        {all.map((t) => {
          const c = championships.find((x: any) => x.id === t.championship_id);
          return (
            <button
              key={t.id}
              onClick={() => { if (t.championship_id) setActive(t.championship_id); }}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 text-left hover:bg-muted"
            >
              <TeamBadge name={t.name} logoPath={t.logo_url} color={t.primary_color} size={40} />
              <div className="flex-1">
                <div className="font-bold">{t.name}</div>
                <div className="text-xs text-muted-foreground">{c?.name ?? "Campeonato"}</div>
              </div>
              <Badge variant="outline">Abrir</Badge>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DelegadoDashboard({ teamId }: { teamId: string }) {
  const qc = useQueryClient();
  const team = useQuery({
    queryKey: ["mi-equipo", teamId],
    queryFn: async () => (await supabase.from("teams").select("*").eq("id", teamId).maybeSingle()).data,
  });
  const players = useQuery({
    queryKey: ["mi-equipo-players", teamId],
    queryFn: async () => (await supabase.from("players").select("*").eq("team_id", teamId).order("jersey_number")).data ?? [],
  });
  const matches = useQuery({
    queryKey: ["mi-equipo-matches", teamId],
    queryFn: async () =>
      (await supabase.from("matches").select("*, home:home_team_id(id,name,logo_url,primary_color), away:away_team_id(id,name,logo_url,primary_color)").or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`).order("match_date", { ascending: false })).data ?? [],
  });
  const observations = useQuery({
    queryKey: ["mi-equipo-observations", teamId],
    queryFn: async () => ((await (supabase as any).from("match_observations").select("*, match_resolutions(*)").eq("team_id", teamId).order("created_at", { ascending: false })).data ?? []) as any[],
  });

  const [openTeam, setOpenTeam] = useState(false);
  const [playerEdit, setPlayerEdit] = useState<any>(null);
  const [playerOpen, setPlayerOpen] = useState(false);
  const [obsMatch, setObsMatch] = useState<any>(null);
  const [obsEditing, setObsEditing] = useState<any>(null);

  const t = team.data;
  if (!t) return <div className="p-10 text-center text-sm text-muted-foreground">Cargando equipo…</div>;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <TeamBadge name={t.name} logoPath={t.logo_url} color={t.primary_color} size={64} />
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Panel del delegado</div>
            <h1 className="text-2xl font-black uppercase tracking-tight">{t.name}</h1>
          </div>
        </div>
        <Dialog open={openTeam} onOpenChange={setOpenTeam}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5"><Pencil className="h-4 w-4" /> Editar equipo</Button>
          </DialogTrigger>
          {openTeam && <TeamEditDialog key={t.id} team={t} onSaved={() => { qc.invalidateQueries({ queryKey: ["mi-equipo", teamId] }); qc.invalidateQueries({ queryKey: ["public", "teams"] }); setOpenTeam(false); }} />}
        </Dialog>
      </div>

      <Tabs defaultValue="jugadores" className="mt-6">
        <TabsList>
          <TabsTrigger value="jugadores" className="gap-1.5"><Users className="h-3.5 w-3.5" /> Jugadores ({players.data?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="partidos" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Partidos</TabsTrigger>
          <TabsTrigger value="observaciones" className="gap-1.5"><MessageSquare className="h-3.5 w-3.5" /> Mis observaciones ({observations.data?.length ?? 0})</TabsTrigger>
        </TabsList>

        {/* JUGADORES */}
        <TabsContent value="jugadores">
          <Card><CardContent className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-widest">Plantel</h2>
              <Dialog open={playerOpen} onOpenChange={(o) => { setPlayerOpen(o); if (!o) setPlayerEdit(null); }}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1.5" onClick={() => setPlayerEdit(null)}><Plus className="h-4 w-4" /> Nuevo jugador</Button>
                </DialogTrigger>
                {playerOpen && <PlayerDialog key={playerEdit?.id ?? "new"} player={playerEdit} teamId={teamId} onSaved={() => { qc.invalidateQueries({ queryKey: ["mi-equipo-players", teamId] }); setPlayerOpen(false); setPlayerEdit(null); }} />}
              </Dialog>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  <th className="py-2 text-left">#</th><th className="text-left">Nombre</th><th className="text-left">Posición</th><th className="text-left">CI</th><th className="text-left">Estado</th><th></th>
                </tr></thead>
                <tbody>
                  {(players.data ?? []).map((p) => (
                    <tr key={p.id} className="border-b border-border/50">
                      <td className="py-2 font-bold tabular-nums">{p.jersey_number ?? "—"}</td>
                      <td className="font-semibold">{p.full_name}</td>
                      <td className="capitalize">{p.position}</td>
                      <td className="text-muted-foreground">{p.national_id ?? "—"}</td>
                      <td><Badge variant="outline">{p.status ?? (p.enabled ? "activo" : "suspendido")}</Badge></td>
                      <td className="text-right">
                        <Button size="icon" variant="ghost" onClick={() => { setPlayerEdit(p); setPlayerOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={async () => {
                          if (!confirm(`Eliminar a ${p.full_name}?`)) return;
                          const { error } = await supabase.from("players").delete().eq("id", p.id);
                          if (error) return toast.error(error.message);
                          toast.success("Jugador eliminado");
                          qc.invalidateQueries({ queryKey: ["mi-equipo-players", teamId] });
                        }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </td>
                    </tr>
                  ))}
                  {(players.data ?? []).length === 0 && <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Sin jugadores registrados. Sumá tu plantel.</td></tr>}
                </tbody>
              </table>
            </div>
          </CardContent></Card>
        </TabsContent>

        {/* PARTIDOS */}
        <TabsContent value="partidos">
          <Card><CardContent className="p-5">
            <h2 className="mb-3 text-sm font-black uppercase tracking-widest">Partidos de tu equipo</h2>
            <div className="space-y-2">
              {(matches.data ?? []).map((m: any) => {
                const home = m.home; const away = m.away;
                const finalizado = m.status === "finalizado";
                return (
                  <div key={m.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
                    <div className="text-xs text-muted-foreground">
                      {m.match_date ? format(new Date(m.match_date), "dd MMM yyyy · HH:mm", { locale: es }) : "TBD"}
                    </div>
                    <div className="flex flex-1 items-center gap-2">
                      <TeamBadge name={home?.name ?? "?"} logoPath={home?.logo_url} color={home?.primary_color} size={24} />
                      <span className="text-sm font-semibold">{home?.name}</span>
                      <span className="font-black tabular-nums">
                        {finalizado ? `${m.home_score} - ${m.away_score}` : "vs"}
                      </span>
                      <span className="text-sm font-semibold">{away?.name}</span>
                      <TeamBadge name={away?.name ?? "?"} logoPath={away?.logo_url} color={away?.primary_color} size={24} />
                    </div>
                    <Badge variant="outline">{m.status}</Badge>
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setObsMatch(m)}>
                      <MessageSquare className="h-3.5 w-3.5" /> Observación
                    </Button>
                    <Link to="/planilla/$matchId" params={{ matchId: m.id }}>
                      <Button size="sm" variant="ghost" className="gap-1.5"><FileText className="h-3.5 w-3.5" /> Planilla</Button>
                    </Link>
                  </div>
                );
              })}
              {(matches.data ?? []).length === 0 && <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Sin partidos asignados</div>}
            </div>
          </CardContent></Card>
        </TabsContent>

        {/* OBSERVACIONES */}
        <TabsContent value="observaciones">
          <Card><CardContent className="p-5">
            <h2 className="mb-3 text-sm font-black uppercase tracking-widest">Historial de observaciones</h2>
            <div className="space-y-3">
              {(observations.data ?? []).map((o: any) => (
                <div key={o.id} className="rounded-xl border border-border bg-card p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="capitalize">{o.observation_type ?? "general"}</Badge>
                      <Badge className={
                        o.status === "resuelta" || o.status === "aceptada" ? "bg-success text-success-foreground" :
                        o.status === "en_revision" ? "bg-warning text-warning-foreground" :
                        o.status === "rechazada" ? "bg-destructive text-destructive-foreground" :
                        "bg-muted text-muted-foreground"
                      }>{(o.status ?? "pendiente").replace("_", " ")}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {o.created_at ? format(new Date(o.created_at), "dd/MM/yyyy HH:mm") : ""}
                      </span>
                      {o.status === "pendiente" && (
                        <>
                          <Button size="icon" variant="ghost" onClick={() => setObsEditing(o)} title="Editar">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" title="Cancelar" onClick={async () => {
                            if (!confirm("¿Cancelar esta observación pendiente?")) return;
                            const { error } = await (supabase as any).from("match_observations").delete().eq("id", o.id);
                            if (error) return toast.error(error.message);
                            toast.success("Observación cancelada");
                            qc.invalidateQueries({ queryKey: ["mi-equipo-observations", teamId] });
                          }}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm">{o.description}</p>
                  {o.admin_response && (
                    <div className="mt-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
                      <div className="text-xs font-bold uppercase tracking-widest text-primary">Respuesta del comité</div>
                      <p className="mt-1 whitespace-pre-wrap text-sm">{o.admin_response}</p>
                    </div>
                  )}
                  {o.match_resolutions?.length > 0 && (
                    <div className="mt-3 rounded-lg border border-success/40 bg-success/5 p-3">
                      <div className="text-xs font-bold uppercase tracking-widest text-success">Resolución oficial</div>
                      {o.match_resolutions.map((r: any) => (
                        <div key={r.id} className="mt-2 text-sm">
                          <div className="font-semibold">{r.title}</div>
                          {r.description && <p className="text-muted-foreground">{r.description}</p>}
                          {r.pdf_url && <a href={r.pdf_url} target="_blank" rel="noreferrer" className="mt-1 inline-flex text-xs font-semibold text-primary hover:underline">Descargar PDF →</a>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {(observations.data ?? []).length === 0 && <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Aún no cargaste observaciones. Podés crearlas desde la pestaña Partidos.</div>}
            </div>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <ObservacionDialog
        match={obsMatch}
        teamId={teamId}
        open={!!obsMatch}
        onOpenChange={(o) => { if (!o) setObsMatch(null); }}
        onSaved={() => qc.invalidateQueries({ queryKey: ["mi-equipo-observations", teamId] })}
      />
      <ObservacionDialog
        match={null}
        teamId={teamId}
        editing={obsEditing}
        open={!!obsEditing}
        onOpenChange={(o) => { if (!o) setObsEditing(null); }}
        onSaved={() => qc.invalidateQueries({ queryKey: ["mi-equipo-observations", teamId] })}
      />
    </div>
  );
}

// -------------- Team edit dialog (solo campos permitidos al delegado) --------------
function TeamEditDialog({ team, onSaved }: { team: any; onSaved: () => void }) {
  const [f, setF] = useState({
    name: team.name ?? "",
    short_name: team.short_name ?? "",
    sigla: team.sigla ?? "",
    primary_color: team.primary_color ?? "#1e40af",
    secondary_color: team.secondary_color ?? "#ffffff",
    delegate_name: team.delegate_name ?? "",
    delegate_role: team.delegate_role ?? "",
    phone: team.phone ?? "",
    email: team.email ?? "",
    logo_url: team.logo_url ?? null,
    delegate_photo_url: team.delegate_photo_url ?? null,
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [delegatePhotoFile, setDelegatePhotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  return (
    <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
      <DialogHeader><DialogTitle>Editar mi equipo</DialogTitle></DialogHeader>
      <Tabs defaultValue="info">
        <TabsList><TabsTrigger value="info">Información</TabsTrigger><TabsTrigger value="delegado">Delegado</TabsTrigger></TabsList>
        <TabsContent value="info" className="space-y-3 pt-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Nombre del equipo</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
            <div><Label>Nombre corto</Label><Input value={f.short_name} onChange={(e) => setF({ ...f, short_name: e.target.value })} /></div>
            <div><Label>Sigla</Label><Input maxLength={5} value={f.sigla} onChange={(e) => setF({ ...f, sigla: e.target.value.toUpperCase() })} /></div>
            <div className="col-span-2"><Label>Escudo</Label><Input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)} /></div>
            <div><Label>Color principal</Label><Input type="color" value={f.primary_color} onChange={(e) => setF({ ...f, primary_color: e.target.value })} /></div>
            <div><Label>Color secundario</Label><Input type="color" value={f.secondary_color} onChange={(e) => setF({ ...f, secondary_color: e.target.value })} /></div>
          </div>
        </TabsContent>
        <TabsContent value="delegado" className="space-y-3 pt-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Nombre del delegado</Label><Input value={f.delegate_name} onChange={(e) => setF({ ...f, delegate_name: e.target.value })} /></div>
            <div><Label>Cargo</Label><Input value={f.delegate_role} onChange={(e) => setF({ ...f, delegate_role: e.target.value })} /></div>
            <div><Label>Teléfono</Label><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
            <div className="col-span-2"><Label>Correo</Label><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
            <div className="col-span-2"><Label>Fotografía</Label><Input type="file" accept="image/*" onChange={(e) => setDelegatePhotoFile(e.target.files?.[0] ?? null)} /></div>
          </div>
        </TabsContent>
      </Tabs>
      <DialogFooter>
        <Button disabled={saving} onClick={async () => {
          if (!f.name.trim()) return toast.error("Nombre requerido");
          setSaving(true);
          try {
            let logo_url = f.logo_url;
            let delegate_photo_url = f.delegate_photo_url;
            if (logoFile) logo_url = await uploadFile("team-logos", logoFile, `${team.id}/`);
            if (delegatePhotoFile) delegate_photo_url = await uploadFile("team-logos", delegatePhotoFile, `${team.id}/`);
            const payload: any = { ...f, logo_url, delegate_photo_url, sigla: f.sigla || null, short_name: f.short_name || null };
            const { error } = await supabase.from("teams").update(payload).eq("id", team.id);
            if (error) throw error;
            toast.success("Equipo actualizado");
            onSaved();
          } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
        }}>{saving ? "Guardando…" : "Guardar"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

// -------------- Player dialog --------------
function PlayerDialog({ player, teamId, onSaved }: { player: any; teamId: string; onSaved: () => void }) {
  const [f, setF] = useState({
    full_name: player?.full_name ?? "",
    jersey_number: player?.jersey_number ?? "",
    position: player?.position ?? "ala",
    national_id: player?.national_id ?? "",
    birth_date: player?.birth_date ?? "",
    phone: player?.phone ?? "",
    is_captain: player?.is_captain ?? false,
    is_vice_captain: player?.is_vice_captain ?? false,
    status: player?.status ?? "activo",
    photo_url: player?.photo_url ?? null,
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  return (
    <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
      <DialogHeader><DialogTitle>{player ? "Editar jugador" : "Nuevo jugador"}</DialogTitle></DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2"><Label>Nombre completo</Label><Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></div>
        <div><Label>Dorsal</Label><Input type="number" value={f.jersey_number} onChange={(e) => setF({ ...f, jersey_number: e.target.value })} /></div>
        <div><Label>Posición</Label>
          <Select value={f.position} onValueChange={(v) => setF({ ...f, position: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{POSITIONS.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Cédula / DNI</Label><Input value={f.national_id} onChange={(e) => setF({ ...f, national_id: e.target.value })} /></div>
        <div><Label>Fecha de nacimiento</Label><Input type="date" value={f.birth_date ?? ""} onChange={(e) => setF({ ...f, birth_date: e.target.value })} /></div>
        <div><Label>Teléfono</Label><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
        <div><Label>Estado</Label>
          <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{PLAYER_STATUS.map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="col-span-2"><Label>Foto</Label><Input type="file" accept="image/*" onChange={(e) => setPhotoFile(e.target.files?.[0] ?? null)} /></div>
        <div className="flex items-center gap-2 rounded-lg border p-3">
          <Switch checked={f.is_captain} onCheckedChange={(v) => setF({ ...f, is_captain: v })} /><Label>Capitán</Label>
        </div>
        <div className="flex items-center gap-2 rounded-lg border p-3">
          <Switch checked={f.is_vice_captain} onCheckedChange={(v) => setF({ ...f, is_vice_captain: v })} /><Label>Vice capitán</Label>
        </div>
      </div>
      <DialogFooter>
        <Button disabled={saving} onClick={async () => {
          if (!f.full_name.trim()) return toast.error("Nombre requerido");
          setSaving(true);
          try {
            let photo_url = f.photo_url;
            if (photoFile) photo_url = await uploadFile("player-photos", photoFile, `${teamId}/`);
            const payload: any = {
              ...f, photo_url, team_id: teamId,
              jersey_number: f.jersey_number === "" ? null : Number(f.jersey_number),
              birth_date: f.birth_date || null,
              national_id: f.national_id || null,
              phone: f.phone || null,
            };
            const q = player ? supabase.from("players").update(payload).eq("id", player.id) : supabase.from("players").insert(payload);
            const { error } = await q;
            if (error) throw error;
            toast.success("Guardado");
            onSaved();
          } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
        }}>{saving ? "Guardando…" : "Guardar"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}
