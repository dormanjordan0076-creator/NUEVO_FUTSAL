export type StandingRow = {
  teamId: string;
  teamName: string;
  logoUrl?: string | null;
  group?: string | null;
  pj: number; pg: number; pe: number; pp: number;
  gf: number; gc: number; dg: number; pts: number;
};

export type MatchForStandings = {
  home_team_id: string | null;
  away_team_id: string | null;
  home_score: number | null;
  away_score: number | null;
  status: string;
};

export type TeamLite = { id: string; name: string; logo_url?: string | null; group_name?: string | null };

export function computeStandings(teams: TeamLite[], matches: MatchForStandings[]): StandingRow[] {
  const map = new Map<string, StandingRow>();
  for (const t of teams) {
    map.set(t.id, {
      teamId: t.id, teamName: t.name, logoUrl: t.logo_url, group: t.group_name,
      pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, dg: 0, pts: 0,
    });
  }
  for (const m of matches) {
    if (m.status !== "finalizado") continue;
    if (!m.home_team_id || !m.away_team_id) continue;
    if (m.home_score == null || m.away_score == null) continue;
    const h = map.get(m.home_team_id);
    const a = map.get(m.away_team_id);
    if (!h || !a) continue;
    h.pj++; a.pj++;
    h.gf += m.home_score; h.gc += m.away_score;
    a.gf += m.away_score; a.gc += m.home_score;
    if (m.home_score > m.away_score) { h.pg++; h.pts += 3; a.pp++; }
    else if (m.home_score < m.away_score) { a.pg++; a.pts += 3; h.pp++; }
    else { h.pe++; a.pe++; h.pts++; a.pts++; }
  }
  for (const r of map.values()) r.dg = r.gf - r.gc;
  return [...map.values()].sort((x, y) =>
    y.pts - x.pts || y.dg - x.dg || y.gf - x.gf || x.teamName.localeCompare(y.teamName)
  );
}
