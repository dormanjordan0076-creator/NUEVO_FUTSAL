import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { TeamBadge } from "@/components/TeamBadge";
import { uploadFile } from "@/lib/storage";
import { roundRobin, shuffle } from "@/lib/fixture";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Shuffle, Printer, Trophy, Users, CalendarDays, ListChecks, ShieldAlert, UserCog, Tag, ExternalLink, Gavel, Layers } from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/lib/auth";
import { useActiveChampionship } from "@/lib/championship";
import { UsuariosTab } from "@/components/admin/UsuariosTab";
import { ComiteTab } from "@/components/admin/ComiteTab";
import { MotorDeportivoTab } from "@/components/admin/MotorDeportivoTab";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ObservacionDialog } from "@/components/ObservacionDialog";
import { MessageSquare } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Administración · Integración Futsal" }] }),
  validateSearch: (s: Record<string, unknown>) => ({
    tab: typeof s.tab === "string" ? s.tab : undefined,
    cat: typeof s.cat === "string" ? s.cat : undefined,
  }),
  component: AdminPage,
});

const POSITIONS = ["arquero", "defensa", "ala", "pivot", "universal"] as const;
const STATUSES = ["pendiente", "en_juego", "finalizado", "suspendido", "reprogramado"] as const;
const STATUS_LABEL: Record<string, string> = {
  pendiente: "Programado",
  en_juego: "En juego",
  finalizado: "Finalizado",
  suspendido: "Suspendido",
  reprogramado: "Reprogramado",
};

function useChampionship() {
  const { active, activeId, loading } = useActiveChampionship();
  return { data: active, isLoading: loading, activeId };
}

