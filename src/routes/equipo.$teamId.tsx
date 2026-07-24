import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { TeamBadge } from "@/components/TeamBadge";
import { computeTeamStats, calcAge } from "@/lib/team-stats";
import { format } from "date-fns";
import { ChevronLeft, Shield, Users, BarChart3, User as UserIcon, History } from "lucide-react";

export const Route = createFileRoute("/equipo/$teamId")({
  head: ({ loaderData }) => {
    const name = (loaderData as any)?.name ?? "Equipo";
    return {
      meta: [
        { title: `${name} · Integración Futsal` },
        { name: "description", content: `Perfil, plantel y estadísticas de ${name}.` },
        { property: "og:title", content: `${name} · Integración Futsal` },
        { property: "og:description", content: `Perfil, plantel y estadísticas de ${name}.` },
      ],
    };
  },
  loader: async ({ params }) => {
    const { data } = await supabase.from("teams").select("id,name").eq("id", params.teamId).maybeSingle();
    if (!data) throw notFound();
    return { name: data.name };
  },
  errorComponent: () => <div className="p-10 text-center text-sm text-muted-foreground">Error al cargar el equipo.</div>,
  notFoundComponent: () => <div className="p-10 text-center text-sm text-muted-foreground">Equipo no encontrado.</div>,
  component: TeamProfilePage,
});

