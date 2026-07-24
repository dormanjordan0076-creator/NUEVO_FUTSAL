import type { Tables } from "@/integrations/supabase/types";

type Match = Tables<"matches">;
type Event = Tables<"match_events">;
type Player = Tables<"players">;

export type TeamStats = {
  pj: number;
  pg: number;
  pe: number;
  pp: number;
  gf: number;
  gc: number;
  dg: number;
  yellow: number;
  red: number;
  avgFor: number;
  avgAgainst: number;
  last5: ("V" | "E" | "D")[];
  topScorer?: { player_id: string; goals: number };
  topCarded?: { player_id: string; cards: number };
  bestKeeper?: { player_id: string; conceded: number };
};

export function computeTeamStats(teamId: string, matches: Match[], events: Event[], players: Player[]): TeamStats {
  const finished = matches.filter(
    (m) => m.status === "finalizado" && (m.home_team_id === teamId || m.away_team_id === teamId),
  );

  let pg = 0, pe = 0, pp = 0, gf = 0, gc = 0;
  const chrono = [...finished].sort((a, b) => {
    const ta = a.match_date ? new Date(a.match_date).getTime() : 0;
    const tb = b.match_date ? new Date(b.match_date).getTime() : 0;
    return tb - ta;
  });
  const last5: ("V" | "E" | "D")[] = [];

  for (const m of finished) {
    const isHome = m.home_team_id === teamId;
    const own = (isHome ? m.home_score : m.away_score) ?? 0;
    const rival = (isHome ? m.away_score : m.home_score) ?? 0;
    gf += own; gc += rival;
    if (own > rival) pg++;
    else if (own === rival) pe++;
    else pp++;
  }
  for (const m of chrono.slice(0, 5)) {
    const isHome = m.home_team_id === teamId;
    const own = (isHome ? m.home_score : m.away_score) ?? 0;
    const rival = (isHome ? m.away_score : m.home_score) ?? 0;
    last5.push(own > rival ? "V" : own === rival ? "E" : "D");
  }

  const teamEvents = events.filter((e) => e.team_id === teamId);
  const yellow = teamEvents.filter((e) => e.type === "amarilla").length;
  const red = teamEvents.filter((e) => e.type === "roja").length;

  // Máximo goleador
  const goalsByPlayer = new Map<string, number>();
  for (const e of teamEvents) if (e.type === "gol" && e.player_id) goalsByPlayer.set(e.player_id, (goalsByPlayer.get(e.player_id) ?? 0) + 1);
  const topScorerEntry = [...goalsByPlayer.entries()].sort((a, b) => b[1] - a[1])[0];

  // Jugador con más tarjetas
  const cardsByPlayer = new Map<string, number>();
  for (const e of teamEvents) if ((e.type === "amarilla" || e.type === "roja") && e.player_id)
    cardsByPlayer.set(e.player_id, (cardsByPlayer.get(e.player_id) ?? 0) + 1);
  const topCardedEntry = [...cardsByPlayer.entries()].sort((a, b) => b[1] - a[1])[0];

  // Arquero menos vencido (goles recibidos en partidos donde el arquero jugó — aproximación: reparte los goles recibidos entre arqueros del plantel)
  const goalkeepers = players.filter((p) => p.team_id === teamId && p.position === "arquero");
  let bestKeeper: TeamStats["bestKeeper"];
  if (goalkeepers.length === 1) bestKeeper = { player_id: goalkeepers[0].id, conceded: gc };

  const pj = pg + pe + pp;

  return {
    pj, pg, pe, pp, gf, gc, dg: gf - gc,
    yellow, red,
    avgFor: pj ? +(gf / pj).toFixed(2) : 0,
    avgAgainst: pj ? +(gc / pj).toFixed(2) : 0,
    last5,
    topScorer: topScorerEntry ? { player_id: topScorerEntry[0], goals: topScorerEntry[1] } : undefined,
    topCarded: topCardedEntry ? { player_id: topCardedEntry[0], cards: topCardedEntry[1] } : undefined,
    bestKeeper,
  };
}

export function calcAge(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const b = new Date(birthDate);
  if (isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) age--;
  return age;
}
