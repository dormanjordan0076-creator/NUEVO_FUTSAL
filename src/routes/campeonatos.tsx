import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useActiveChampionship } from "@/lib/championship";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Trophy, Plus, ArrowRight, Calendar, MapPin, Trash2, History, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/campeonatos")({
  head: () => ({
    meta: [
      { title: "Mis campeonatos · Integración Futsal" },
      { name: "description", content: "Listado de campeonatos activos y finalizados. Elegí uno para trabajar o consultarlo." },
      { property: "og:title", content: "Mis campeonatos · Integración Futsal" },
      { property: "og:description", content: "Campeonatos activos e historial de temporadas anteriores." },
    ],
  }),
  component: CampeonatosPage,
});

type UserChamp = { championship_id: string; role: string };

function isFinished(c: any) {
  return c?.status === "finalizado";
}

function CampeonatosPage() {
  const { user, isSuperAdmin, loading: authLoading } = useAuth();
  const { setActive, championships, loading: champLoading } = useActiveChampionship();
  const nav = useNavigate();
  const qc = useQueryClient();

  const memberships = useQuery({
    queryKey: ["user", "championships", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("user_championships");
      if (error) throw error;
      return (data ?? []) as UserChamp[];
    },
  });

  if (authLoading || champLoading) {
    return <div className="p-10 text-center text-sm text-muted-foreground">Cargando…</div>;
  }

  // Visitante público: puede ver activos y finalizados y entrar en modo consulta.
  const isGuest = !user;
  const allowedIds = new Set((memberships.data ?? []).map((m) => m.championship_id));
  const visible = (isSuperAdmin || isGuest)
    ? championships
    : championships.filter((c) => allowedIds.has(c.id));
  const activos = visible.filter((c) => !isFinished(c));
  const historial = visible.filter((c) => isFinished(c));

  const onEnter = (id: string) => { setActive(id); nav({ to: "/" }); };
  const onDelete = async (c: any) => {
    const msg = `¿Eliminar campeonato "${c.name}"?\n\nSe eliminarán en cascada: categorías, grupos, equipos, jugadores, partidos, fases, participaciones, observaciones y resoluciones asociadas.\n\nEsta acción NO se puede deshacer.`;
    if (!confirm(msg)) return;
    if (!confirm(`Confirmá una vez más: esto es DEFINITIVO. ¿Continuar?`)) return;
    const { error } = await (supabase as any).from("championships").delete().eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success("Campeonato eliminado");
    qc.invalidateQueries({ queryKey: ["public", "championships"] });
    qc.invalidateQueries({ queryKey: ["user", "championships"] });
  };
  const onToggleStatus = async (c: any) => {
    const finish = !isFinished(c);
    const label = finish ? "finalizar" : "reactivar";
    if (!confirm(`¿${label.charAt(0).toUpperCase()+label.slice(1)} el campeonato "${c.name}"?`)) return;
    const payload: any = finish
      ? { status: "finalizado", is_active: false }
      : { status: "activo", is_active: true };
    const { error } = await (supabase as any).from("championships").update(payload).eq("id", c.id);
    if (error) return toast.error(error.message);
    toast.success(finish ? "Campeonato finalizado" : "Campeonato reactivado");
    qc.invalidateQueries({ queryKey: ["public", "championships"] });
    qc.invalidateQueries({ queryKey: ["user", "championships"] });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">
            {isGuest ? "Campeonatos" : "Mis campeonatos"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isGuest
              ? "Elegí un campeonato para consultar fixture, tabla y estadísticas."
              : "Seleccioná un campeonato para trabajar o consultá el historial."}
          </p>
        </div>
        {isSuperAdmin && (
          <NewChampionshipButton onCreated={() => {
            qc.invalidateQueries({ queryKey: ["public", "championships"] });
            qc.invalidateQueries({ queryKey: ["user", "championships"] });
          }} />
        )}
        {isGuest && (
          <Button variant="outline" onClick={() => nav({ to: "/auth" })}>Ingresar</Button>
        )}
      </div>

      <section className="mt-8">
        <SectionHeader icon={<Sparkles className="h-4 w-4 text-primary" />} title="Activos" count={activos.length} />
        <ChampGrid list={activos} isSuperAdmin={isSuperAdmin} finished={false} onEnter={onEnter} onDelete={onDelete} onToggleStatus={onToggleStatus} />
      </section>

      <section className="mt-10">
        <SectionHeader icon={<History className="h-4 w-4 text-muted-foreground" />} title="Historial (finalizados)" count={historial.length} muted />
        <ChampGrid list={historial} isSuperAdmin={isSuperAdmin} finished onEnter={onEnter} onDelete={onDelete} onToggleStatus={onToggleStatus} />
      </section>

      {visible.length === 0 && (
        <div className="mt-6 rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          {isSuperAdmin ? "No hay campeonatos. Creá el primero." : "No tenés campeonatos asignados. Pedile acceso al Super Administrador."}
        </div>
      )}
    </div>
  );
}

