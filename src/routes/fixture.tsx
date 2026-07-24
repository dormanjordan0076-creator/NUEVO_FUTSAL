import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MatchRow } from "./index";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useActiveChampionship } from "@/lib/championship";
import type { Phase } from "@/lib/phases";

export const Route = createFileRoute("/fixture")({
  head: () => ({
    meta: [
      { title: "Fixture · Campeonato Integración Profesional Futsal" },
      { name: "description", content: "Calendario completo de partidos del Campeonato Integración Profesional Futsal." },
      { property: "og:title", content: "Fixture · Integración Futsal" },
      { property: "og:description", content: "Calendario completo de partidos." },
    ],
  }),
  component: FixturePage,
});

function FixturePage() {
  const { activeId } = useActiveChampionship();
  const [categoryId, setCategoryId] = useState<string>("__all__");
  const [phaseId, setPhaseId] = useState<string>("__all__");

  const teams = useQuery({
    queryKey: ["public", "teams", activeId],
    enabled: !!activeId,
    queryFn: async () => (await supabase.from("teams").select("id,name,logo_url,primary_color").eq("championship_id", activeId!)).data ?? [],
  });
  const matches = useQuery({
    queryKey: ["public", "matches", "all", activeId],
    enabled: !!activeId,
    queryFn: async () => (await supabase.from("matches").select("*").eq("championship_id", activeId!).order("matchday").order("match_date")).data ?? [],
  });
  const categories = useQuery({
    queryKey: ["public", "categories", activeId],
    enabled: !!activeId,
    queryFn: async () => (await supabase.from("categories").select("id,name").eq("championship_id", activeId!).order("display_order")).data ?? [],
  });
  const phases = useQuery({
    queryKey: ["public", "phases", activeId],
    enabled: !!activeId,
    queryFn: async () => (((await (supabase as any).from("phases").select("*").eq("championship_id", activeId!).order("display_order")).data ?? []) as Phase[]),
  });

  const catPhases = useMemo(
    () => (phases.data ?? []).filter((p) => categoryId === "__all__" || p.category_id === categoryId),
    [phases.data, categoryId],
  );
  const phaseById = useMemo(() => new Map((phases.data ?? []).map((p) => [p.id, p])), [phases.data]);

  const filtered = useMemo(() => {
    const all = (matches.data ?? []) as any[];
    if (phaseId !== "__all__") return all.filter((m) => m.phase_id === phaseId);
    if (categoryId !== "__all__") {
      const ids = new Set(catPhases.map((p) => p.id));
      return all.filter((m) => m.phase_id && ids.has(m.phase_id));
    }
    return all;
  }, [matches.data, phaseId, categoryId, catPhases]);

  // Agrupar primero por fase (según display_order), luego por día.
  const groupedByPhase = useMemo(() => {
    const map = new Map<string, { phase: Phase | null; days: Map<string, any[]> }>();
    for (const m of filtered) {
      const p = m.phase_id ? phaseById.get(m.phase_id) ?? null : null;
      const key = p?.id ?? "__none__";
      if (!map.has(key)) map.set(key, { phase: p, days: new Map() });
      const bucket = map.get(key)!;
      const dayKey = m.match_date ? format(new Date(m.match_date), "EEEE d 'de' MMMM, yyyy", { locale: es }) : `Fecha ${m.matchday ?? "—"}`;
      if (!bucket.days.has(dayKey)) bucket.days.set(dayKey, []);
      bucket.days.get(dayKey)!.push(m);
    }
    return [...map.values()].sort((a, b) => {
      const ao = a.phase?.display_order ?? 9999;
      const bo = b.phase?.display_order ?? 9999;
      return ao - bo;
    });
  }, [filtered, phaseById]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-3xl font-black uppercase tracking-tight">Fixture</h1>
      <p className="mt-1 text-sm text-muted-foreground">Todos los partidos del torneo</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:max-w-2xl">
        <div>
          <Label className="text-xs">Categoría</Label>
          <Select value={categoryId} onValueChange={(v) => { setCategoryId(v); setPhaseId("__all__"); }}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas</SelectItem>
              {(categories.data ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Fase</Label>
          <Select value={phaseId} onValueChange={setPhaseId} disabled={catPhases.length === 0}>
            <SelectTrigger><SelectValue placeholder={catPhases.length ? "Todas" : "Sin fases configuradas"} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todas</SelectItem>
              {catPhases.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} · {p.kind}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-6 space-y-8">
        {groupedByPhase.map(({ phase, days }) => (
          <section key={phase?.id ?? "__none__"}>
            {phase && (
              <div className="mb-3 flex items-center gap-2">
                <h2 className="text-sm font-black uppercase tracking-widest">{phase.name}</h2>
                <Badge variant="outline" className="text-[10px] capitalize">{phase.kind}</Badge>
              </div>
            )}
            <div className="space-y-4">
              {[...days.entries()].map(([day, ms]) => (
                <Card key={day}>
                  <CardContent className="p-5">
                    <h3 className="mb-3 text-xs font-black uppercase tracking-widest text-primary">{day}</h3>
                    <div className="space-y-2">
                      {ms.map((m) => <MatchRow key={m.id} m={m} teams={teams.data ?? []} />)}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ))}
        {groupedByPhase.length === 0 && (
          <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">
            Aún no hay partidos en el fixture.
          </CardContent></Card>
        )}
      </div>
    </div>
  );
}
