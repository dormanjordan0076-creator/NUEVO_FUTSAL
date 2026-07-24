import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { computeStandings } from "@/lib/standings";
import { TeamBadge } from "@/components/TeamBadge";
import { Card, CardContent } from "@/components/ui/card";
import { useActiveChampionship } from "@/lib/championship";

export const Route = createFileRoute("/tabla")({
  head: () => ({
    meta: [
      { title: "Tabla de posiciones · Integración Futsal" },
      { name: "description", content: "Tabla de posiciones oficial del Campeonato Integración Profesional Futsal." },
      { property: "og:title", content: "Tabla de posiciones · Integración Futsal" },
      { property: "og:description", content: "Tabla oficial actualizada en tiempo real." },
    ],
  }),
  component: TablaPage,
});

function TablaPage() {
  const { activeId } = useActiveChampionship();
  const qc = useQueryClient();

  const teams = useQuery({
    queryKey: ["public", "teams", activeId],
    enabled: !!activeId,
    queryFn: async () => (await supabase.from("teams").select("id,name,logo_url,group_name,category_id,primary_color").eq("championship_id", activeId!)).data ?? [],
  });
  const matches = useQuery({
    queryKey: ["public", "matches", "all", activeId],
    enabled: !!activeId,
    queryFn: async () => (await supabase.from("matches").select("*").eq("championship_id", activeId!)).data ?? [],
  });
  const categories = useQuery({
    queryKey: ["public", "categories", activeId],
    enabled: !!activeId,
    queryFn: async () => (await supabase.from("categories").select("id,name").eq("championship_id", activeId!).order("display_order")).data ?? [],
  });
  const groups = useQuery({
    queryKey: ["public", "groups", activeId],
    enabled: !!activeId,
    queryFn: async () => (((await (supabase as any).from("groups").select("id,name,category_id,display_order").eq("championship_id", activeId!).order("display_order")).data ?? []) as any[]),
  });

  // Realtime: refetch tablas al cambiar cualquier resultado
  useEffect(() => {
    if (!activeId) return;
    const channel = supabase
      .channel(`tabla-matches-${activeId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: `championship_id=eq.${activeId}` }, () => {
        qc.invalidateQueries({ queryKey: ["public", "matches", "all", activeId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [activeId, qc]);

  const loading = teams.isLoading || matches.isLoading || categories.isLoading || groups.isLoading;
  const cats = categories.data ?? [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-black uppercase tracking-tight">Tabla de posiciones</h1>
      <p className="mt-1 text-sm text-muted-foreground">Se actualiza automáticamente con cada resultado</p>

      {loading && (
        <div className="mt-6 text-sm text-muted-foreground">Cargando…</div>
      )}

      {!loading && cats.length === 0 && (
        <div className="mt-6 rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No hay categorías configuradas en este campeonato.
        </div>
      )}

      <div className="mt-6 space-y-10">
        {cats.map((cat: any) => {
          const catTeams = (teams.data ?? []).filter((t: any) => t.category_id === cat.id);
          const teamIds = new Set(catTeams.map((t: any) => t.id));
          const catMatches = (matches.data ?? []).filter((m: any) => teamIds.has(m.home_team_id) || teamIds.has(m.away_team_id));
          const catGroups = (groups.data ?? []).filter((g: any) => g.category_id === cat.id);

          return (
            <section key={cat.id}>
              <h2 className="mb-3 text-2xl font-black uppercase tracking-tight">{cat.name}</h2>
              {catTeams.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
                  Sin equipos asignados a esta categoría.
                </div>
              ) : catGroups.length === 0 ? (
                <StandingsTable
                  title="Tabla general"
                  rows={computeStandings(catTeams as any, catMatches as any)}
                />
              ) : (
                <div className="grid gap-6 lg:grid-cols-2">
                  {catGroups.map((g: any) => {
                    const groupTeams = catTeams.filter((t: any) => (t.group_name ?? "").toString().trim() === g.name);
                    return (
                      <StandingsTable
                        key={g.id}
                        title={`Grupo ${g.name}`}
                        rows={computeStandings(groupTeams as any, catMatches as any)}
                      />
                    );
                  })}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function StandingsTable({ title, rows }: { title: string; rows: ReturnType<typeof computeStandings> }) {
  return (
    <Card>
      <CardContent className="p-5">
        <h3 className="mb-3 text-xs font-black uppercase tracking-widest text-primary">{title}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                <th className="py-2 text-left">#</th>
                <th className="text-left">Equipo</th>
                <th className="px-1 text-center">PJ</th>
                <th className="px-1 text-center">PG</th>
                <th className="px-1 text-center">PE</th>
                <th className="px-1 text-center">PP</th>
                <th className="px-1 text-center">GF</th>
                <th className="px-1 text-center">GC</th>
                <th className="px-1 text-center">DG</th>
                <th className="px-1 text-center font-black text-foreground">PTS</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.teamId} className={`border-b border-border/50 last:border-0 ${i < 4 ? "bg-primary/5" : ""}`}>
                  <td className="py-2.5 tabular-nums text-muted-foreground">{i + 1}</td>
                  <td>
                    <Link to="/equipo/$teamId" params={{ teamId: r.teamId }} className="flex items-center gap-2 hover:text-primary">
                      <TeamBadge name={r.teamName} logoPath={r.logoUrl} size={24} />
                      <span className="font-semibold">{r.teamName}</span>
                    </Link>
                  </td>
                  <td className="px-1 text-center tabular-nums">{r.pj}</td>
                  <td className="px-1 text-center tabular-nums">{r.pg}</td>
                  <td className="px-1 text-center tabular-nums">{r.pe}</td>
                  <td className="px-1 text-center tabular-nums">{r.pp}</td>
                  <td className="px-1 text-center tabular-nums">{r.gf}</td>
                  <td className="px-1 text-center tabular-nums">{r.gc}</td>
                  <td className="px-1 text-center tabular-nums">{r.dg > 0 ? `+${r.dg}` : r.dg}</td>
                  <td className="px-1 text-center font-black tabular-nums text-primary">{r.pts}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={10} className="py-8 text-center text-sm text-muted-foreground">Sin datos aún</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
