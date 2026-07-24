import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useActiveChampionship } from "@/lib/championship";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, ExternalLink, Download, Eye } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export const Route = createFileRoute("/resoluciones")({
  head: () => ({
    meta: [
      { title: "Resoluciones · Integración Futsal" },
      { name: "description", content: "Resoluciones oficiales del Comité de Penalización del Campeonato Integración Profesional Futsal." },
      { property: "og:title", content: "Resoluciones · Integración Futsal" },
      { property: "og:description", content: "Resoluciones oficiales del Comité de Penalización." },
    ],
  }),
  component: ResolucionesPage,
});

function ResolucionesPage() {
  const { activeId } = useActiveChampionship();
  const [preview, setPreview] = useState<{ url: string; title: string } | null>(null);

  const teamIds = useQuery({
    queryKey: ["public", "res-team-ids", activeId],
    enabled: !!activeId,
    queryFn: async () => {
      const { data } = await supabase.from("teams").select("id").eq("championship_id", activeId!);
      return (data ?? []).map((t: any) => t.id) as string[];
    },
  });

  const resolutions = useQuery({
    queryKey: ["public", "resolutions", activeId, teamIds.data?.length ?? 0],
    enabled: !!activeId && !!teamIds.data,
    queryFn: async () => {
      const ids = teamIds.data ?? [];
      if (ids.length === 0) return [] as any[];
      // Traemos resoluciones vía la observación (que tiene team_id)
      const { data } = await (supabase as any)
        .from("match_resolutions")
        .select("*, observation:observation_id(id, team_id, description, observation_type, team:team_id(name,logo_url))")
        .order("created_at", { ascending: false });
      return ((data ?? []) as any[]).filter((r) => r.observation && ids.includes(r.observation.team_id));
    },
  });

  if (!activeId) {
    return <div className="mx-auto max-w-md p-10 text-center text-sm text-muted-foreground">Elegí un campeonato para ver resoluciones.</div>;
  }

  const list = resolutions.data ?? [];

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-primary" />
        <h1 className="text-3xl font-black uppercase tracking-tight">Resoluciones</h1>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">Resoluciones oficiales del Comité de Penalización.</p>

      <div className="mt-6 space-y-3">
        {resolutions.isLoading && <div className="text-sm text-muted-foreground">Cargando…</div>}
        {!resolutions.isLoading && list.length === 0 && (
          <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">
            Aún no hay resoluciones publicadas en este campeonato.
          </CardContent></Card>
        )}
        {list.map((r: any) => (
          <Card key={r.id}>
            <CardContent className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-bold">{r.title}</h2>
                    {r.observation?.team?.name && <Badge variant="outline">{r.observation.team.name}</Badge>}
                    {r.observation?.observation_type && <Badge variant="secondary" className="capitalize">{r.observation.observation_type}</Badge>}
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {r.created_at ? format(new Date(r.created_at), "dd MMM yyyy · HH:mm", { locale: es }) : ""}
                  </div>
                  {r.description && <p className="mt-2 whitespace-pre-wrap text-sm">{r.description}</p>}
                </div>
                {r.pdf_url && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setPreview({ url: r.pdf_url, title: r.title })}>
                      <Eye className="h-4 w-4" /> Ver
                    </Button>
                    <a href={r.pdf_url} target="_blank" rel="noreferrer">
                      <Button size="sm" variant="ghost" className="gap-1.5"><ExternalLink className="h-4 w-4" /> Abrir</Button>
                    </a>
                    <a href={r.pdf_url} download>
                      <Button size="sm" variant="ghost" className="gap-1.5"><Download className="h-4 w-4" /> Descargar</Button>
                    </a>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!preview} onOpenChange={(o) => { if (!o) setPreview(null); }}>
        <DialogContent className="max-w-5xl">
          <DialogHeader><DialogTitle>{preview?.title}</DialogTitle></DialogHeader>
          {preview && (
            <iframe src={preview.url} title={preview.title} className="h-[75vh] w-full rounded-lg border border-border" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