function SectionHeader({ icon, title, count, muted }: { icon: any; title: string; count: number; muted?: boolean }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      {icon}
      <h2 className={`text-xs font-black uppercase tracking-widest ${muted ? "text-muted-foreground" : "text-foreground"}`}>{title}</h2>
      <Badge variant="outline" className="tabular-nums">{count}</Badge>
    </div>
  );
}

function ChampGrid({ list, isSuperAdmin, finished, onEnter, onDelete, onToggleStatus }: { list: any[]; isSuperAdmin: boolean; finished: boolean; onEnter: (id: string) => void; onDelete: (c: any) => void; onToggleStatus: (c: any) => void }) {
  if (list.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed p-6 text-center text-xs text-muted-foreground">
        {finished ? "No hay campeonatos finalizados aún." : "No hay campeonatos activos."}
      </div>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {list.map((c) => (
        <Card key={c.id} className={`group overflow-hidden transition hover:shadow-elevated ${finished ? "opacity-90" : ""}`}>
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${finished ? "bg-muted text-muted-foreground" : "bg-gradient-pitch text-pitch-foreground"}`}>
                <Trophy className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate font-bold">{c.name}</h3>
                  {finished
                    ? <Badge variant="secondary" className="text-[10px]">Finalizado</Badge>
                    : <Badge className="bg-success text-success-foreground text-[10px]">Activo</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">Temporada {c.season ?? c.year}</p>
              </div>
            </div>
            {(c.location || c.start_date) && (
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                {c.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{c.location}</span>}
                {c.start_date && <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />{c.start_date}</span>}
              </div>
            )}
            <div className="mt-4 flex gap-2">
              <Button className="flex-1 gap-2" variant={finished ? "outline" : "default"} onClick={() => onEnter(c.id)}>
                {finished ? "Consultar" : "Abrir"} <ArrowRight className="h-4 w-4" />
              </Button>
              {isSuperAdmin && (
                <>
                  <Button variant="outline" size="sm" title={finished ? "Reactivar campeonato" : "Finalizar campeonato"} onClick={() => onToggleStatus(c)}>
                    {finished ? "Reactivar" : "Finalizar"}
                  </Button>
                  <Button variant="outline" size="icon" title="Eliminar campeonato" onClick={() => onDelete(c)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function NewChampionshipButton({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", year: new Date().getFullYear(), season: "", location: "", organizer: "", description: "" });
  const [saving, setSaving] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-1.5"><Plus className="h-4 w-4" /> Nuevo campeonato</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Crear nuevo campeonato</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nombre</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Año</Label><Input type="number" value={f.year} onChange={(e) => setF({ ...f, year: +e.target.value })} /></div>
            <div><Label>Temporada</Label><Input value={f.season} onChange={(e) => setF({ ...f, season: e.target.value })} placeholder="Ej: Apertura 2026" /></div>
          </div>
          <div><Label>Organizador</Label><Input value={f.organizer} onChange={(e) => setF({ ...f, organizer: e.target.value })} /></div>
          <div><Label>Ubicación</Label><Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></div>
          <div><Label>Descripción</Label><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button
            disabled={saving || !f.name.trim()}
            onClick={async () => {
              setSaving(true);
              const { data: u } = await supabase.auth.getUser();
              const payload: any = {
                name: f.name.trim(),
                year: f.year,
                season: f.season || null,
                location: f.location || null,
                organizer: f.organizer || null,
                description: f.description || null,
                status: "activo",
                is_active: true,
                created_by: u.user?.id ?? null,
              };
              const { error } = await (supabase as any).from("championships").insert(payload);
              setSaving(false);
              if (error) return toast.error(error.message);
              toast.success("Campeonato creado");
              setOpen(false);
              setF({ name: "", year: new Date().getFullYear(), season: "", location: "", organizer: "", description: "" });
              onCreated();
            }}
          >{saving ? "Creando..." : "Crear"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
