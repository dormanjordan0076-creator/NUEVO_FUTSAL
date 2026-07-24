import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { computeStandings } from "@/lib/standings";
import { TeamBadge } from "@/components/TeamBadge";
import { MatchDetailDialog } from "@/components/MatchDetailDialog";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, CalendarDays, Target, ShieldAlert, Users, Activity } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useActiveChampionship } from "@/lib/championship";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Inicio · Campeonato Integración Profesional Futsal" },
      { name: "description", content: "Resumen, próximos partidos y tabla de posiciones del Campeonato Integración Profesional Futsal." },
      { property: "og:title", content: "Inicio · Campeonato Integración Profesional Futsal" },
      { property: "og:description", content: "Resumen, próximos partidos y tabla de posiciones del Campeonato Integración Profesional Futsal." },
    ],
  }),
  component: Home,
});

function Home() {
  const { activeId, championships, loading } = useActiveChampionship();

  const teams = useQuery({
    queryKey: ["public", "teams", activeId],
    enabled: !!activeId,
    queryFn: async () => {
      const { data, error } = await supabase.from("teams").select("id,name,logo_url,group_name,primary_color").eq("championship_id", activeId!);
      if (error) throw error; return data ?? [];
    },
  });
  const matches = useQuery({
    queryKey: ["public", "matches", activeId],
    enabled: !!activeId,
    queryFn: async () => {
      const { data, error } = await supabase.from("matches").select("*").eq("championship_id", activeId!).order("match_date", { ascending: true });
      if (error) throw error; return data ?? [];
    },
  });
  const events = useQuery({
    queryKey: ["public", "events", "goals", activeId],
    enabled: !!activeId && !!(matches.data?.length),
    queryFn: async () => {
      const matchIds = (matches.data ?? []).map((m: any) => m.id);
      if (!matchIds.length) return [];
      const { data, error } = await supabase.from("match_events").select("type,team_id,player_id,match_id").eq("type", "gol").in("match_id", matchIds);
      if (error) throw error; return data ?? [];
    },
  });

  const t = teams.data ?? [];
  const m = matches.data ?? [];
  const finalizados = m.filter((x) => x.status === "finalizado");
  const pendientes = m.filter((x) => x.status === "pendiente" || x.status === "reprogramado");
  const goles = (events.data ?? []).length;
  const next = pendientes.filter((x) => x.match_date).slice(0, 3);
  const lastResults = [...finalizados].reverse().slice(0, 3);
  const standings = computeStandings(t as any, m as any).slice(0, 6);

  if (!loading && !activeId) {
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <Trophy className="mx-auto h-10 w-10 text-primary" />
        <h1 className="mt-3 text-2xl font-black uppercase tracking-tight">Elegí un campeonato</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {championships.length === 0
            ? "Todavía no hay campeonatos creados o no tenés acceso a ninguno."
            : "Seleccioná un campeonato para ver el dashboard, fixture y estadísticas."}
        </p>
        <Link to="/campeonatos" className="mt-6 inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground hover:opacity-90">
          Ver mis campeonatos
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 sm:pt-10">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-hero p-6 text-white shadow-elevated sm:p-10">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, white 1px, transparent 1px)", backgroundSize: "24px 24px" }} />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-widest backdrop-blur">
            <Trophy className="h-3.5 w-3.5" /> Edición {new Date().getFullYear()}
          </div>
          <h1 className="mt-4 text-3xl font-black uppercase leading-tight tracking-tight sm:text-5xl">
            Campeonato Integración<br /><span className="text-accent">Profesional Futsal</span>
          </h1>
          <p className="mt-3 max-w-xl text-sm text-white/80 sm:text-base">
            Fixture, resultados en vivo, tabla de posiciones y estadísticas oficiales del torneo.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link to="/fixture" className="rounded-full bg-white px-5 py-2.5 text-sm font-bold text-foreground transition hover:scale-[1.02]">Ver fixture</Link>
            <Link to="/tabla" className="rounded-full border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20">Tabla de posiciones</Link>
          </div>
        </div>
      </section>

      {/* KPIs */}
      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi icon={Users} label="Equipos" value={t.length} />
        <Kpi icon={Activity} label="Jugados" value={finalizados.length} />
        <Kpi icon={CalendarDays} label="Pendientes" value={pendientes.length} />
        <Kpi icon={Target} label="Goles" value={goles} />
        <Kpi icon={ShieldAlert} label="Amarillas" value={0} hidden />
        <Kpi icon={ShieldAlert} label="Rojas" value={0} hidden />
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-3">
        {/* Próximos */}
        <Card className="lg:col-span-2">
          <CardContent className="p-5">
            <SectionTitle title="Próximos partidos" linkTo="/fixture" />
            <div className="mt-3 space-y-2">
              {next.length === 0 && <Empty text="Sin partidos programados aún." />}
              {next.map((mx) => <MatchRow key={mx.id} m={mx} teams={t} />)}
            </div>
          </CardContent>
        </Card>

        {/* Últimos resultados */}
        <Card>
          <CardContent className="p-5">
            <SectionTitle title="Últimos resultados" linkTo="/fixture" />
            <div className="mt-3 space-y-2">
              {lastResults.length === 0 && <Empty text="Aún no hay resultados." />}
              {lastResults.map((mx) => <MatchRow key={mx.id} m={mx} teams={t} />)}
            </div>
          </CardContent>
        </Card>

        {/* Tabla resumida */}
        <Card className="lg:col-span-3">
          <CardContent className="p-5">
            <SectionTitle title="Tabla de posiciones" linkTo="/tabla" />
            <MiniStandings rows={standings} />
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, hidden }: any) {
  if (hidden) return null;
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
      <Icon className="h-4 w-4 text-primary" />
      <div className="mt-2 text-2xl font-black tabular-nums">{value}</div>
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

function SectionTitle({ title, linkTo }: { title: string; linkTo?: string }) {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-sm font-black uppercase tracking-widest text-foreground">{title}</h2>
      {linkTo && <Link to={linkTo} className="text-xs font-semibold text-primary hover:underline">Ver todo →</Link>}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{text}</div>;
}

export function MatchRow({ m, teams }: { m: any; teams: any[] }) {
  const [open, setOpen] = useState(false);
  const home = teams.find((x) => x.id === m.home_team_id);
  const away = teams.find((x) => x.id === m.away_team_id);
  const finished = m.status === "finalizado";
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl border border-border bg-card/50 p-3 text-left transition hover:border-primary/40 hover:bg-card"
      >
        <div className="flex min-w-0 items-center justify-end gap-2 text-right">
          <span className="truncate text-sm font-semibold">{home?.name ?? "—"}</span>
          <TeamBadge name={home?.name ?? "?"} logoPath={home?.logo_url} color={home?.primary_color} size={28} />
        </div>
        <div className="grid place-items-center">
          {finished ? (
            <div className="rounded-lg bg-foreground px-3 py-1 text-sm font-black tabular-nums text-background">
              {m.home_score} <span className="opacity-50">-</span> {m.away_score}
            </div>
          ) : (
            <div className="text-center">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {m.match_date ? format(new Date(m.match_date), "dd MMM", { locale: es }) : "TBD"}
              </div>
              <div className="text-xs font-semibold text-foreground">
                {m.match_date ? format(new Date(m.match_date), "HH:mm") : "—"}
              </div>
            </div>
          )}
        </div>
        <div className="flex min-w-0 items-center gap-2">
          <TeamBadge name={away?.name ?? "?"} logoPath={away?.logo_url} color={away?.primary_color} size={28} />
          <span className="truncate text-sm font-semibold">{away?.name ?? "—"}</span>
        </div>
      </button>
      <MatchDetailDialog matchId={m.id} open={open} onOpenChange={setOpen} teams={teams} />
    </>
  );
}

function MiniStandings({ rows }: { rows: ReturnType<typeof computeStandings> }) {
  if (rows.length === 0) return <Empty text="Aún sin posiciones." />;
  return (
    <div className="mt-3 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <th className="py-2 text-left">#</th>
            <th className="text-left">Equipo</th>
            <th className="text-center">PJ</th>
            <th className="text-center">DG</th>
            <th className="text-center font-black text-foreground">PTS</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.teamId} className="border-b border-border/50 last:border-0">
              <td className="py-2.5 text-muted-foreground tabular-nums">{i + 1}</td>
              <td>
                <div className="flex items-center gap-2">
                  <TeamBadge name={r.teamName} logoPath={r.logoUrl} size={24} />
                  <span className="font-semibold">{r.teamName}</span>
                  {r.group && <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">G.{r.group}</span>}
                </div>
              </td>
              <td className="text-center tabular-nums">{r.pj}</td>
              <td className="text-center tabular-nums">{r.dg > 0 ? `+${r.dg}` : r.dg}</td>
              <td className="text-center font-black tabular-nums text-primary">{r.pts}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
