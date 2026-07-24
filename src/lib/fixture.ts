// Genera fixture round-robin (circle method) ida y vuelta.
export type Pairing = { home: string; away: string; matchday: number };

export function roundRobin(teamIds: string[], doubleRound = true): Pairing[] {
  const ids = [...teamIds];
  if (ids.length < 2) return [];
  const hasBye = ids.length % 2 === 1;
  if (hasBye) ids.push("__BYE__");
  const n = ids.length;
  const rounds = n - 1;
  const half = n / 2;
  const fixed = ids[0];
  let rotating = ids.slice(1);
  const pairings: Pairing[] = [];

  for (let r = 0; r < rounds; r++) {
    const day = [fixed, ...rotating];
    for (let i = 0; i < half; i++) {
      const a = day[i];
      const b = day[n - 1 - i];
      if (a === "__BYE__" || b === "__BYE__") continue;
      const home = r % 2 === 0 ? a : b;
      const away = r % 2 === 0 ? b : a;
      pairings.push({ home, away, matchday: r + 1 });
    }
    rotating = [rotating[rotating.length - 1], ...rotating.slice(0, -1)];
  }

  if (doubleRound) {
    const second = pairings.map((p) => ({
      home: p.away,
      away: p.home,
      matchday: p.matchday + rounds,
    }));
    return [...pairings, ...second];
  }
  return pairings;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