function TeamProfilePage() {
  const { teamId } = Route.useParams();

  const team = useQuery({
    queryKey: ["team-profile", teamId],
    queryFn: async () => {
      const { data } = await supabase
        .from("teams")
        .select("*, category:categories(id,name)")
        .eq("id", teamId)
        .maybeSingle();
      return data;
    },
  });

  const players = useQuery({
    queryKey: ["team-players", teamId],
    queryFn: async () => (await supabase.from("players").select("*").eq("team_id", teamId).order("jersey_number")).data ?? [],
  });

  const matches = useQuery({
    queryKey: ["team-matches", teamId],
    queryFn: async () =>
      (await supabase.from("matches").select("*").or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`).order("match_date")).data ?? [],
  });

  const events = useQuery({
    queryKey: ["team-events", teamId],
    queryFn: async () => (await supabase.from("match_events").select("*").eq("team_id", teamId)).data ?? [],
  });

  const allTeams = useQuery({
    queryKey: ["public", "teams", "min"],
    queryFn: async () => (await supabase.from("teams").select("id,name,logo_url,primary_color")).data ?? [],
  });

  if (team.isLoading) return <div className="p-10 text-center text-sm text-muted-foreground">Cargando…</div>;
  const t = team.data;
  if (!t) return <div className="p-10 text-center text-sm text-muted-foreground">Equipo no encontrado.</div>;

  const stats = computeTeamStats(teamId, (matches.data ?? []) as any, (events.data ?? []) as any, (players.data ?? []) as any);
  const teamsById = new Map((allTeams.data ?? []).map((x) => [x.id, x]));
  const playersById = new Map((players.data ?? []).map((p) => [p.id, p]));

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <Link to="/tabla" className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
        <ChevronLeft className="h-3.5 w-3.5" /> Volver
      </Link>

      {/* Cabecera */}
      <Card className="mt-3">
        <CardContent className="flex flex-col items-center gap-4 p-6 sm:flex-row sm:items-center">
          <TeamBadge name={t.name} logoPath={t.logo_url} color={t.primary_color} size={96} />
          <div className="flex-1 text-center sm:text-left">
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <h1 className="text-2xl font-black uppercase tracking-tight">{t.name}</h1>
              {t.sigla && <Badge variant="secondary">{t.sigla}</Badge>}
              {!t.active && <Badge variant="destructive">Inactivo</Badge>}
            </div>
            <div className="mt-1 flex flex-wrap items-center justify-center gap-3 text-xs text-muted-foreground sm:justify-start">
              {t.short_name && <span>{t.short_name}</span>}
              {t.founded_year && <span>Fundado en {t.founded_year}</span>}
              {(t as any).category?.name && <Badge variant="outline">{(t as any).category.name}</Badge>}
              {t.group_name && <Badge variant="outline">Grupo {t.group_name}</Badge>}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center sm:grid-cols-6">
            <Stat label="PJ" value={stats.pj} />
            <Stat label="PG" value={stats.pg} accent />
            <Stat label="PE" value={stats.pe} />
            <Stat label="PP" value={stats.pp} />
            <Stat label="GF" value={stats.gf} />
            <Stat label="GC" value={stats.gc} />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="info" className="mt-4">
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="info" className="gap-1.5"><Shield className="h-3.5 w-3.5" /> Información</TabsTrigger>
          <TabsTrigger value="jugadores" className="gap-1.5"><Users className="h-3.5 w-3.5" /> Jugadores ({players.data?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="estadisticas" className="gap-1.5"><BarChart3 className="h-3.5 w-3.5" /> Estadísticas</TabsTrigger>
          <TabsTrigger value="delegado" className="gap-1.5"><UserIcon className="h-3.5 w-3.5" /> Delegado</TabsTrigger>
          <TabsTrigger value="historial" className="gap-1.5"><History className="h-3.5 w-3.5" /> Historial</TabsTrigger>
        </TabsList>

        {/* INFORMACIÓN */}
        <TabsContent value="info">
          <Card><CardContent className="grid gap-4 p-5 sm:grid-cols-2">
            <Row k="Nombre completo" v={t.name} />
            <Row k="Nombre corto" v={t.short_name || "—"} />
            <Row k="Sigla" v={t.sigla || "—"} />
            <Row k="Año de fundación" v={t.founded_year?.toString() || "—"} />
            <Row k="Categoría" v={(t as any).category?.name || "—"} />
            <Row k="Grupo" v={t.group_name || "—"} />
            <Row k="Estado" v={t.active ? "Activo" : "Inactivo"} />
            <div className="flex items-center gap-3">
              <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Colores</div>
              <div className="flex gap-2">
                <span className="h-6 w-6 rounded-full border" style={{ background: t.primary_color ?? "#ccc" }} />
                <span className="h-6 w-6 rounded-full border" style={{ background: t.secondary_color ?? "#ccc" }} />
              </div>
            </div>
          </CardContent></Card>
        </TabsContent>

        {/* JUGADORES */}
        <TabsContent value="jugadores">
          <Card><CardContent className="p-5">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  <th className="py-2 text-left">#</th><th className="text-left">Jugador</th><th className="text-left">Posición</th><th className="text-center">Edad</th><th className="text-left">Estado</th>
                </tr></thead>
                <tbody>
                  {(players.data ?? []).map((p) => (
                    <tr key={p.id} className="border-b border-border/50">
                      <td className="py-2 tabular-nums font-bold">{p.jersey_number ?? "—"}</td>
                      <td className="font-semibold">
                        <div className="flex items-center gap-2">
                          <span>{p.full_name}</span>
                          {p.is_captain && <Badge className="bg-primary text-primary-foreground">C</Badge>}
                          {p.is_vice_captain && <Badge variant="secondary">VC</Badge>}
                        </div>
                      </td>
                      <td className="capitalize">{p.position}</td>
                      <td className="text-center">{calcAge(p.birth_date) ?? "—"}</td>
                      <td><PlayerStatusBadge status={p.status ?? (p.enabled ? "activo" : "suspendido")} /></td>
                    </tr>
                  ))}
                  {(players.data ?? []).length === 0 && <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">Sin jugadores</td></tr>}
                </tbody>
              </table>
            </div>
          </CardContent></Card>
        </TabsContent>

        {/* ESTADÍSTICAS */}
        <TabsContent value="estadisticas">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <MetricCard title="Partidos jugados" value={stats.pj} />
            <MetricCard title="Ganados" value={stats.pg} />
            <MetricCard title="Empatados" value={stats.pe} />
            <MetricCard title="Perdidos" value={stats.pp} />
            <MetricCard title="Goles a favor" value={stats.gf} />
            <MetricCard title="Goles en contra" value={stats.gc} />
            <MetricCard title="Diferencia de gol" value={stats.dg > 0 ? `+${stats.dg}` : stats.dg} />
            <MetricCard title="Promedio anotados" value={stats.avgFor} />
            <MetricCard title="Promedio recibidos" value={stats.avgAgainst} />
            <MetricCard title="Tarjetas amarillas" value={stats.yellow} />
            <MetricCard title="Tarjetas rojas" value={stats.red} />
            <MetricCard title="Últimos 5" value={stats.last5.length ? stats.last5.join(" ") : "—"} />
            <MetricCard title="Máximo goleador" value={stats.topScorer ? `${playersById.get(stats.topScorer.player_id)?.full_name ?? "?"} (${stats.topScorer.goals})` : "—"} />
            <MetricCard title="Más tarjetas" value={stats.topCarded ? `${playersById.get(stats.topCarded.player_id)?.full_name ?? "?"} (${stats.topCarded.cards})` : "—"} />
            <MetricCard title="Arquero menos vencido" value={stats.bestKeeper ? `${playersById.get(stats.bestKeeper.player_id)?.full_name ?? "?"} (${stats.bestKeeper.conceded})` : "—"} />
          </div>
        </TabsContent>

        {/* DELEGADO */}
        <TabsContent value="delegado">
          <Card><CardContent className="grid gap-4 p-5 sm:grid-cols-2">
            {t.delegate_photo_url && (
              <div className="sm:col-span-2">
                <TeamBadge name={t.delegate_name ?? "Delegado"} logoPath={t.delegate_photo_url} size={80} />
              </div>
            )}
            <Row k="Nombre" v={t.delegate_name || "—"} />
            <Row k="Cargo" v={t.delegate_role || "—"} />
            <Row k="Correo" v={t.email || "—"} />
            <Row k="Teléfono" v={t.phone || "—"} />
            <Row k="Fecha de registro" v={t.delegate_registered_at ? format(new Date(t.delegate_registered_at), "dd/MM/yyyy") : "—"} />
          </CardContent></Card>
        </TabsContent>

        {/* HISTORIAL */}
        <TabsContent value="historial">
          <Card><CardContent className="p-5">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  <th className="py-2 text-left">Fecha</th><th className="text-left">Rival</th><th className="text-center">Resultado</th><th className="text-center">Estado</th>
                </tr></thead>
                <tbody>
                  {(matches.data ?? []).map((m) => {
                    const isHome = m.home_team_id === teamId;
                    const rivalId = isHome ? m.away_team_id : m.home_team_id;
                    const rival = rivalId ? teamsById.get(rivalId) : null;
                    return (
                      <tr key={m.id} className="border-b border-border/50">
                        <td className="py-2 text-xs">{m.match_date ? format(new Date(m.match_date), "dd/MM/yyyy") : "—"}</td>
                        <td className="font-semibold">
                          <div className="flex items-center gap-2">
                            {rival && <TeamBadge name={rival.name} logoPath={rival.logo_url} color={rival.primary_color} size={20} />}
                            <span>{rival?.name ?? "—"} {isHome ? "(L)" : "(V)"}</span>
                          </div>
                        </td>
                        <td className="text-center font-black tabular-nums">
                          {m.status === "finalizado" ? `${isHome ? m.home_score : m.away_score} - ${isHome ? m.away_score : m.home_score}` : "—"}
                        </td>
                        <td className="text-center"><Badge variant="outline">{m.status}</Badge></td>
                      </tr>
                    );
                  })}
                  {(matches.data ?? []).length === 0 && <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">Sin partidos</td></tr>}
                </tbody>
              </table>
            </div>
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div>
      <div className={`text-lg font-black tabular-nums ${accent ? "text-primary" : ""}`}>{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{label}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{k}</div>
      <div className="text-sm font-semibold">{v}</div>
    </div>
  );
}

function MetricCard({ title, value }: { title: string; value: number | string }) {
  return (
    <Card><CardContent className="p-4">
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{title}</div>
      <div className="mt-1 text-xl font-black tabular-nums">{value}</div>
    </CardContent></Card>
  );
}

function PlayerStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    activo: { label: "Activo", cls: "bg-success text-success-foreground" },
    suspendido: { label: "Suspendido", cls: "bg-destructive text-destructive-foreground" },
    lesionado: { label: "Lesionado", cls: "bg-warning text-warning-foreground" },
    inhabilitado: { label: "Inhabilitado", cls: "bg-muted text-muted-foreground" },
  };
  const s = map[status] ?? map.activo;
  return <Badge className={s.cls}>{s.label}</Badge>;
}
