import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { TeamBadge } from "@/components/TeamBadge";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Goal, Square, Trophy, MapPin, Clock, User as UserIcon } from "lucide-react";

type Team = { id: string; name: string; logo_url?: string | null; primary_color?: string | null };

export function MatchDetailDialog({
  matchId,
  open,
  onOpenChange,
  teams,
}: {
  matchId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  teams: Team[];
}) {
  const match = useQuery({
    queryKey: ["match-detail", matchId],
    enabled: !!matchId && open,
    queryFn: async () => (await supabase.from("matches").select("*").eq("id", matchId!).maybeSingle()).data,
  });
  const events = useQuery({
    queryKey: ["match-detail", "events", matchId],
    enabled: !!matchId && open,
    queryFn: async () =>
      (await supabase
        .from("match_events")
        .select("id,type,minute,team_id,player_id,players(full_name,jersey_number)")
        .eq("match_id", matchId!)
        .order("minute", { ascending: true })).data ?? [],
  });
  const observations = useQuery({
    queryKey: ["match-detail", "obs", matchId],
    enabled: !!matchId && open,
    queryFn: async () =>
      ((await (supabase as any)
        .from("observations")
        .select("id,content,status,created_at,type")
        .eq("match_id", matchId!)
        .order("created_at", { ascending: false })).data ?? []) as any[],
  });

  const m: any = match.data;
  const home = m ? teams.find((t) => t.id === m.home_team_id) : null;
  const away = m ? teams.find((t) => t.id === m.away_team_id) : null;
  const evs = events.data ?? [];
  const goals = evs.filter((e: any) => e.type === "gol" || e.type === "autogol");
  const cards = evs.filter((e: any) => e.type === "amarilla" || e.type === "roja");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Detalle del partido</DialogTitle>
        </DialogHeader>
        {!m ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Cargando…</p>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl border border-border bg-card/50 p-4">
              <div className="flex min-w-0 items-center justify-end gap-2 text-right">
                <span className="truncate text-sm font-black uppercase">{home?.name ?? "—"}</span>
                <TeamBadge name={home?.name ?? "?"} logoPath={home?.logo_url} color={home?.primary_color} size={40} />
              </div>
              <div className="grid place-items-center">
                {m.status === "finalizado" ? (
                  <div className="rounded-lg bg-foreground px-4 py-2 text-2xl font-black tabular-nums text-background">
                    {m.home_score} <span className="opacity-50">-</span> {m.away_score}
                  </div>
                ) : (
                  <Badge variant="secondary" className="uppercase">{m.status}</Badge>
                )}
                {m.result_type === "walkover" && (
                  <Badge variant="outline" className="mt-1 text-[10px]">Walkover</Badge>
                )}
              </div>
              <div className="flex min-w-0 items-center gap-2">
                <TeamBadge name={away?.name ?? "?"} logoPath={away?.logo_url} color={away?.primary_color} size={40} />
                <span className="truncate text-sm font-black uppercase">{away?.name ?? "—"}</span>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              {m.match_date && (
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {format(new Date(m.match_date), "EEEE d 'de' MMMM, HH:mm", { locale: es })}
                </span>
              )}
              {m.venue && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{m.venue}</span>}
              {m.matchday != null && <span className="inline-flex items-center gap-1"><Trophy className="h-3 w-3" />Fecha {m.matchday}{m.group_name ? ` · Grupo ${m.group_name}` : ""}</span>}
              {m.referee_main && <span className="inline-flex items-center gap-1"><UserIcon className="h-3 w-3" />Árbitro: {m.referee_main}</span>}
            </div>

            {m.result_type !== "walkover" && (
              <>
                <Section title="Goles" icon={<Goal className="h-4 w-4 text-primary" />}>
                  {goals.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sin goles registrados.</p>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {goals.map((e: any) => {
                        const team = teams.find((t) => t.id === e.team_id);
                        return (
                          <li key={e.id} className="flex items-center justify-between rounded border border-border/50 bg-card/40 px-2 py-1">
                            <span className="flex items-center gap-2">
                              <TeamBadge name={team?.name ?? "?"} logoPath={team?.logo_url} color={team?.primary_color} size={18} />
                              <span className="font-semibold">
                                {e.players?.full_name ?? "—"}
                                {e.type === "autogol" && <Badge variant="outline" className="ml-2 text-[9px]">AG</Badge>}
                              </span>
                            </span>
                            <span className="tabular-nums text-xs text-muted-foreground">{e.minute != null ? `${e.minute}'` : "—"}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Section>

                <Section title="Tarjetas" icon={<Square className="h-4 w-4 text-amber-500" />}>
                  {cards.length === 0 ? (
                    <p className="text-xs text-muted-foreground">Sin tarjetas.</p>
                  ) : (
                    <ul className="space-y-1 text-sm">
                      {cards.map((e: any) => {
                        const team = teams.find((t) => t.id === e.team_id);
                        return (
                          <li key={e.id} className="flex items-center justify-between rounded border border-border/50 bg-card/40 px-2 py-1">
                            <span className="flex items-center gap-2">
                              <span className={`inline-block h-3 w-2.5 rounded-sm ${e.type === "roja" ? "bg-red-600" : "bg-amber-400"}`} />
                              <TeamBadge name={team?.name ?? "?"} logoPath={team?.logo_url} color={team?.primary_color} size={18} />
                              <span className="font-semibold">{e.players?.full_name ?? "—"}</span>
                            </span>
                            <span className="tabular-nums text-xs text-muted-foreground">{e.minute != null ? `${e.minute}'` : "—"}</span>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Section>
              </>
            )}

            {(observations.data ?? []).length > 0 && (
              <Section title="Observaciones" icon={<span className="text-primary">✍</span>}>
                <ul className="space-y-1 text-xs">
                  {(observations.data ?? []).map((o: any) => (
                    <li key={o.id} className="rounded border border-border/50 bg-card/40 p-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[9px] uppercase">{o.status}</Badge>
                        <span className="text-[10px] text-muted-foreground">{format(new Date(o.created_at), "dd/MM HH:mm")}</span>
                      </div>
                      <p className="mt-1 whitespace-pre-wrap">{o.content}</p>
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 flex items-center gap-2 text-xs font-black uppercase tracking-widest">
        {icon}
        {title}
      </h3>
      {children}
    </div>
  );
}
