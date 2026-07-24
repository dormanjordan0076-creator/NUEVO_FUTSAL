import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { TeamBadge } from "@/components/TeamBadge";
import { Target, Square } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useActiveChampionship } from "@/lib/championship";

export const Route = createFileRoute("/estadisticas")({
  head: () => ({
    meta: [
      { title: "Estadísticas · Integración Futsal" },
      { name: "description", content: "Goleadores, fair play y estadísticas oficiales por categoría." },
      { property: "og:title", content: "Estadísticas · Integración Futsal" },
      { property: "og:description", content: "Goleadores, fair play y estadísticas oficiales por categoría." },
    ],
  }),
  component: StatsPage,
});

function StatsPage() {
  const { activeId } = useActiveChampionship();
  const [categoryId, setCategoryId] = useState<string>("");

  const categories = useQuery({
    queryKey: ["public", "categories", activeId],
    enabled: !!activeId,
    queryFn: async () => (await supabase.from("categories").select("id,name").eq("championship_id", activeId!).order("display_order").order("name")).data ?? [],
  });

  useEffect(() => {
    if (!categoryId && (categories.data?.length ?? 0) > 0) {
      setCategoryId(categories.data![0].id);
    }
  }, [categories.data, categoryId]);

  const teams = useQuery({
    queryKey: ["public", "teams", activeId, categoryId],
    enabled: !!activeId && !!categoryId,
    queryFn: async () =>
      (await supabase.from("teams")
        .select("id,name,logo_url,primary_color,category_id")
        .eq("championship_id", activeId!)
        .eq("category_id", categoryId)).data ?? [],
  });
  const teamIds = (teams.data ?? []).map((t: any) => t.id);
  const players = useQuery({
    queryKey: ["public", "players", activeId, categoryId, teamIds.length],
    enabled: !!activeId && teamIds.length > 0,
    queryFn: async () => (await supabase.from("players").select("id,full_name,team_id,jersey_number,position,photo_url").in("team_id", teamIds)).data ?? [],
  });
  const matches = useQuery({
    queryKey: ["public", "matches", "fin", activeId, categoryId, teamIds.length],
    enabled: !!activeId && !!categoryId && teamIds.length > 0,
    queryFn: async () =>
      (await (supabase as any).from("matches")
        .select("id,home_team_id,away_team_id,home_score,away_score,status,result_type")
        .eq("championship_id", activeId!)
        .in("home_team_id", teamIds)
        .eq("status", "finalizado")).data ?? [],
  });
  const allMatches = useQuery({
    queryKey: ["public", "match-ids", activeId, categoryId, teamIds.length],
    enabled: !!activeId && !!categoryId && teamIds.length > 0,
    queryFn: async () =>
      (await (supabase as any).from("matches")
        .select("id,result_type")
        .eq("championship_id", activeId!)
        .in("home_team_id", teamIds)).data ?? [],
  });
  // Excluir walkovers de eventos individuales (no generan goleadores/tarjetas)
  const nonWalkoverIds = (allMatches.data ?? []).filter((m: any) => (m.result_type ?? "normal") === "normal").map((m: any) => m.id);
  const events = useQuery({
    queryKey: ["public", "events", "all", activeId, categoryId, nonWalkoverIds.length],
    enabled: !!activeId && nonWalkoverIds.length > 0,
    queryFn: async () => (await supabase.from("match_events").select("type,team_id,player_id,match_id").in("match_id", nonWalkoverIds)).data ?? [],
  });
  const sanctions = useQuery({
    queryKey: ["public", "sanctions", activeId, categoryId],
    enabled: !!activeId && !!categoryId,
    queryFn: async () => (await (supabase as any).from("player_sanctions")
      .select("id,player_id,team_id,source,reason,matches_total,matches_served,status,created_at")
      .eq("championship_id", activeId!)
      .eq("category_id", categoryId)
      .order("created_at", { ascending: false })).data ?? [],
  });

  const t = teams.data ?? [];
  const p = players.data ?? [];
  const e = events.data ?? [];
  const m = matches.data ?? [];

  const goalsByPlayer = new Map<string, number>();
  const yellowsByPlayer = new Map<string, number>();
  const redsByPlayer = new Map<string, number>();
  for (const ev of e) {
    if (!ev.player_id) continue;
    if (ev.type === "gol") goalsByPlayer.set(ev.player_id, (goalsByPlayer.get(ev.player_id) ?? 0) + 1);
    if (ev.type === "amarilla") yellowsByPlayer.set(ev.player_id, (yellowsByPlayer.get(ev.player_id) ?? 0) + 1);
    if (ev.type === "roja") redsByPlayer.set(ev.player_id, (redsByPlayer.get(ev.player_id) ?? 0) + 1);
  }

  const scorers = [...goalsByPlayer.entries()]
    .map(([pid, g]) => {
      const pl = p.find((x) => x.id === pid);
      const team = t.find((x) => x.id === pl?.team_id);
      return { player: pl, team, goals: g };
    })
    .filter((x) => x.player)
    .sort((a, b) => b.goals - a.goals)
    .slice(0, 10);

  const cardsYellow = [...yellowsByPlayer.entries()]
    .map(([pid, c]) => ({ player: p.find((x) => x.id === pid), team: t.find((x) => x.id === p.find((y) => y.id === pid)?.team_id), count: c }))
    .filter((x) => x.player)
    .sort((a, b) => b.count - a.count).slice(0, 10);

  const cardsRed = [...redsByPlayer.entries()]
    .map(([pid, c]) => ({ player: p.find((x) => x.id === pid), team: t.find((x) => x.id === p.find((y) => y.id === pid)?.team_id), count: c }))
    .filter((x) => x.player)
    .sort((a, b) => b.count - a.count).slice(0, 10);

  const concededByTeam = new Map<string, { goals: number; matches: number }>();
  for (const mx of m) {
    if (mx.home_team_id) {
      const cur = concededByTeam.get(mx.home_team_id) ?? { goals: 0, matches: 0 };
      cur.goals += mx.away_score ?? 0; cur.matches += 1;
      concededByTeam.set(mx.home_team_id, cur);
    }
    if (mx.away_team_id) {
      const cur = concededByTeam.get(mx.away_team_id) ?? { goals: 0, matches: 0 };
      cur.goals += mx.home_score ?? 0; cur.matches += 1;
      concededByTeam.set(mx.away_team_id, cur);
    }
  }
  const valla = [...concededByTeam.entries()]
    .map(([tid, v]) => ({ team: t.find((x) => x.id === tid), goals: v.goals, matches: v.matches, avg: v.matches ? v.goals / v.matches : 0 }))
    .filter((x) => x.team && x.matches > 0).sort((a, b) => a.avg - b.avg).slice(0, 5);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">Estadísticas</h1>
          <p className="mt-1 text-sm text-muted-foreground">Goleadores, tarjetas y fair play por categoría</p>
        </div>
        <div className="min-w-[220px]">
          <Label className="text-xs">Categoría</Label>
          <Select value={categoryId} onValueChange={setCategoryId}>
            <SelectTrigger><SelectValue placeholder="Elegí una categoría" /></SelectTrigger>
            <SelectContent>
              {(categories.data ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!categoryId ? (
        <div className="mt-8 rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          No hay categorías disponibles en este campeonato.
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <StatTable
            title="Tabla de goleadores"
            icon={<Target className="h-4 w-4 text-accent" />}
            rows={scorers}
            render={(s, i) => (
              <Row key={s.player!.id} idx={i} name={s.player!.full_name} sub={s.team?.name} team={s.team} value={s.goals} />
            )}
          />
          <StatTable
            title="Valla menos vencida"
            icon={<Target className="h-4 w-4 text-primary" />}
            rows={valla}
            headerValue="Prom"
            render={(v, i) => (
              <Row key={v.team!.id} idx={i} name={v.team!.name} sub={`${v.goals} GC en ${v.matches} PJ`} team={v.team} value={v.avg.toFixed(2)} />
            )}
          />
          <StatTable
            title="Tarjetas amarillas"
            icon={<Square className="h-4 w-4 text-warning" />}
            rows={cardsYellow}
            render={(c, i) => (
              <Row key={c.player!.id} idx={i} name={c.player!.full_name} sub={c.team?.name} team={c.team} value={c.count} />
            )}
          />
          <StatTable
            title="Tarjetas rojas"
            icon={<Square className="h-4 w-4 text-destructive" />}
            rows={cardsRed}
            render={(c, i) => (
              <Row key={c.player!.id} idx={i} name={c.player!.full_name} sub={c.team?.name} team={c.team} value={c.count} />
            )}
          />
        </div>
      )}

      {categoryId && (
        <div className="mt-8">
          <div className="mb-3 flex items-center gap-2">
            <Square className="h-4 w-4 text-destructive" />
            <h2 className="text-xs font-black uppercase tracking-widest">Disciplina · Sanciones</h2>
            <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {(sanctions.data ?? []).filter((s: any) => s.status === "activa").length} activas
            </span>
          </div>
          <Card><CardContent className="p-0">
            {(sanctions.data ?? []).length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Sin sanciones registradas.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="border-b text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    <th className="py-2 px-3 text-left">Jugador</th>
                    <th className="text-left">Equipo</th>
                    <th className="text-left">Origen</th>
                    <th className="text-left">Motivo</th>
                    <th className="text-center">Partidos</th>
                    <th className="text-center">Estado</th>
                  </tr></thead>
                  <tbody>{(sanctions.data ?? []).map((s: any) => {
                    const pl = p.find((x) => x.id === s.player_id);
                    const tm = t.find((x) => x.id === s.team_id);
                    return (
                      <tr key={s.id} className="border-b border-border/50">
                        <td className="py-2 px-3 font-semibold">{pl?.full_name ?? "—"}</td>
                        <td>{tm?.name ?? "—"}</td>
                        <td className="capitalize">{s.source}</td>
                        <td className="text-xs text-muted-foreground">{s.reason ?? "—"}</td>
                        <td className="text-center tabular-nums">{s.matches_served}/{s.matches_total}</td>
                        <td className="text-center">
                          <span className={`inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase ${
                            s.status === "activa" ? "bg-destructive/15 text-destructive" :
                            s.status === "cumplida" ? "bg-muted text-muted-foreground" :
                            "bg-muted text-muted-foreground"
                          }`}>{s.status}</span>
                        </td>
                      </tr>
                    );
                  })}</tbody>
                </table>
              </div>
            )}
          </CardContent></Card>
        </div>
      )}
    </div>
  );
}

function StatTable<T>({ title, icon, rows, render, headerValue = "Tot" }: { title: string; icon: any; rows: T[]; render: (r: T, i: number) => any; headerValue?: string }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="mb-3 flex items-center gap-2">
          {icon}
          <h2 className="text-xs font-black uppercase tracking-widest text-foreground">{title}</h2>
          <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{headerValue}</span>
        </div>
        {rows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Sin datos aún</div>
        ) : (
          <div className="space-y-1">{rows.map((r, i) => render(r, i))}</div>
        )}
      </CardContent>
    </Card>
  );
}

function Row({ idx, name, sub, team, value }: any) {
  return (
    <div className="flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-muted/50">
      <span className="w-5 text-center text-xs font-bold tabular-nums text-muted-foreground">{idx + 1}</span>
      <TeamBadge name={team?.name ?? "?"} logoPath={team?.logo_url} color={team?.primary_color} size={28} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{name}</div>
        {sub && <div className="truncate text-[11px] text-muted-foreground">{sub}</div>}
      </div>
      <div className="text-base font-black tabular-nums text-primary">{value}</div>
    </div>
  );
}