function AdminPage() {
  const { isAdmin, loading } = useAuth();
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const tab = search.tab ?? "equipos";
  if (loading) return <div className="p-10 text-center text-sm text-muted-foreground">Cargando…</div>;
  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-md p-10 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-destructive" />
        <h2 className="mt-3 text-xl font-bold">Acceso restringido</h2>
        <p className="mt-1 text-sm text-muted-foreground">Solo administradores pueden acceder a este panel.</p>
        <Link to="/" className="mt-4 inline-block text-sm font-semibold text-primary hover:underline">Volver al inicio</Link>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">Panel administrativo</h1>
          <p className="text-sm text-muted-foreground">Gestión integral del campeonato</p>
        </div>
      </div>
      <Tabs value={tab} onValueChange={(v) => navigate({ search: (p: any) => ({ ...p, tab: v }) })} className="mt-6">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="campeonato" className="gap-1.5"><Trophy className="h-3.5 w-3.5" /> Información</TabsTrigger>
          <TabsTrigger value="categorias" className="gap-1.5"><Tag className="h-3.5 w-3.5" /> Categorías</TabsTrigger>
          <TabsTrigger value="equipos" className="gap-1.5"><Users className="h-3.5 w-3.5" /> Equipos</TabsTrigger>
          <TabsTrigger value="jugadores" className="gap-1.5"><Users className="h-3.5 w-3.5" /> Jugadores</TabsTrigger>
          <TabsTrigger value="comite" className="gap-1.5"><Gavel className="h-3.5 w-3.5" /> Comité</TabsTrigger>
          <TabsTrigger value="usuarios" className="gap-1.5"><UserCog className="h-3.5 w-3.5" /> Usuarios</TabsTrigger>
          <TabsTrigger value="motor" className="gap-1.5"><Layers className="h-3.5 w-3.5" /> Motor deportivo</TabsTrigger>
          <TabsTrigger value="sorteo" className="gap-1.5"><Shuffle className="h-3.5 w-3.5" /> Sorteo & Fixture</TabsTrigger>
          <TabsTrigger value="partidos" className="gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> Partidos</TabsTrigger>
        </TabsList>
        <TabsContent value="campeonato"><ChampTab /></TabsContent>
        <TabsContent value="categorias"><CategoriesTab /></TabsContent>
        <TabsContent value="equipos"><TeamsTab /></TabsContent>
        <TabsContent value="jugadores"><PlayersTab /></TabsContent>
        <TabsContent value="comite"><ComiteTab /></TabsContent>
        <TabsContent value="usuarios"><UsuariosTab /></TabsContent>
        <TabsContent value="motor"><MotorDeportivoTab initialCategoryId={search.cat} /></TabsContent>
        <TabsContent value="sorteo"><DrawTab /></TabsContent>
        <TabsContent value="partidos"><MatchesTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ============== EQUIPOS ==============
function TeamsTab() {
  const champ = useChampionship();
  const qc = useQueryClient();
  const teams = useQuery({
    queryKey: ["admin", "teams", champ.activeId],
    enabled: !!champ.activeId,
    queryFn: async () => (await supabase.from("teams").select("*").eq("championship_id", champ.activeId!).order("name")).data ?? [],
  });
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);

  return (
    <Card><CardContent className="p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-black uppercase tracking-widest">Equipos ({teams.data?.length ?? 0})</h2>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEdit(null); }}>
          <DialogTrigger asChild><Button size="sm" className="gap-1.5" onClick={() => setEdit(null)}><Plus className="h-4 w-4" /> Nuevo equipo</Button></DialogTrigger>
          {open && <TeamDialog key={edit?.id ?? "new"} team={edit} championshipId={champ.data?.id} onSaved={() => { qc.invalidateQueries({ queryKey: ["admin", "teams"] }); qc.invalidateQueries({ queryKey: ["public", "teams"] }); setOpen(false); setEdit(null); }} />}
        </Dialog>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(teams.data ?? []).map((t) => (
          <div key={t.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-card">
            <TeamBadge name={t.name} logoPath={t.logo_url} color={t.primary_color} size={44} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-bold">{t.name}</span>
                {t.sigla && <Badge variant="outline" className="text-[10px]">{t.sigla}</Badge>}
                {!t.active && <Badge variant="destructive" className="text-[10px]">Inactivo</Badge>}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {t.group_name && <Badge variant="secondary">Grupo {t.group_name}</Badge>}
                {t.delegate_name && <span className="truncate">{t.delegate_name}</span>}
              </div>
            </div>
            <Link to="/equipo/$teamId" params={{ teamId: t.id }} title="Ver perfil">
              <Button size="icon" variant="ghost"><ExternalLink className="h-4 w-4" /></Button>
            </Link>
            <Button size="icon" variant="ghost" onClick={() => { setEdit(t); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
            <Button size="icon" variant="ghost" onClick={async () => {
              if (!confirm(`Eliminar equipo "${t.name}"?`)) return;
              const { error } = await supabase.from("teams").delete().eq("id", t.id);
              if (error) return toast.error(error.message);
              toast.success("Equipo eliminado");
              qc.invalidateQueries({ queryKey: ["admin", "teams"] });
            }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        ))}
        {(teams.data ?? []).length === 0 && <div className="col-span-full rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">Sin equipos. Creá el primero.</div>}
      </div>
    </CardContent></Card>
  );
}

function TeamDialog({ team, championshipId, onSaved }: { team: any; championshipId?: string; onSaved: () => void }) {
  const categories = useQuery({
    queryKey: ["admin", "categories", championshipId],
    enabled: !!championshipId,
    queryFn: async () => (await supabase.from("categories").select("id,name").eq("championship_id", championshipId!).order("sort_order")).data ?? [],
  });
  const groupsForCategory = useQuery({
    queryKey: ["admin", "groups-for-category", championshipId, team?.category_id],
    enabled: !!championshipId,
    queryFn: async () => (await (supabase as any).from("groups").select("id,name,category_id").eq("championship_id", championshipId!).order("display_order")).data ?? [],
  });
  const [f, setF] = useState({
    name: team?.name ?? "",
    short_name: team?.short_name ?? "",
    sigla: team?.sigla ?? "",
    founded_year: team?.founded_year ?? "",
    active: team?.active ?? true,
    category_id: team?.category_id ?? "",
    primary_color: team?.primary_color ?? "#1e40af",
    secondary_color: team?.secondary_color ?? "#ffffff",
    delegate_name: team?.delegate_name ?? "",
    delegate_role: team?.delegate_role ?? "",
    phone: team?.phone ?? "",
    email: team?.email ?? "",
    participation_year: team?.participation_year ?? new Date().getFullYear(),
    group_name: team?.group_name ?? "",
    logo_url: team?.logo_url ?? null,
    delegate_photo_url: team?.delegate_photo_url ?? null,
  });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [delegatePhotoFile, setDelegatePhotoFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const [suggestQuery, setSuggestQuery] = useState("");
  const [importPlayers, setImportPlayers] = useState(true);
  const suggestions = useQuery({
    queryKey: ["team-suggestions", suggestQuery, championshipId],
    enabled: !team && suggestQuery.trim().length >= 2,
    queryFn: async () => {
      const q = suggestQuery.trim();
      const { data } = await supabase.from("teams")
        .select("id,name,short_name,sigla,primary_color,secondary_color,logo_url,delegate_name,delegate_role,phone,email,delegate_photo_url,championship_id")
        .ilike("name", `%${q}%`)
        .neq("championship_id", championshipId ?? "")
        .limit(6);
      return data ?? [];
    },
  });

  async function applyReuse(src: any) {
    setF((prev) => ({
      ...prev,
      name: src.name ?? prev.name,
      short_name: src.short_name ?? prev.short_name,
      sigla: src.sigla ?? prev.sigla,
      primary_color: src.primary_color ?? prev.primary_color,
      secondary_color: src.secondary_color ?? prev.secondary_color,
      logo_url: src.logo_url ?? prev.logo_url,
      delegate_name: src.delegate_name ?? prev.delegate_name,
      delegate_role: src.delegate_role ?? prev.delegate_role,
      phone: src.phone ?? prev.phone,
      email: src.email ?? prev.email,
      delegate_photo_url: src.delegate_photo_url ?? prev.delegate_photo_url,
    }));
    toast.success(`Datos importados de "${src.name}". Al guardar podés incluir jugadores.`);
    // Guardar origen para importar jugadores luego (en state simple)
    (window as any).__reuseSrcTeamId = src.id;
  }

  return (
    <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
      <DialogHeader><DialogTitle>{team ? "Editar equipo" : "Nuevo equipo"}</DialogTitle></DialogHeader>
      {!team && (
        <div className="rounded-lg border border-dashed p-3">
          <Label className="text-xs">Reutilizar equipo de campeonatos anteriores</Label>
          <Input
            placeholder="Buscar por nombre…"
            value={suggestQuery}
            onChange={(e) => setSuggestQuery(e.target.value)}
          />
          {(suggestions.data ?? []).length > 0 && (
            <div className="mt-2 space-y-1">
              {(suggestions.data ?? []).map((s: any) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => applyReuse(s)}
                  className="flex w-full items-center justify-between rounded-md border px-2 py-1.5 text-left text-sm hover:bg-muted"
                >
                  <span className="font-semibold">{s.name}</span>
                  <span className="text-xs text-muted-foreground">Importar</span>
                </button>
              ))}
            </div>
          )}
          <label className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={importPlayers} onChange={(e) => setImportPlayers(e.target.checked)} />
            Al guardar, importar también los jugadores del equipo seleccionado
          </label>
        </div>
      )}
      <Tabs defaultValue="info">
        <TabsList>
          <TabsTrigger value="info">Información</TabsTrigger>
          <TabsTrigger value="delegado">Delegado</TabsTrigger>
        </TabsList>
        <TabsContent value="info" className="space-y-3 pt-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Nombre completo</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
            <div><Label>Nombre corto</Label><Input value={f.short_name} onChange={(e) => setF({ ...f, short_name: e.target.value })} /></div>
            <div><Label>Sigla (3-4 letras)</Label><Input maxLength={5} value={f.sigla} onChange={(e) => setF({ ...f, sigla: e.target.value.toUpperCase() })} /></div>
            <div><Label>Año de fundación</Label><Input type="number" value={f.founded_year} onChange={(e) => setF({ ...f, founded_year: e.target.value })} /></div>
            <div><Label>Año de participación</Label><Input type="number" value={f.participation_year} onChange={(e) => setF({ ...f, participation_year: +e.target.value })} /></div>
            <div><Label>Categoría</Label>
              <Select value={f.category_id || "none"} onValueChange={(v) => setF({ ...f, category_id: v === "none" ? "" : v, group_name: "" })}>
                <SelectTrigger><SelectValue placeholder="Sin categoría" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin categoría</SelectItem>
                  {(categories.data ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Grupo</Label>
              {(() => {
                if (!f.category_id) return <div className="rounded border bg-muted/30 px-2 py-1.5 text-xs text-muted-foreground">Elegí una categoría primero</div>;
                if (groupsForCategory.isLoading) return <div className="rounded border px-2 py-1.5 text-xs text-muted-foreground">Cargando…</div>;
                const gs = (groupsForCategory.data ?? []).filter((g: any) => g.category_id === f.category_id);
                if (gs.length === 0) return <div className="rounded border bg-muted/30 px-2 py-1.5 text-xs text-muted-foreground">Sin grupos</div>;
                return (
                  <Select value={f.group_name || "none"} onValueChange={(v) => setF({ ...f, group_name: v === "none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin asignar</SelectItem>
                      {gs.map((g: any) => <SelectItem key={g.id} value={g.name}>Grupo {g.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                );
              })()}
            </div>
            <div className="col-span-2"><Label>Escudo</Label><Input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)} /></div>
            <div><Label>Color principal</Label><Input type="color" value={f.primary_color} onChange={(e) => setF({ ...f, primary_color: e.target.value })} /></div>
            <div><Label>Color secundario</Label><Input type="color" value={f.secondary_color} onChange={(e) => setF({ ...f, secondary_color: e.target.value })} /></div>
            <div className="col-span-2 flex items-center gap-2 rounded-lg border p-3">
              <Switch checked={f.active} onCheckedChange={(v) => setF({ ...f, active: v })} />
              <Label className="cursor-pointer">Equipo activo</Label>
            </div>
          </div>
        </TabsContent>
        <TabsContent value="delegado" className="space-y-3 pt-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>Nombre del delegado</Label><Input value={f.delegate_name} onChange={(e) => setF({ ...f, delegate_name: e.target.value })} /></div>
            <div><Label>Cargo</Label><Input value={f.delegate_role} onChange={(e) => setF({ ...f, delegate_role: e.target.value })} placeholder="p. ej. Delegado principal" /></div>
            <div><Label>Teléfono</Label><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
            <div className="col-span-2"><Label>Correo</Label><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
            <div className="col-span-2"><Label>Fotografía</Label><Input type="file" accept="image/*" onChange={(e) => setDelegatePhotoFile(e.target.files?.[0] ?? null)} /></div>
          </div>
        </TabsContent>
      </Tabs>
      <DialogFooter>
        <Button disabled={saving} onClick={async () => {
          if (!f.name.trim()) return toast.error("Nombre requerido");
          if (!championshipId) return toast.error("Sin campeonato activo");
          if (f.sigla && (f.sigla.length < 2 || f.sigla.length > 5)) return toast.error("Sigla debe tener 2-5 letras");
          setSaving(true);
          try {
            const teamId = team?.id;
            let logo_url = f.logo_url;
            let delegate_photo_url = f.delegate_photo_url;
            if (logoFile) logo_url = await uploadFile("team-logos", logoFile, teamId ? `${teamId}/` : "");
            if (delegatePhotoFile) delegate_photo_url = await uploadFile("team-logos", delegatePhotoFile, teamId ? `${teamId}/` : "");
            const payload: any = {
              ...f, logo_url, delegate_photo_url,
              championship_id: championshipId,
              group_name: f.group_name || null,
              category_id: f.category_id || null,
              sigla: f.sigla || null,
              short_name: f.short_name || null,
              founded_year: f.founded_year === "" ? null : Number(f.founded_year),
              delegate_registered_at: team?.delegate_registered_at ?? (f.delegate_name ? new Date().toISOString() : null),
            };
            let newTeamId = team?.id ?? null;
            if (team) {
              const { error } = await supabase.from("teams").update(payload).eq("id", team.id);
              if (error) throw error;
            } else {
              const { data: ins, error } = await supabase.from("teams").insert(payload).select("id").single();
              if (error) throw error;
              newTeamId = ins.id;
            }
            // Importar jugadores del equipo reutilizado (solo si es nuevo)
            const srcId = (window as any).__reuseSrcTeamId as string | undefined;
            if (!team && srcId && importPlayers && newTeamId) {
              const { data: srcPlayers } = await supabase.from("players").select("*").eq("team_id", srcId);
              if (srcPlayers && srcPlayers.length > 0) {
                const rows = srcPlayers.map(({ id, team_id, created_at, updated_at, ...rest }: any) => ({ ...rest, team_id: newTeamId }));
                const { error: pErr } = await supabase.from("players").insert(rows);
                if (pErr) toast.warning(`Equipo creado. Jugadores no importados: ${pErr.message}`);
                else toast.success(`Se importaron ${rows.length} jugadores`);
              }
              (window as any).__reuseSrcTeamId = undefined;
            } else {
              toast.success("Guardado");
            }
            onSaved();
          } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
        }}>{saving ? "Guardando…" : "Guardar"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ============== JUGADORES ==============
function PlayersTab() {
  const qc = useQueryClient();
  const champ = useChampionship();
  const teams = useQuery({
    queryKey: ["admin", "teams", champ.activeId],
    enabled: !!champ.activeId,
    queryFn: async () => (await supabase.from("teams").select("id,name,logo_url,primary_color").eq("championship_id", champ.activeId!).order("name")).data ?? [],
  });
  const [teamId, setTeamId] = useState<string>("");
  const players = useQuery({
    queryKey: ["admin", "players", teamId],
    queryFn: async () => teamId ? ((await supabase.from("players").select("*").eq("team_id", teamId).order("jersey_number")).data ?? []) : [],
    enabled: !!teamId,
  });
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any>(null);

  return (
    <Card><CardContent className="p-5">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Select value={teamId} onValueChange={setTeamId}>
          <SelectTrigger className="w-64"><SelectValue placeholder="Elegí un equipo" /></SelectTrigger>
          <SelectContent>{(teams.data ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
        </Select>
        {teamId && (
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEdit(null); }}>
            <DialogTrigger asChild><Button size="sm" className="ml-auto gap-1.5" onClick={() => setEdit(null)}><Plus className="h-4 w-4" /> Nuevo jugador</Button></DialogTrigger>
            {open && <PlayerDialog key={edit?.id ?? "new"} player={edit} teamId={teamId} onSaved={() => { qc.invalidateQueries({ queryKey: ["admin", "players", teamId] }); setOpen(false); setEdit(null); }} />}
          </Dialog>
        )}
      </div>
      {!teamId && <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">Seleccioná un equipo para ver/registrar jugadores</div>}
      {teamId && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="border-b text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              <th className="py-2 text-left">#</th><th className="text-left">Jugador</th><th className="text-left">Posición</th><th className="text-left">CI</th><th className="text-center">C/VC</th><th className="text-left">Estado</th><th></th>
            </tr></thead>
            <tbody>{(players.data ?? []).map((p) => (
              <tr key={p.id} className="border-b border-border/50">
                <td className="py-2 tabular-nums font-bold">{p.jersey_number ?? "—"}</td>
                <td className="font-semibold">{p.full_name}</td>
                <td className="capitalize">{p.position}</td>
                <td className="text-muted-foreground">{p.national_id ?? "—"}</td>
                <td className="text-center text-xs">
                  {p.is_captain && <Badge className="mr-1 bg-primary text-primary-foreground">C</Badge>}
                  {p.is_vice_captain && <Badge variant="secondary">VC</Badge>}
                </td>
                <td>
                  <Badge className={
                    (p.status ?? "activo") === "activo" ? "bg-success text-success-foreground" :
                    (p.status ?? "activo") === "lesionado" ? "bg-warning text-warning-foreground" :
                    (p.status ?? "activo") === "inhabilitado" ? "bg-muted text-muted-foreground" :
                    "bg-destructive text-destructive-foreground"
                  }>{p.status ?? (p.enabled ? "activo" : "suspendido")}</Badge>
                </td>
                <td className="text-right">
                  <Button size="icon" variant="ghost" onClick={() => { setEdit(p); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={async () => {
                    if (!confirm(`Eliminar ${p.full_name}?`)) return;
                    const { error } = await supabase.from("players").delete().eq("id", p.id);
                    if (error) return toast.error(error.message);
                    qc.invalidateQueries({ queryKey: ["admin", "players", teamId] });
                  }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </td>
              </tr>
            ))}
            {teamId && (players.data ?? []).length === 0 && <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">Sin jugadores</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </CardContent></Card>
  );
}

function PlayerDialog({ player, teamId, onSaved }: any) {
  const [f, setF] = useState({
    full_name: player?.full_name ?? "",
    jersey_number: player?.jersey_number ?? "",
    birth_date: player?.birth_date ?? "",
    national_id: player?.national_id ?? "",
    position: player?.position ?? "universal",
    phone: player?.phone ?? "",
    email: player?.email ?? "",
    status: (player?.status ?? (player?.enabled === false ? "suspendido" : "activo")) as "activo" | "suspendido" | "lesionado" | "inhabilitado",
    is_captain: player?.is_captain ?? false,
    is_vice_captain: player?.is_vice_captain ?? false,
    notes: player?.notes ?? "",
    photo_url: player?.photo_url ?? null,
  });
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const age = f.birth_date ? (() => {
    const b = new Date(f.birth_date); const n = new Date();
    let a = n.getFullYear() - b.getFullYear();
    const m = n.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && n.getDate() < b.getDate())) a--;
    return isNaN(a) ? null : a;
  })() : null;
  return (
    <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
      <DialogHeader><DialogTitle>{player ? "Editar jugador" : "Nuevo jugador"}</DialogTitle></DialogHeader>
      <div className="grid gap-3">
        <div><Label>Nombre completo</Label><Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></div>
        <div><Label>Foto</Label><Input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Dorsal</Label><Input type="number" min={0} value={f.jersey_number} onChange={(e) => setF({ ...f, jersey_number: e.target.value })} /></div>
          <div><Label>Posición</Label>
            <Select value={f.position} onValueChange={(v) => setF({ ...f, position: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{POSITIONS.map((p) => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><Label>Fecha de nacimiento</Label><Input type="date" value={f.birth_date ?? ""} onChange={(e) => setF({ ...f, birth_date: e.target.value })} /></div>
          <div><Label>Edad</Label><Input readOnly value={age ?? ""} placeholder="—" /></div>
          <div><Label>Cédula</Label><Input value={f.national_id} onChange={(e) => setF({ ...f, national_id: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Teléfono</Label><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
          <div><Label>Email</Label><Input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Estado</Label>
            <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v as any })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="activo">Activo</SelectItem>
                <SelectItem value="suspendido">Suspendido</SelectItem>
                <SelectItem value="lesionado">Lesionado</SelectItem>
                <SelectItem value="inhabilitado">Inhabilitado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={f.is_captain} onCheckedChange={(v) => setF({ ...f, is_captain: v, is_vice_captain: v ? false : f.is_vice_captain })} />
              <Label className="cursor-pointer">Capitán</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={f.is_vice_captain} onCheckedChange={(v) => setF({ ...f, is_vice_captain: v, is_captain: v ? false : f.is_captain })} />
              <Label className="cursor-pointer">Vice</Label>
            </div>
          </div>
        </div>
        <div><Label>Observaciones</Label><Textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
      </div>
      <DialogFooter>
        <Button disabled={saving} onClick={async () => {
          if (!f.full_name.trim()) return toast.error("Nombre requerido");
          setSaving(true);
          try {
            let photo_url = f.photo_url;
            if (file) photo_url = await uploadFile("player-photos", file, `${teamId}/`);
            const payload: any = {
              full_name: f.full_name,
              jersey_number: f.jersey_number === "" ? null : Number(f.jersey_number),
              birth_date: f.birth_date || null,
              national_id: f.national_id || null,
              position: f.position,
              phone: f.phone || null,
              email: f.email || null,
              status: f.status,
              enabled: f.status === "activo",
              is_captain: f.is_captain,
              is_vice_captain: f.is_vice_captain,
              notes: f.notes || null,
              photo_url,
              team_id: teamId,
            };
            const q = player ? supabase.from("players").update(payload).eq("id", player.id) : supabase.from("players").insert(payload);
            const { error } = await q;
            if (error) {
              if (error.message.includes("players_team_jersey_unique")) return toast.error("Ya existe un jugador con ese dorsal");
              if (error.message.includes("players_team_captain_unique")) return toast.error("Ya existe un capitán en este equipo");
              if (error.message.includes("players_team_vice_captain_unique")) return toast.error("Ya existe un vicecapitán en este equipo");
              throw error;
            }
            toast.success("Guardado"); onSaved();
          } catch (e: any) { toast.error(e.message); } finally { setSaving(false); }
        }}>{saving ? "Guardando…" : "Guardar"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

// ============== CATEGORÍAS ==============
function CategoriesTab() {
  const champ = useChampionship();
  const qc = useQueryClient();
  const cats = useQuery({
    queryKey: ["admin", "categories", champ.activeId],
    enabled: !!champ.activeId,
    queryFn: async () => (await supabase.from("categories").select("*").eq("championship_id", champ.activeId!).order("display_order").order("sort_order").order("name")).data ?? [],
  });
  const allGroups = useQuery({
    queryKey: ["admin", "groups", champ.activeId],
    enabled: !!champ.activeId,
    queryFn: async () => (await (supabase as any).from("groups").select("*").eq("championship_id", champ.activeId!).order("display_order")).data ?? [],
  });
  
  const emptyForm = { name: "", display_order: 0, sort_order: 0, description: "", age_condition: "", status: "active", use_groups: false, groups_count: 0, group_names: [] as string[] };
  const [f, setF] = useState<any>(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);

  function reset() { setF({ ...emptyForm, group_names: [] }); setEditId(null); }

  function setGroupsCount(n: number) {
    const count = Math.max(0, Math.min(26, n));
    const names = [...(f.group_names ?? [])];
    while (names.length < count) names.push(String.fromCharCode(65 + names.length));
    names.length = count;
    setF({ ...f, groups_count: count, group_names: names });
  }

  async function save() {
    if (!f.name.trim()) return toast.error("Nombre requerido");
    if (!champ.data?.id) return toast.error("Sin campeonato activo");

    // Validación: no reducir cantidad de grupos si hay equipos asignados a grupos que van a desaparecer
    if (editId && f.use_groups) {
      const existingGroups = (allGroups.data ?? []).filter((g: any) => g.category_id === editId);
      const desiredNames = new Set((f.group_names ?? []).map((n: string) => n.trim()).filter(Boolean));
      const groupsToRemove = existingGroups.filter((g: any) => !desiredNames.has(g.name));
      const parts: any[] = [];
      const blockedGroup = groupsToRemove.find((g: any) => parts.some((p: any) => p.group_id === g.id));
      if (blockedGroup) {
        return toast.error(`No se puede eliminar el grupo "${blockedGroup.name}" porque tiene equipos asignados.`);
      }
    }
    // Si se pasa de "usa grupos" a "sin grupos", verificar que ningún equipo esté asignado a un grupo existente
    if (editId && !f.use_groups) {
      const existingGroups = (allGroups.data ?? []).filter((g: any) => g.category_id === editId);
      const parts: any[] = [];
      const stillAssigned = existingGroups.some((g: any) => parts.some((p: any) => p.group_id === g.id));
      if (stillAssigned) {
        return toast.error("Hay equipos asignados a grupos de esta categoría. Reasigná antes de desactivar grupos.");
      }
    }

    const payload: any = {
      name: f.name.trim(),
      display_order: f.display_order,
      sort_order: f.sort_order,
      description: f.description || null,
      age_condition: f.age_condition || null,
      status: f.status,
      use_groups: f.use_groups,
      groups_count: f.use_groups ? f.groups_count : 0,
      championship_id: champ.data.id,
    };

    let categoryId = editId;
    if (editId) {
      const { error } = await supabase.from("categories").update(payload).eq("id", editId);
      if (error) return toast.error(error.message);
    } else {
      const { data, error } = await supabase.from("categories").insert(payload).select("id").single();
      if (error) return toast.error(error.message);
      categoryId = (data as any)?.id ?? null;
    }

    // Sync de grupos
    if (categoryId) {
      const existing = (allGroups.data ?? []).filter((g: any) => g.category_id === categoryId);
      if (f.use_groups) {
        const desired = (f.group_names ?? []).map((n: string, i: number) => ({ name: (n || "").trim() || String.fromCharCode(65 + i), display_order: i }));
        const desiredNames = new Set(desired.map((g: any) => g.name));
        // eliminar los que ya no están (y no tienen equipos)
        for (const g of existing) {
          if (!desiredNames.has(g.name)) {
            await (supabase as any).from("groups").delete().eq("id", g.id);
          }
        }
        // upsert los deseados
        for (const g of desired) {
          const found = existing.find((e: any) => e.name === g.name);
          if (found) {
            await (supabase as any).from("groups").update({ display_order: g.display_order, sort_order: g.display_order }).eq("id", found.id);
          } else {
            await (supabase as any).from("groups").insert({
              championship_id: champ.data.id,
              category_id: categoryId,
              name: g.name,
              display_order: g.display_order,
              sort_order: g.display_order,
            });
          }
        }
      } else {
        // sin grupos: eliminar todos los grupos existentes de la categoría
        for (const g of existing) {
          await (supabase as any).from("groups").delete().eq("id", g.id);
        }
      }
    }

    toast.success(editId ? "Categoría actualizada" : "Categoría creada");
    reset();
    qc.invalidateQueries({ queryKey: ["admin", "categories"] });
    qc.invalidateQueries({ queryKey: ["admin", "groups"] });
  }

  function edit(c: any) {
    setEditId(c.id);
    const catGroups = (allGroups.data ?? []).filter((g: any) => g.category_id === c.id).sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0));
    setF({
      name: c.name ?? "",
      display_order: c.display_order ?? 0,
      sort_order: c.sort_order ?? 0,
      description: c.description ?? "",
      age_condition: c.age_condition ?? "",
      status: c.status ?? "active",
      use_groups: c.use_groups ?? false,
      groups_count: c.groups_count ?? catGroups.length,
      group_names: catGroups.length ? catGroups.map((g: any) => g.name) : [],
    });
  }

  return (
    <Card><CardContent className="p-5">
      <h2 className="mb-3 text-sm font-black uppercase tracking-widest">Categorías ({cats.data?.length ?? 0})</h2>

      <div className="mb-4 grid gap-2 rounded-lg border border-border bg-card/50 p-3 sm:grid-cols-2">
        <div><Label>Nombre</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="p. ej. Primera División" /></div>
        <div><Label>Condición de edad</Label><Input value={f.age_condition} onChange={(e) => setF({ ...f, age_condition: e.target.value })} placeholder="p. ej. Sub-17 · Libre" /></div>
        <div className="sm:col-span-2"><Label>Descripción</Label><Textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
        <div><Label>Orden</Label><Input type="number" value={f.display_order} onChange={(e) => setF({ ...f, display_order: +e.target.value, sort_order: +e.target.value })} /></div>
        <div>
          <Label>Estado</Label>
          <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Activa</SelectItem>
              <SelectItem value="paused">Pausada</SelectItem>
              <SelectItem value="finished">Finalizada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2 rounded-lg border p-2">
          <Switch checked={f.use_groups} onCheckedChange={(v) => { if (!v) setF({ ...f, use_groups: false, groups_count: 0, group_names: [] }); else setF({ ...f, use_groups: true, groups_count: Math.max(1, f.groups_count || 2), group_names: f.group_names?.length ? f.group_names : ["A", "B"] }); }} />
          <Label className="cursor-pointer">¿Esta categoría utilizará grupos?</Label>
        </div>
        <div>
          <Label>Cantidad de grupos</Label>
          <Input type="number" min={0} max={26} value={f.groups_count} onChange={(e) => setGroupsCount(+e.target.value)} disabled={!f.use_groups} />
        </div>
        {f.use_groups && f.groups_count > 0 && (
          <div className="sm:col-span-2">
            <Label>Nombre de cada grupo</Label>
            <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {Array.from({ length: f.groups_count }).map((_, i) => (
                <Input
                  key={i}
                  value={f.group_names?.[i] ?? String.fromCharCode(65 + i)}
                  onChange={(e) => {
                    const names = [...(f.group_names ?? [])];
                    while (names.length < f.groups_count) names.push(String.fromCharCode(65 + names.length));
                    names[i] = e.target.value;
                    setF({ ...f, group_names: names });
                  }}
                  placeholder={`Grupo ${String.fromCharCode(65 + i)}`}
                />
              ))}
            </div>
          </div>
        )}
        <div className="flex items-end gap-2 sm:col-span-2">
          <Button onClick={save} className="gap-1.5"><Plus className="h-4 w-4" /> {editId ? "Guardar cambios" : "Añadir categoría"}</Button>
          {editId && <Button variant="ghost" onClick={reset}>Cancelar</Button>}
        </div>
      </div>

      <div className="space-y-1">
        {(cats.data ?? []).map((c: any) => {
          const catGroups = (allGroups.data ?? []).filter((g: any) => g.category_id === c.id);
          return (
            <div key={c.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card/50 px-3 py-2 text-sm">
              <Badge variant="outline" className="tabular-nums">{c.display_order ?? c.sort_order ?? 0}</Badge>
              <span className="font-semibold">{c.name}</span>
              {c.age_condition && <Badge variant="secondary" className="text-[10px]">{c.age_condition}</Badge>}
              {c.use_groups && <Badge variant="outline" className="text-[10px]">Grupos: {catGroups.map((g: any) => g.name).join(", ") || "—"}</Badge>}
              <Badge variant={c.status === "active" ? "default" : "secondary"} className="text-[10px] capitalize">{c.status ?? "active"}</Badge>
              {c.description && <span className="text-xs text-muted-foreground truncate max-w-xs">{c.description}</span>}
              <div className="ml-auto flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => edit(c)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={async () => {
                  if (!confirm(`Eliminar categoría "${c.name}"?`)) return;
                  const { error } = await supabase.from("categories").delete().eq("id", c.id);
                  if (error) return toast.error(error.message);
                  qc.invalidateQueries({ queryKey: ["admin", "categories"] });
                  qc.invalidateQueries({ queryKey: ["admin", "groups"] });
                }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          );
        })}
        {(cats.data ?? []).length === 0 && <div className="rounded-lg border border-dashed p-8 text-center text-xs text-muted-foreground">Sin categorías</div>}
      </div>
    </CardContent></Card>
  );
}

// ============== SORTEO + FIXTURE ==============
function DrawTab() {
  const champ = useChampionship();
  const [categoryId, setCategoryId] = useState<string>("");

  const cats = useQuery({
    queryKey: ["admin", "categories", champ.activeId],
    enabled: !!champ.activeId,
    queryFn: async () => (await supabase.from("categories").select("*").eq("championship_id", champ.activeId!).order("display_order").order("sort_order").order("name")).data ?? [],
  });

  if (!champ.activeId) return <div className="p-6 text-sm text-muted-foreground">Seleccioná un campeonato activo.</div>;

  const category = (cats.data ?? []).find((c: any) => c.id === categoryId);

  return (
    <div className="space-y-4">
      <Card><CardContent className="p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1">
            <Label>Categoría</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue placeholder="Elegí una categoría" /></SelectTrigger>
              <SelectContent>
                {(cats.data ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <p className="text-xs text-muted-foreground">Flujo: Configuración → Equipos → Sorteo → Fixture → Competencia</p>
        </div>
      </CardContent></Card>

      {category ? (
        <CategoryDrawFlow category={category} championshipId={champ.activeId} />
      ) : (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">
          Elegí una categoría para gestionar el sorteo y el fixture.
        </CardContent></Card>
      )}
    </div>
  );
}

function StatusStep({ done, active, label }: { done: boolean; active?: boolean; label: string }) {
  return (
    <div className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${
      done ? "border-primary/40 bg-primary/10 text-primary" : active ? "border-amber-500/40 bg-amber-500/10 text-amber-600" : "border-border bg-card text-muted-foreground"
    }`}>
      <span>{done ? "✓" : active ? "●" : "○"}</span>
      <span>{label}</span>
    </div>
  );
}

function CategoryDrawFlow({ category, championshipId }: { category: any; championshipId: string }) {
  const qc = useQueryClient();

  const groups = useQuery({
    queryKey: ["admin", "groups", championshipId, category.id],
    queryFn: async () => (await (supabase as any).from("groups").select("*").eq("championship_id", championshipId).eq("category_id", category.id).order("display_order")).data ?? [],
  });

 
  // Aislamiento estricto: sólo equipos del campeonato+categoría activa.
  const teams = useQuery({
    queryKey: ["admin", "teams", championshipId, category.id],
    queryFn: async () => (await supabase.from("teams").select("id,name,logo_url,primary_color,category_id,group_name").eq("championship_id", championshipId).eq("category_id", category.id).order("name")).data ?? [],
  });

  const phases = useQuery({
    queryKey: ["admin", "phases", championshipId, category.id],
    queryFn: async () => ((await (supabase as any).from("phases").select("*").eq("championship_id", championshipId).eq("category_id", category.id).order("display_order")).data ?? []) as any[],
  });

  const matches = useQuery({
    queryKey: ["admin", "matches", championshipId, category.id],
    queryFn: async () => ((await supabase.from("matches").select("*").eq("championship_id", championshipId)).data ?? []) as any[],
  });

  const useGroups = !!category.use_groups;
  const parts = teams.data ?? [];
  console.log(parts);
  const grps = groups.data ?? [];
  const teamById = new Map((teams.data ?? []).map((t: any) => [t.id, t]));

  const teamsRegistered = parts.length > 0;
  const drawDone =
  useGroups
    ? parts.length > 0 &&
      parts.every((t:any)=>!!t.group_name)
    : true;
  const phaseIds = new Set((phases.data ?? []).map((ph: any) => ph.id));
  const catMatches = (matches.data ?? []).filter((m: any) => m.phase_id && phaseIds.has(m.phase_id));
  const fixtureDone = catMatches.length > 0;
  const playedMatches = catMatches.filter((m: any) => m.status === "finalizado" || m.home_score !== null || m.away_score !== null);
  const inCompetencia = playedMatches.length > 0;

  return (
    <div className="space-y-4">
      {/* Pipeline de estado */}
      <Card><CardContent className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          <StatusStep done label="Categoría creada" />
          <span className="text-muted-foreground">→</span>
          <StatusStep done={teamsRegistered} active={!teamsRegistered} label={`Equipos (${parts.length})`} />
          {useGroups && <><span className="text-muted-foreground">→</span>
            <StatusStep done={drawDone} active={teamsRegistered && !drawDone} label="Sorteo realizado" />
          </>}
          <span className="text-muted-foreground">→</span>
          <StatusStep done={fixtureDone} active={(useGroups ? drawDone : teamsRegistered) && !fixtureDone} label={`Fixture (${catMatches.length})`} />
          <span className="text-muted-foreground">→</span>
          <StatusStep done={inCompetencia} active={fixtureDone && !inCompetencia} label="En competencia" />
        </div>
      </CardContent></Card>

      {/* Sorteo: solo si usa grupos */}
      {useGroups && (
        <DrawSection
          category={category}
          championshipId={championshipId}
          groups={grps}
          participations={parts}
          teamById={teamById}
          onChanged={() => {
            qc.invalidateQueries({ queryKey: ["admin", "team_participations", championshipId, category.id] });
          }}
        />
      )}

      {/* Fixture por fase */}
      <FixtureSection
        category={category}
        championshipId={championshipId}
        phases={phases.data ?? []}
        groups={grps}
        participations={parts}
        teamById={teamById}
        matches={catMatches}
        canGenerate={useGroups ? drawDone : teamsRegistered}
        onChanged={() => {
          qc.invalidateQueries({ queryKey: ["admin", "matches", championshipId, category.id] });
          qc.invalidateQueries({ queryKey: ["admin", "matches"] });
          qc.invalidateQueries({ queryKey: ["public", "matches"] });
        }}
      />
    </div>
  );
}

function DrawSection({
  category, championshipId, groups, participations, teamById, onChanged,
}: {
  category: any; championshipId: string; groups: any[]; participations: any[]; teamById: Map<string, any>; onChanged: () => void;
}) {
  const [dlgOpen, setDlgOpen] = useState(false);
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [assignments, setAssignments] = useState<Record<string, string>>({}); // participation.id -> group_id

  function openDialog() {
  const initial: Record<string, string> = {};

  for (const p of participations) {
    const grupo = groups.find((g: any) => g.name === p.group_name);
    initial[p.id] = grupo?.id ?? "";
  }

  setAssignments(initial);
  setMode("auto");
  setDlgOpen(true);
}

  function autoDistribute() {
    if (!groups.length) return toast.error("La categoría no tiene grupos configurados");
    const shuffled = shuffle(participations);
    const next: Record<string, string> = {};
    shuffled.forEach((p, i) => {
      const g = groups[i % groups.length];
      next[p.id] = g.id;
    });
    setAssignments(next);
    toast.success("Distribución automática lista. Revisá y confirmá.");
  }

  async function confirmDraw() {
    // Validaciones
    const missing = participations.filter((t:any)=>!assignments[t.id]);
    if(missing.length){toast.error(`Hay ${missing.length} equipos sin grupo.`);return;}
    const updates = participations.map((team: any) => {
  const group = groups.find((g: any) => g.id === assignments[team.id]);

  return supabase
    .from("teams")
    .update({
      group_name: group?.name ?? null
    })
    .eq("id", team.id);
});

  const results=await Promise.all(updates);

  const error=results.find((r:any)=>r.error);

  if(error){
      toast.error(error?.error?.message ?? "Error");
      return;
  }

  toast.success("Distribución de grupos actualizada");

  setDlgOpen(false);

  onChanged();

}

  const canDraw = participations.length > 0 && groups.length > 0;

  return (
    <Card><CardContent className="p-5 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
  <div>
    <h2 className="text-sm font-black uppercase tracking-widest">
      Grupos
    </h2>

    <p className="text-xs text-muted-foreground">
      {groups.length} grupo(s) · {participations.length} equipo(s)
    </p>
  </div>

  <Button
    size="sm"
    variant="outline"
    className="ml-auto gap-1.5"
    disabled={!canDraw}
    onClick={openDialog}
  >
    <Shuffle className="h-4 w-4" />
    Redistribuir equipos
  </Button>
</div>

      {!participations.length && (
        <div className="rounded border border-dashed p-4 text-center text-xs text-muted-foreground">
          Registrá equipos en la pestaña <b>Equipos</b> antes de sortear.
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {groups.map((g) => {
          const teamsInGroup = participations.filter(
  (p: any) => p.group_name === g.name
);
          return (
            <div key={g.id} className="rounded-lg border border-border bg-card/50 p-3">
              <div className="mb-2 text-xs font-black uppercase tracking-widest text-primary">Grupo {g.name} ({teamsInGroup.length})</div>
              <div className="space-y-1">
                {teamsInGroup.map((p) => {
                  const t: any = teamById.get(p.id);
                  return (
                    <div key={p.id} className="flex items-center gap-2 rounded border border-border/50 bg-background/50 px-2 py-1 text-xs">
                      {t && <TeamBadge name={t.name} logoPath={t.logo_url} color={t.primary_color} size={20} />}
                      <span className="truncate font-semibold">{t?.name ?? "—"}</span>
                    </div>
                  );
                })}
                {teamsInGroup.length === 0 && <p className="text-[11px] text-muted-foreground">Vacío</p>}
              </div>
            </div>
          );
        })}
        {(() => {
          const sinGrupo = participations.filter(
  (p: any) => !p.group_name
);
          if (!sinGrupo.length) return null;
          return (
            <div className="rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 p-3">
              <div className="mb-2 text-xs font-black uppercase tracking-widest text-amber-600">Sin grupo ({sinGrupo.length})</div>
              <div className="space-y-1">
                {sinGrupo.map((p) => {
                  const t: any = teamById.get(p.id);
                  return <div key={p.id} className="truncate text-xs font-semibold">{t?.name ?? "—"}</div>;
                })}
              </div>
            </div>
          );
        })()}
      </div>

      <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>Redistribuir equipos · {category.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button size="sm" variant={mode === "auto" ? "default" : "outline"} onClick={() => setMode("auto")} className="gap-1.5">
                <Shuffle className="h-3.5 w-3.5" /> Redistribución automática
              </Button>
              <Button size="sm" variant={mode === "manual" ? "default" : "outline"} onClick={() => setMode("manual")} className="gap-1.5">
                <Pencil className="h-3.5 w-3.5" /> Reasignación manual
              </Button>
              {mode === "auto" && (
                <Button size="sm" variant="secondary" className="ml-auto" onClick={autoDistribute}>Redistribuir</Button>
              )}
            </div>

            {mode === "auto" && (
              <p className="text-xs text-muted-foreground">
                Redistribuye automáticamente los equipos entre los grupos.
También podés mover cualquier equipo manualmente antes de guardar los cambios.
              </p>
            )}

            <div className="max-h-[50vh] space-y-1 overflow-y-auto rounded border border-border p-2">
              {participations.map((p) => {
                const t: any = teamById.get(p.id);
                return (
                  <div key={p.id} className="flex items-center gap-2 rounded border border-border/50 bg-card/50 px-2 py-1.5 text-sm">
                    <span className="flex-1 truncate font-semibold">{t?.name ?? "—"}</span>
                    <Select value={assignments[p.id] ?? ""} onValueChange={(v) => setAssignments({ ...assignments, [p.id]: v })}>
                      <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Elegí grupo" /></SelectTrigger>
                      <SelectContent>
                        {groups.map((g) => <SelectItem key={g.id} value={g.id}>Grupo {g.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDlgOpen(false)}>Cancelar</Button>
            <Button onClick={confirmDraw}>Guardar distribución</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </CardContent></Card>
  );
}

function FixtureSection({
  category, championshipId, phases, groups, participations, teamById, matches, canGenerate, onChanged,
}: {
  category: any; championshipId: string; phases: any[]; groups: any[]; participations: any[];
  teamById: Map<string, any>; matches: any[]; canGenerate: boolean; onChanged: () => void;
}) {
  const [openPhase, setOpenPhase] = useState<any | null>(null);
  const [format, setFormat] = useState<"round_robin" | "ida_vuelta">("round_robin");
  const [busy, setBusy] = useState(false);
  const [manualPhase, setManualPhase] = useState<any | null>(null);
  const [manualForm, setManualForm] = useState<{ home: string; away: string; when: string; venue: string; group_name: string }>({ home: "", away: "", when: "", venue: "", group_name: "" });

  const matchesByPhase = new Map<string, any[]>();
  for (const m of matches) {
    if (!m.phase_id) continue;
    const arr = matchesByPhase.get(m.phase_id) ?? [];
    arr.push(m);
    matchesByPhase.set(m.phase_id, arr);
  }

  function openDialog(phase: any) {
    setOpenPhase(phase);
    setFormat(phase.kind === "ida_vuelta" ? "ida_vuelta" : "round_robin");
  }

  async function generar(regenerate: boolean) {
    if (!openPhase) return;
    const phase = openPhase;
    setBusy(true);
    try {
      const existing = matchesByPhase.get(phase.id) ?? [];
      const played = existing.filter((m) => m.status === "finalizado" || m.home_score !== null || m.away_score !== null);
      if (existing.length > 0 && !regenerate) {
        toast.error("Ya existe fixture para esta fase. Usá Regenerar.");
        return;
      }
      if (played.length > 0) {
        toast.error(`No se puede regenerar: hay ${played.length} partido(s) ya jugados.`);
        return;
      }
      if (existing.length > 0) {
        // borrar solo los no jugados de esta fase
        const idsToDelete = existing.map((m) => m.id);
        const { error: delErr } = await supabase.from("matches").delete().in("id", idsToDelete);
        if (delErr) throw delErr;
      }

      const doubleRound = format === "ida_vuelta";
      const rows: any[] = [];

      if (phase.kind === "grupos") {
        if (!category.use_groups) { toast.error("La categoría no usa grupos"); return; }
        const bad = participations.filter((p: any) => !p.group_name);

if (bad.length) {
  toast.error(`Hay ${bad.length} equipo(s) sin grupo. Completá el sorteo.`);
  return;
}
        for (const g of groups) {
          const teamIds = participations
  .filter((p: any) => p.group_name === g.name)
  .map((p: any) => p.id);
          if (teamIds.length < 2) continue;
          const pairings = roundRobin(teamIds, doubleRound);
          for (const p of pairings) {
            rows.push({
              championship_id: championshipId,
              phase: "grupos" as const,
              phase_id: phase.id,
              group_name: g.name,
              matchday: p.matchday,
              home_team_id: p.home,
              away_team_id: p.away,
              status: "pendiente" as const,
            });
          }
        }
      } else if (phase.kind === "liga" || phase.kind === "ida_vuelta") {
        // Equipos de esta fase: phase_participants si existen, si no todos los inscritos en la categoría
        const { data: pp } = await (supabase as any)
  .from("phase_participants")
  .select("team_id")
  .eq("phase_id", phase.id);

const teamIds =
  pp && pp.length > 0
    ? pp.map((x: any) => x.team_id)
    : participations.map((p: any) => p.id);
        if (teamIds.length < 2) { toast.error("Se necesitan al menos 2 equipos"); return; }
        const pairings = roundRobin(teamIds, doubleRound || phase.kind === "ida_vuelta");
        for (const p of pairings) {
          rows.push({
            championship_id: championshipId,
            phase: "liguilla_a" as const,
            phase_id: phase.id,
            matchday: p.matchday,
            home_team_id: p.home,
            away_team_id: p.away,
            status: "pendiente" as const,
          });
        }
      } else {
        toast.error("Este tipo de fase no admite fixture automático. Creá los cruces manualmente en Partidos.");
        return;
      }

      if (!rows.length) { toast.error("No se generaron partidos"); return; }
      const { error } = await supabase.from("matches").insert(rows);
      if (error) throw error;
      toast.success(`${rows.length} partido(s) generado(s)`);
      setOpenPhase(null);
      onChanged();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card><CardContent className="p-5 space-y-3">
      <div>
        <h2 className="text-sm font-black uppercase tracking-widest">Fixture por fase</h2>
        <p className="text-xs text-muted-foreground">Cada fase mantiene su propio fixture. Generalo cuando corresponda.</p>
      </div>

      {!canGenerate && (
        <div className="rounded border border-dashed p-3 text-xs text-muted-foreground">
          {category.use_groups
            ? "Completá el sorteo antes de generar fixtures."
            : "Registrá equipos en Equipos antes de generar fixtures."}
        </div>
      )}

      {phases.length === 0 && (
        <div className="rounded border border-dashed p-3 text-xs text-muted-foreground">
          Esta categoría no tiene fases. Definilas en <b>Motor deportivo</b>.
        </div>
      )}

      <div className="space-y-2">
        {phases.map((ph) => {
          const ms = matchesByPhase.get(ph.id) ?? [];
          const played = ms.filter((m) => m.status === "finalizado" || m.home_score !== null || m.away_score !== null).length;
          const isAuto = ph.kind === "grupos" || ph.kind === "liga" || ph.kind === "ida_vuelta";
          return (
            <div key={ph.id} className="flex flex-wrap items-center gap-2 rounded border border-border bg-card/50 px-3 py-2 text-sm">
              <Badge variant="outline" className="font-mono text-[10px]">#{ph.display_order + 1}</Badge>
              <span className="font-semibold">{ph.name}</span>
              <Badge variant="secondary" className="text-[10px] capitalize">{ph.kind}</Badge>
              <span className="text-[11px] text-muted-foreground">
                {ms.length} partido(s){played ? ` · ${played} jugado(s)` : ""}
              </span>
              <div className="ml-auto flex flex-wrap gap-2">
                {isAuto && (
                  <Button size="sm" variant={ms.length ? "outline" : "default"} disabled={!canGenerate} onClick={() => openDialog(ph)} className="gap-1.5">
                    <ListChecks className="h-3.5 w-3.5" />
                    {ms.length ? "Regenerar fixture" : "Generar fixture"}
                  </Button>
                )}
                <Button size="sm" variant="outline" disabled={!canGenerate} onClick={() => { setManualPhase(ph); setManualForm({ home: "", away: "", when: "", venue: "", group_name: "" }); }} className="gap-1.5">
                  + Cruce manual
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!openPhase} onOpenChange={(o) => !o && setOpenPhase(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Generar fixture · {openPhase?.name}</DialogTitle></DialogHeader>
          {openPhase && (() => {
            const ms = matchesByPhase.get(openPhase.id) ?? [];
            const played = ms.filter((m) => m.status === "finalizado" || m.home_score !== null || m.away_score !== null).length;
            const teamCount = openPhase.kind === "grupos"
              ? participations.filter((p) => !!p.group_name).length
              : participations.length;
            return (
              <div className="space-y-3 text-sm">
                <div className="rounded border border-border bg-muted/30 p-3 text-xs">
                  <div><b>Categoría:</b> {category.name}</div>
                  <div><b>Fase:</b> {openPhase.name} ({openPhase.kind})</div>
                  <div><b>Equipos:</b> {teamCount}</div>
                  {openPhase.kind === "grupos" && <div><b>Grupos:</b> {groups.length}</div>}
                </div>
                <div>
                  <Label className="text-xs">Formato</Label>
                  <div className="mt-1 grid gap-1.5">
                    <label className="flex items-center gap-2 rounded border p-2 text-xs cursor-pointer">
                      <input type="radio" checked={format === "round_robin"} onChange={() => setFormat("round_robin")} />
                      Todos contra todos (una vuelta)
                    </label>
                    <label className="flex items-center gap-2 rounded border p-2 text-xs cursor-pointer">
                      <input type="radio" checked={format === "ida_vuelta"} onChange={() => setFormat("ida_vuelta")} />
                      Ida y vuelta
                    </label>
                  </div>
                </div>
                {ms.length > 0 && (
                  <div className={`rounded border p-2 text-xs ${played > 0 ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-500"}`}>
                    {played > 0
                      ? `Existen ${played} partido(s) ya jugados. No se puede regenerar automáticamente.`
                      : `Ya existe un fixture con ${ms.length} partido(s). Al regenerar se eliminarán los partidos pendientes de esta fase.`}
                  </div>
                )}
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpenPhase(null)}>Cancelar</Button>
            {openPhase && (() => {
              const ms = matchesByPhase.get(openPhase.id) ?? [];
              const played = ms.filter((m) => m.status === "finalizado" || m.home_score !== null || m.away_score !== null).length;
              return (
                <Button onClick={() => generar(ms.length > 0)} disabled={busy || played > 0}>
                  {ms.length ? "Regenerar fixture" : "Generar fixture"}
                </Button>
              );
            })()}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!manualPhase} onOpenChange={(o) => !o && setManualPhase(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Cruce manual · {manualPhase?.name}</DialogTitle></DialogHeader>
          {manualPhase && (() => {
            const partIds = new Set(participations.map((p)=>p.id));
            const catTeams = [...teamById.values()].filter((t: any) => partIds.has(t.id));
            const homeOptions = catTeams.filter((t: any) => t.id !== manualForm.away);
            const awayOptions = catTeams.filter((t: any) => t.id !== manualForm.home);
            return (
              <div className="grid gap-3 text-sm">
                <div>
                  <Label className="text-xs">Local</Label>
                  <Select value={manualForm.home || undefined} onValueChange={(v) => setManualForm({ ...manualForm, home: v })}>
                    <SelectTrigger><SelectValue placeholder="Elegí equipo local" /></SelectTrigger>
                    <SelectContent>{homeOptions.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Visitante</Label>
                  <Select value={manualForm.away || undefined} onValueChange={(v) => setManualForm({ ...manualForm, away: v })}>
                    <SelectTrigger><SelectValue placeholder="Elegí equipo visitante" /></SelectTrigger>
                    <SelectContent>{awayOptions.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {manualPhase.kind === "grupos" && groups.length > 0 && (
                  <div>
                    <Label className="text-xs">Grupo</Label>
                    <Select value={manualForm.group_name || undefined} onValueChange={(v) => setManualForm({ ...manualForm, group_name: v })}>
                      <SelectTrigger><SelectValue placeholder="Elegí grupo" /></SelectTrigger>
                      <SelectContent>{groups.map((g: any) => <SelectItem key={g.id} value={g.id}>Grupo {g.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">Fecha/hora</Label>
                    <Input type="datetime-local" value={manualForm.when} onChange={(e) => setManualForm({ ...manualForm, when: e.target.value })} />
                  </div>
                  <div>
                    <Label className="text-xs">Cancha</Label>
                    <Input value={manualForm.venue} onChange={(e) => setManualForm({ ...manualForm, venue: e.target.value })} />
                  </div>
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setManualPhase(null)}>Cancelar</Button>
            <Button
              disabled={busy || !manualForm.home || !manualForm.away || manualForm.home === manualForm.away}
              onClick={async () => {
                if (!manualPhase) return;
                setBusy(true);
                const payload: any = {
                  championship_id: championshipId,
                  phase_id: manualPhase.id,
                  home_team_id: manualForm.home,
                  away_team_id: manualForm.away,
                  match_date: manualForm.when ? new Date(manualForm.when).toISOString() : null,
                  venue: manualForm.venue || null,
                  status: "pendiente",
                };
                if (manualForm.group_name) {
  const grupo = groups.find((g: any) => g.name === manualForm.group_name);
  payload.group_name = grupo?.name ?? null;
}
                const { error } = await supabase.from("matches").insert(payload);
                setBusy(false);
                if (error) { toast.error(error.message); return; }
                toast.success("Cruce creado");
                setManualPhase(null);
                onChanged();
              }}
            >Crear cruce</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </CardContent></Card>
  );
}

// ============== PARTIDOS ==============
function MatchesTab() {
  const qc = useQueryClient();
  const champ = useChampionship();
  const teams = useQuery({ queryKey: ["admin", "teams", champ.activeId], enabled: !!champ.activeId, queryFn: async () => (await supabase.from("teams").select("id,name,logo_url,primary_color,category_id,group_name").eq("championship_id", champ.activeId!).order("name")).data ?? [] });
  const matches = useQuery({ queryKey: ["admin", "matches", champ.activeId], enabled: !!champ.activeId, queryFn: async () => (await supabase.from("matches").select("*").eq("championship_id", champ.activeId!).order("matchday").order("match_date")).data ?? [] });
  const phases = useQuery({
    queryKey: ["admin", "phases", champ.activeId],
    enabled: !!champ.activeId,
    queryFn: async () => ((await (supabase as any).from("phases").select("id,name,kind,category_id,display_order").eq("championship_id", champ.activeId!).order("display_order")).data ?? []) as any[],
  });
  const [editId, setEditId] = useState<string | null>(null);
  const [selectedMatches, setSelectedMatches] = useState<string[]>([]);
  
  const [obsMatch, setObsMatch] = useState<any>(null);
  const [obsTeamId, setObsTeamId] = useState<string>("");
  const [obsOpen, setObsOpen] = useState(false);
  const editing = matches.data?.find((m) => m.id === editId) ?? null;
  const phaseById = new Map((phases.data ?? []).map((p: any) => [p.id, p]));
// ==================== FILTROS ====================

const categories = useQuery({
  queryKey: ["admin", "categories", champ.activeId],
  enabled: !!champ.activeId,
  queryFn: async () =>
    (
      await supabase
        .from("categories")
        .select("id,name")
        .eq("championship_id", champ.activeId!)
        .order("sort_order")
    ).data ?? [],
});
const groups = useQuery({
  queryKey: ["admin", "groups", champ.activeId],
  enabled: !!champ.activeId,
  queryFn: async () => {
    const result = await (supabase as any)
      .from("groups")
      .select(`
        id,
        name,
        category_id,
        categories(
          name
        )
      `)
      .eq("championship_id", champ.activeId!);

    console.log("GRUPOS CARGADOS:", result.data);

    return result.data ?? [];
  },
});

const [categoryFilter, setCategoryFilter] = useState("all");
const [groupFilter, setGroupFilter] = useState("all");
const [teamFilter, setTeamFilter] = useState("all");
const [statusFilter, setStatusFilter] = useState("all");
const [search, setSearch] = useState("");
const [dateFrom, setDateFrom] = useState("");
const [dateTo, setDateTo] = useState("");

  async function deleteSelectedMatches() {
  if (selectedMatches.length === 0) {
    toast.error("No seleccionaste ningún partido.");
    return;
  }

  if (
    !confirm(
      `¿Eliminar ${selectedMatches.length} partido(s)?\n\nEsta acción no se puede deshacer.`
    )
  ) {
    return;
  }

  const { error } = await supabase
    .from("matches")
    .delete()
    .in("id", selectedMatches);

  if (error) {
    toast.error(error.message);
    return;
  }

  toast.success(`${selectedMatches.length} partido(s) eliminado(s).`);

  setSelectedMatches([]);

  qc.invalidateQueries({
    queryKey: ["admin", "matches"],
  });

  qc.invalidateQueries({
    queryKey: ["public", "matches"],
  });
}
const filteredMatches = (matches.data ?? []).filter((m: any) => {

  const home = teams.data?.find((t) => t.id === m.home_team_id);
  const away = teams.data?.find((t) => t.id === m.away_team_id);
  const phase = phases.data?.find((p:any)=>p.id===m.phase_id);
  const groupName = home?.group_name ?? "";

  if (
    categoryFilter !== "all" &&
    phase?.category_id !== categoryFilter
  )
    return false;
  
  if (
    groupFilter !== "all" &&
    groupName !== groupFilter
  )
return false;

  if (
    teamFilter !== "all" &&
    m.home_team_id !== teamFilter &&
    m.away_team_id !== teamFilter
  )
    return false;

  if (
    statusFilter !== "all" &&
    m.status !== statusFilter
  )
    return false;

  if (search.trim()) {

    const txt = search.toLowerCase();

    if (
      !(home?.name ?? "").toLowerCase().includes(txt) &&
      !(away?.name ?? "").toLowerCase().includes(txt)
    )
      return false;

  }

  if (dateFrom) {

    if (!m.match_date) return false;

    if (new Date(m.match_date) < new Date(dateFrom))
      return false;

  }

  if (dateTo) {

    if (!m.match_date) return false;

    const end = new Date(dateTo);

    end.setHours(23,59,59);

    if (new Date(m.match_date) > end)
      return false;

  }

  return true;

});
  return (
    <Card><CardContent className="p-5">
      <h2 className="mb-3 text-sm font-black uppercase tracking-widest">
        <div className="mb-4 grid gap-3 md:grid-cols-4 lg:grid-cols-6">

<Select value={categoryFilter} onValueChange={setCategoryFilter}>
<SelectTrigger>
<SelectValue placeholder="Categoría"/>
</SelectTrigger>
<SelectContent>
<SelectItem value="all">Categorías</SelectItem>

{(categories.data ?? []).map((c:any)=>(
<SelectItem key={c.id} value={c.id}>
{c.name}
</SelectItem>
))}

</SelectContent>
</Select>

<Select value={groupFilter} onValueChange={setGroupFilter}>
  <SelectTrigger>
    <SelectValue placeholder="Grupos"/>
  </SelectTrigger>

  <SelectContent>

    <SelectItem value="all">
  Grupos
    </SelectItem>

    {(groups.data ?? [])
      .filter((g:any)=>
        categoryFilter === "all"
        ? true
        : g.category_id === categoryFilter
      )
      .map((g:any)=>(
        <SelectItem
          key={g.id}
          value={g.name}
        >
          {g.name}
        </SelectItem>
      ))}

  </SelectContent>
</Select>

<Select value={teamFilter} onValueChange={setTeamFilter}>
<SelectTrigger>
<SelectValue placeholder="Equipo"/>
</SelectTrigger>
<SelectContent>

<SelectItem value="all">Equipos</SelectItem>

{(teams.data ?? []).map((t:any)=>(
<SelectItem key={t.id} value={t.id}>
{t.name}
</SelectItem>
))}

</SelectContent>
</Select>

<Select value={statusFilter} onValueChange={setStatusFilter}>
<SelectTrigger>
<SelectValue placeholder="Estado"/>
</SelectTrigger>
<SelectContent>

<SelectItem value="all">Estado</SelectItem>
<SelectItem value="pendiente">Pendiente</SelectItem>
<SelectItem value="en_curso">En juego</SelectItem>
<SelectItem value="finalizado">Finalizado</SelectItem>

</SelectContent>
</Select>

<Input
placeholder="Buscar equipo..."
value={search}
onChange={(e)=>setSearch(e.target.value)}
/>

<div>

<Input
type="date"
value={dateFrom}
onChange={(e)=>setDateFrom(e.target.value)}
/>

</div>

</div>
        Partidos ({filteredMatches.length} de {matches.data?.length ?? 0})</h2>
      <div className="mb-3 flex items-center gap-3">

<Button
variant="destructive"
disabled={selectedMatches.length===0}
onClick={deleteSelectedMatches}
>
🗑 Eliminar seleccionados ({selectedMatches.length})
</Button>

<Button
variant="outline"
onClick={()=>{
if(selectedMatches.length===matches.data?.length){
setSelectedMatches([]);
}else{
setSelectedMatches((matches.data??[]).map((m:any)=>m.id));
}
}}
>
{selectedMatches.length===matches.data?.length
?"Deseleccionar todos"
:"Seleccionar todos"}
</Button>

</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <th className="py-2 text-left">Fecha</th><th className="text-left">Fase</th><th className="text-left">Cuando</th><th className="text-center">Local</th><th></th><th className="text-center">Visitante</th><th className="text-center">Estado</th><th></th>
          </tr></thead>
          <tbody>{filteredMatches.map((m: any) => {
            const h = teams.data?.find((t) => t.id === m.home_team_id);
            const a = teams.data?.find((t) => t.id === m.away_team_id);
            const ph = m.phase_id ? phaseById.get(m.phase_id) : null;
            return (
              <tr key={m.id} className="border-b border-border/50">
                <td>

<input
type="checkbox"
checked={selectedMatches.includes(m.id)}
onChange={(e)=>{

if(e.target.checked){

setSelectedMatches([
...selectedMatches,
m.id
]);

}else{

setSelectedMatches(
selectedMatches.filter(id=>id!==m.id)
);

}

}}
/>

</td>
                <td className="py-2 text-xs"><Badge variant="outline" className="uppercase">F{m.matchday ?? "?"}{m.group_name ? `·${m.group_name}` : ""}</Badge></td>
                <td className="text-xs">{ph ? <Badge variant="secondary" className="text-[10px]">{ph.name}</Badge> : <span className="text-muted-foreground">—</span>}</td>
                <td className="text-xs">{m.match_date ? format(new Date(m.match_date), "dd/MM HH:mm") : "—"}</td>
                <td className="text-right font-semibold">{h?.name ?? "—"}</td>
                <td className="px-2 text-center font-black tabular-nums">{m.status === "finalizado" ? `${m.home_score} - ${m.away_score}` : "vs"}</td>
                <td className="font-semibold">{a?.name ?? "—"}</td>
                <td className="text-center"><Badge variant={m.status === "finalizado" ? "default" : "secondary"}>{m.status}</Badge></td>
                <td className="text-right">

  <Link 
    to="/planilla/$matchId" 
    params={{ matchId: m.id }} 
    className="mr-1 inline-flex"
  >
    <Button size="icon" variant="ghost">
      <Printer className="h-4 w-4" />
    </Button>
  </Link>


  <Button 
    size="icon" 
    variant="ghost" 
    onClick={() => setEditId(m.id)}
  >
    <Pencil className="h-4 w-4" />
  </Button>


  <Button
    size="icon"
    variant="ghost"
    title="Observación de partido"
    onClick={() => {
      setObsMatch({
        ...m,
        home: h,
        away: a
      });

      // inicialmente selecciona el equipo local
      setObsTeamId(m.home_team_id);

      setObsOpen(true);
    }}
  >
    <MessageSquare className="h-4 w-4" />
  </Button>

</td>
              </tr>
            );
          })}
          {(matches.data ?? []).length === 0 && <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">Sin partidos. Generá el fixture desde Sorteo.</td></tr>}
          </tbody>
        </table>
      </div>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditId(null)}>
        <ObservacionDialog
  match={obsMatch}
  teamId={obsTeamId}
  open={obsOpen}
  onOpenChange={setObsOpen}
  onSaved={()=>{
    qc.invalidateQueries({
      queryKey:["admin","observations"]
    });
  }}
/>
        {editing && <MatchEditDialog match={editing} teams={teams.data ?? []} phases={phases.data ?? []} onSaved={() => { qc.invalidateQueries({ queryKey: ["admin", "matches"] }); qc.invalidateQueries({ queryKey: ["public", "matches"] }); setEditId(null); }} />}
      </Dialog>
    </CardContent></Card>
  );
}

function MatchEditDialog({ match, teams, phases, onSaved }: { match: any; teams: any[]; phases?: any[]; onSaved: () => void }) {
  const [f, setF] = useState({
    match_date: match.match_date ? format(new Date(match.match_date), "yyyy-MM-dd'T'HH:mm") : "",
    venue: match.venue ?? "",
    referee_main: match.referee_main ?? "",
    referee_assistant: match.referee_assistant ?? "",
    home_score: match.home_score ?? "",
    away_score: match.away_score ?? "",
    status: match.status as typeof STATUSES[number],
    result_type: (match.result_type === "walkover" ? "walkover" : "normal") as "normal" | "walkover",
    walkover_winner_team_id: (match.walkover_winner_team_id as string | null) ?? "",
    notes: match.notes ?? "",
  });
  const champ = useQuery({
    queryKey: ["admin", "champ-walkover", match.championship_id],
    enabled: !!match.championship_id,
    queryFn: async () => (await (supabase as any).from("championships").select("walkover_score_winner,walkover_score_loser").eq("id", match.championship_id).maybeSingle()).data,
  });
  const events = useQuery({
    queryKey: ["admin", "events", match.id],
    queryFn: async () => (await supabase.from("match_events").select("*").eq("match_id", match.id).order("minute")).data ?? [],
  });
  const homePlayers = useQuery({ queryKey: ["players-of", match.home_team_id], queryFn: async () => match.home_team_id ? ((await supabase.from("players").select("id,full_name,jersey_number").eq("team_id", match.home_team_id)).data ?? []) : [], enabled: !!match.home_team_id });
  const awayPlayers = useQuery({ queryKey: ["players-of", match.away_team_id], queryFn: async () => match.away_team_id ? ((await supabase.from("players").select("id,full_name,jersey_number").eq("team_id", match.away_team_id)).data ?? []) : [], enabled: !!match.away_team_id });
  const qc = useQueryClient();
  const home = teams.find((t) => t.id === match.home_team_id);
  const away = teams.find((t) => t.id === match.away_team_id);
  const phaseInfo = phases?.find((p: any) => p.id === match.phase_id);

  // Marcador calculado a partir de eventos (solo cuando result_type = normal).
  const computed = (() => {
    const ev = events.data ?? [];
    let h = 0, a = 0;
    for (const e of ev) {
      if (e.type === "gol") {
        if (e.team_id === match.home_team_id) h++;
        else if (e.team_id === match.away_team_id) a++;
      } else if (e.type === "autogol") {
        if (e.team_id === match.home_team_id) a++;
        else if (e.team_id === match.away_team_id) h++;
      }
    }
    return { h, a };
  })();

  function applyWalkover(winnerTeamId: string) {
    const w = champ.data?.walkover_score_winner ?? 3;
    const l = champ.data?.walkover_score_loser ?? 0;
    if (winnerTeamId === match.home_team_id) {
      setF((s) => ({ ...s, walkover_winner_team_id: winnerTeamId, home_score: w, away_score: l, status: "finalizado" as any }));
    } else if (winnerTeamId === match.away_team_id) {
      setF((s) => ({ ...s, walkover_winner_team_id: winnerTeamId, home_score: l, away_score: w, status: "finalizado" as any }));
    } else {
      setF((s) => ({ ...s, walkover_winner_team_id: winnerTeamId }));
    }
  }

  async function save() {
    let home_score: number | null;
    let away_score: number | null;
    let status = f.status;
    if (f.result_type === "walkover") {
      if (!f.walkover_winner_team_id) {
        return toast.error("Elegí el equipo ganador por walkover.");
      }
      // Recalcular defensivamente desde config del campeonato para que
      // SIEMPRE actualice la tabla (PJ/PG/PP/GF/GC/DG/PTS).
      const w = champ.data?.walkover_score_winner ?? 3;
      const l = champ.data?.walkover_score_loser ?? 0;
      if (f.walkover_winner_team_id === match.home_team_id) {
        home_score = w; away_score = l;
      } else if (f.walkover_winner_team_id === match.away_team_id) {
        home_score = l; away_score = w;
      } else {
        return toast.error("El ganador no coincide con Local ni Visitante.");
      }
      status = "finalizado" as any;
    } else {
      // normal: calcular desde eventos
      home_score = computed.h;
      away_score = computed.a;
    }
    const payload: any = {
      match_date: f.match_date ? new Date(f.match_date).toISOString() : null,
      venue: f.venue || null, referee_main: f.referee_main || null, referee_assistant: f.referee_assistant || null,
      home_score, away_score,
      status, notes: f.notes || null,
      result_type: f.result_type,
      walkover_winner_team_id: f.result_type === "walkover" ? (f.walkover_winner_team_id || null) : null,
    };
    const { error } = await (supabase as any).from("matches").update(payload).eq("id", match.id);
    if (error) return toast.error(error.message);
    toast.success("Partido actualizado"); onSaved();
  }

  return (
    <DialogContent className="max-w-3xl">
      <DialogHeader><DialogTitle>{home?.name ?? "?"} vs {away?.name ?? "?"}</DialogTitle></DialogHeader>
      <Tabs defaultValue="info">
        <TabsList><TabsTrigger value="info">Datos del partido</TabsTrigger><TabsTrigger value="eventos">Eventos & resultado</TabsTrigger></TabsList>
        <TabsContent value="info" className="space-y-3 pt-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Fecha y hora</Label><Input type="datetime-local" value={f.match_date} onChange={(e) => setF({ ...f, match_date: e.target.value })} /></div>
            <div><Label>Escenario</Label><Input value={f.venue} onChange={(e) => setF({ ...f, venue: e.target.value })} /></div>
            <div><Label>Árbitro principal</Label><Input value={f.referee_main} onChange={(e) => setF({ ...f, referee_main: e.target.value })} /></div>
            <div><Label>Asistente</Label><Input value={f.referee_assistant} onChange={(e) => setF({ ...f, referee_assistant: e.target.value })} /></div>
            <div className="col-span-2 rounded border bg-muted/30 p-2 text-xs">
              <span className="font-semibold">Fase (Motor deportivo):</span>{" "}
              {phaseInfo ? <span>{phaseInfo.name} · <span className="capitalize text-muted-foreground">{phaseInfo.kind}</span></span> : <span className="text-muted-foreground">Sin fase asignada — se define desde el fixture / Motor deportivo</span>}
            </div>
            <div><Label>Estado</Label>
              <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{STATUS_LABEL[s] ?? s}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Tipo de resultado</Label>
              <Select value={f.result_type} onValueChange={(v) => setF({ ...f, result_type: v as any, walkover_winner_team_id: v === "walkover" ? f.walkover_winner_team_id : "" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="walkover">Walkover</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {f.result_type === "walkover" && (
              <div className="col-span-2"><Label>Ganador por walkover</Label>
                <Select value={f.walkover_winner_team_id || "__pick__"} onValueChange={(v) => v !== "__pick__" && applyWalkover(v)}>
                  <SelectTrigger><SelectValue placeholder="Elegí ganador" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__pick__" disabled>Elegí ganador</SelectItem>
                    {home && <SelectItem value={home.id}>{home.name}</SelectItem>}
                    {away && <SelectItem value={away.id}>{away.name}</SelectItem>}
                  </SelectContent>
                </Select>
                <p className="mt-1 text-[10px] text-muted-foreground">
                  Marcador automático {champ.data?.walkover_score_winner ?? 3}-{champ.data?.walkover_score_loser ?? 0}. No genera goleadores ni tarjetas.
                </p>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Goles {home?.name}</Label>
              <Input type="number" min={0} value={f.result_type === "walkover" ? f.home_score : computed.h} disabled readOnly />
            </div>
            <div><Label>Goles {away?.name}</Label>
              <Input type="number" min={0} value={f.result_type === "walkover" ? f.away_score : computed.a} disabled readOnly />
            </div>
            <p className="col-span-2 text-[10px] text-muted-foreground">
              {f.result_type === "walkover"
                ? "Marcador determinado por la configuración del campeonato."
                : "Marcador calculado automáticamente a partir de los eventos (pestaña Eventos & resultado)."}
            </p>
          </div>
          <div><Label>Observaciones</Label><Input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
          <Button onClick={save} className="w-full">Guardar</Button>
        </TabsContent>
        <TabsContent value="eventos" className="pt-3">
          <EventsEditor match={match} home={home} away={away} homePlayers={homePlayers.data ?? []} awayPlayers={awayPlayers.data ?? []} events={events.data ?? []} onChange={() => { qc.invalidateQueries({ queryKey: ["admin", "events", match.id] }); qc.invalidateQueries({ queryKey: ["public", "events", "goals"] }); qc.invalidateQueries({ queryKey: ["public", "events", "all"] }); }} />
        </TabsContent>
      </Tabs>
    </DialogContent>
  );
}

function EventsEditor({ match, home, away, homePlayers, awayPlayers, events, onChange }: any) {
  const [type, setType] = useState<"gol" | "autogol" | "amarilla" | "roja" | "asistencia">("gol");
  const [teamId, setTeamId] = useState<string>(home?.id ?? "");
  const [playerId, setPlayerId] = useState<string>("");
  const [minute, setMinute] = useState<string>("");
  const list = teamId === home?.id ? homePlayers : awayPlayers;

  async function add() {
    if (!playerId) return toast.error("Elegí jugador");
    const { error } = await supabase.from("match_events").insert({
      match_id: match.id, team_id: teamId, player_id: playerId, type,
      minute: minute === "" ? null : Number(minute),
    });
    if (error) return toast.error(error.message);
    setMinute(""); setPlayerId(""); onChange();

    // Suspensión automática por roja
    if (type === "roja") {
      await supabase.from("suspensions").insert({
        player_id: playerId, championship_id: match.championship_id,
        reason: "Tarjeta roja directa", matches_remaining: 1, origin_match_id: match.id,
      });
      await supabase.from("players").update({ enabled: false }).eq("id", playerId);
      toast.message("Jugador suspendido por roja directa");
    }
    // Acumulación de amarillas
    if (type === "amarilla") {
      const { count } = await supabase.from("match_events").select("id", { count: "exact", head: true })
        .eq("player_id", playerId).eq("type", "amarilla");
      if ((count ?? 0) >= 2 && (count ?? 0) % 2 === 0) {
        await supabase.from("suspensions").insert({
          player_id: playerId, championship_id: match.championship_id,
          reason: "Acumulación de amarillas", matches_remaining: 1, origin_match_id: match.id,
        });
        await supabase.from("players").update({ enabled: false }).eq("id", playerId);
        toast.message("Jugador suspendido por acumulación");
      }
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Select value={type} onValueChange={(v) => setType(v as any)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="gol">Gol</SelectItem><SelectItem value="autogol">Autogol</SelectItem>
            <SelectItem value="amarilla">Amarilla</SelectItem><SelectItem value="roja">Roja</SelectItem>
            <SelectItem value="asistencia">Asistencia</SelectItem>
          </SelectContent>
        </Select>
        <Select value={teamId} onValueChange={(v) => { setTeamId(v); setPlayerId(""); }}>
          <SelectTrigger><SelectValue placeholder="Equipo" /></SelectTrigger>
          <SelectContent>
            {home && <SelectItem value={home.id}>{home.name}</SelectItem>}
            {away && <SelectItem value={away.id}>{away.name}</SelectItem>}
          </SelectContent>
        </Select>
        <Select value={playerId} onValueChange={setPlayerId}>
          <SelectTrigger className="sm:col-span-2"><SelectValue placeholder="Jugador" /></SelectTrigger>
          <SelectContent>{list.map((p: any) => <SelectItem key={p.id} value={p.id}>#{p.jersey_number ?? "?"} {p.full_name}</SelectItem>)}</SelectContent>
        </Select>
        <Input type="number" placeholder="Min" value={minute} onChange={(e) => setMinute(e.target.value)} />
      </div>
      <Button onClick={add} size="sm" className="gap-1.5"><Plus className="h-3 w-3" /> Registrar evento</Button>

      <div className="space-y-1">
        {events.length === 0 && <div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">Sin eventos</div>}
        {events.map((ev: any) => {
          const team = ev.team_id === home?.id ? home : away;
          const pl = (team?.id === home?.id ? homePlayers : awayPlayers).find((p: any) => p.id === ev.player_id);
          return (
            <div key={ev.id} className="flex items-center gap-2 rounded-lg border border-border bg-card/50 px-3 py-1.5 text-sm">
              <Badge variant="outline">{ev.minute ?? "—"}'</Badge>
              <Badge className={
                ev.type === "amarilla" ? "bg-warning text-warning-foreground" :
                ev.type === "roja" ? "bg-destructive text-destructive-foreground" : ""
              }>{ev.type}</Badge>
              <span className="font-semibold">{pl?.full_name ?? "—"}</span>
              <span className="ml-auto text-xs text-muted-foreground">{team?.name}</span>
              <Button size="icon" variant="ghost" onClick={async () => {
                await supabase.from("match_events").delete().eq("id", ev.id);
                onChange();
              }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============== CAMPEONATO ==============
function ChampTab() {
  const champ = useChampionship();
  const qc = useQueryClient();
  const c: any = champ.data;
  const [f, setF] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // Sincronizar form con el campeonato activo
  if (c && (!f || f.__id !== c.id)) {
    setF({
      __id: c.id,
      name: c.name ?? "",
      year: c.year ?? new Date().getFullYear(),
      season: c.season ?? "",
      status: c.status ?? "",
      description: c.description ?? "",
      location: c.location ?? "",
      organizer: c.organizer ?? "",
      start_date: c.start_date ?? "",
      end_date: c.end_date ?? "",
      yellow_cards_for_suspension: c.yellow_cards_for_suspension ?? 2,
      red_card_suspension_matches: c.red_card_suspension_matches ?? 1,
    });
  }
  if (!c) return <Card><CardContent className="p-5">Sin campeonato activo</CardContent></Card>;
  if (!f) return null;

  async function onSave() {
    if (!f.name.trim()) return toast.error("El nombre es obligatorio");
    setSaving(true);
    try {
      const payload: any = {
        name: f.name.trim(),
        year: +f.year,
        season: f.season || null,
        status: f.status || null,
        description: f.description || null,
        location: f.location || null,
        organizer: f.organizer || null,
        start_date: f.start_date || null,
        end_date: f.end_date || null,
        yellow_cards_for_suspension: +f.yellow_cards_for_suspension,
        red_card_suspension_matches: +f.red_card_suspension_matches,
      };
      const { error } = await supabase.from("championships").update(payload).eq("id", c.id);
      if (error) throw error;
      toast.success("Campeonato actualizado");
      qc.invalidateQueries({ queryKey: ["public", "championships"] });
      qc.invalidateQueries({ queryKey: ["admin", "championship"] });
    } catch (e: any) {
      toast.error(e.message ?? "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card><CardContent className="p-5 space-y-3">
      <h2 className="text-sm font-black uppercase tracking-widest">Configuración del campeonato</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div><Label>Nombre</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div><Label>Temporada</Label><Input value={f.season} onChange={(e) => setF({ ...f, season: e.target.value })} placeholder="p. ej. 2026" /></div>
        <div><Label>Año</Label><Input type="number" value={f.year} onChange={(e) => setF({ ...f, year: e.target.value })} /></div>
        <div><Label>Estado</Label><Input value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} placeholder="p. ej. En curso" /></div>
        <div><Label>Organizador</Label><Input value={f.organizer} onChange={(e) => setF({ ...f, organizer: e.target.value })} /></div>
        <div><Label>Localidad</Label><Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></div>
        <div><Label>Fecha inicio</Label><Input type="date" value={f.start_date ?? ""} onChange={(e) => setF({ ...f, start_date: e.target.value })} /></div>
        <div><Label>Fecha fin</Label><Input type="date" value={f.end_date ?? ""} onChange={(e) => setF({ ...f, end_date: e.target.value })} /></div>
        <div className="sm:col-span-2"><Label>Descripción</Label><Textarea rows={2} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Amarillas para suspensión</Label><Input type="number" value={f.yellow_cards_for_suspension} onChange={(e) => setF({ ...f, yellow_cards_for_suspension: e.target.value })} /></div>
        <div><Label>Fechas de suspensión por roja</Label><Input type="number" value={f.red_card_suspension_matches} onChange={(e) => setF({ ...f, red_card_suspension_matches: e.target.value })} /></div>
      </div>
      <div className="pt-2">
        <Button onClick={onSave} disabled={saving} className="gap-1.5">
          {saving ? "Guardando…" : "Guardar cambios"}
        </Button>
      </div>
    </CardContent></Card>
  );
}
