export type Target = { time: number; beat: number };
export type Match = { beat: number; target: number; tap: number; offsetMs: number };
export type BeatStats = { beat: number; hits: number; total: number; meanMs: number | null };
export type Evaluation = {
  matches: Match[];
  missed: Target[];
  extra: number[];
  hitRate: number;
  meanMs: number | null;
  spreadMs: number | null;
  perBeat: BeatStats[];
};

type GridLike = { beats: number[]; first_start: number; order: number[]; cycle_len: number };

/** The beats whose number is one of the accents, with their time in the song. */
export function buildTargets(grid: GridLike, accents: number[], from = -Infinity, to = Infinity): Target[] {
  const n = grid.cycle_len;
  const targets: Target[] = [];
  grid.beats.forEach((time, i) => {
    const beat = grid.order[(((i - grid.first_start) % n) + n) % n];
    if (accents.includes(beat) && time >= from && time <= to) targets.push({ time, beat });
  });
  return targets;
}

/** How close a tap must be to an accent to count: under half a pulse, and never more than 200 ms. */
export function matchWindow(beats: number[]): number {
  if (beats.length < 2) return 0.15;
  const gaps = beats.slice(1).map((t, i) => t - beats[i]).sort((a, b) => a - b);
  return Math.min(0.2, 0.45 * gaps[Math.floor(gaps.length / 2)]);
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/**
 * Pairs every accent with the nearest unused tap inside the window (earliest accent first).
 * Offsets are in milliseconds: negative = early, positive = late.
 */
export function evaluateTaps(taps: number[], targets: Target[], windowS: number): Evaluation {
  const sorted = [...taps].sort((a, b) => a - b);
  const used = new Set<number>();
  const matches: Match[] = [];
  const missed: Target[] = [];

  for (const target of [...targets].sort((a, b) => a.time - b.time)) {
    let best = -1;
    sorted.forEach((tap, i) => {
      if (used.has(i) || Math.abs(tap - target.time) > windowS) return;
      if (best < 0 || Math.abs(tap - target.time) < Math.abs(sorted[best] - target.time)) best = i;
    });
    if (best < 0) {
      missed.push(target);
      continue;
    }
    used.add(best);
    matches.push({ beat: target.beat, target: target.time, tap: sorted[best], offsetMs: Math.round((sorted[best] - target.time) * 1000) });
  }

  const offsets = matches.map((m) => m.offsetMs);
  const avg = mean(offsets);
  const beats = [...new Set(targets.map((t) => t.beat))];
  return {
    matches,
    missed,
    extra: sorted.filter((_, i) => !used.has(i)),
    hitRate: targets.length ? matches.length / targets.length : 0,
    meanMs: avg === null ? null : Math.round(avg),
    spreadMs: avg === null ? null : Math.round(Math.sqrt(mean(offsets.map((o) => (o - avg) ** 2))!)),
    perBeat: beats.map((beat) => {
      const mine = matches.filter((m) => m.beat === beat).map((m) => m.offsetMs);
      const m = mean(mine);
      return { beat, hits: mine.length, total: targets.filter((t) => t.beat === beat).length, meanMs: m === null ? null : Math.round(m) };
    }),
  };
}

export const JUST_MS = 25;

/** "Justo", "40 ms adelantado" or "40 ms tarde". */
export function describeOffset(ms: number): string {
  if (Math.abs(ms) < JUST_MS) return "justo";
  return `${Math.abs(ms)} ms ${ms < 0 ? "adelantado" : "tarde"}`;
}

/** The sentence shown for a beat: "Vas adelantado 40 ms en el 8". */
export function beatAdvice(beat: number, meanMs: number | null): string {
  if (meanMs === null) return `No palmeaste el ${beat}`;
  if (Math.abs(meanMs) < JUST_MS) return `Vas justo en el ${beat}`;
  return `Vas ${meanMs < 0 ? "adelantado" : "retrasado"} ${Math.abs(meanMs)} ms en el ${beat}`;
}

/** Nearest accent to a tap, for the instant feedback while playing. */
export function nearestTarget(tap: number, targets: Target[], windowS: number): { target: Target; offsetMs: number } | null {
  let best: Target | null = null;
  for (const t of targets) if (Math.abs(t.time - tap) <= windowS && (!best || Math.abs(t.time - tap) < Math.abs(best.time - tap))) best = t;
  return best ? { target: best, offsetMs: Math.round((tap - best.time) * 1000) } : null;
}
