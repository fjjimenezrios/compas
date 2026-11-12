import type { Onset } from "./api";

export const LAYER_NAMES: Record<string, string> = {
  drums: "Palmas y percusión",
  vocals: "Cante",
  guitar: "Guitarra",
  bass: "Bajo",
  other: "Resto",
  original: "Mezcla original",
};

export const layerName = (id: string) =>
  LAYER_NAMES[id] ?? id.charAt(0).toUpperCase() + id.slice(1);

export const displayOrder = (cycleLen: number, countStart: number) =>
  Array.from({ length: cycleLen }, (_, k) => ((countStart - 1 + k) % cycleLen) + 1);

/**
 * pattern[beat - 1][sub] = how hard the layer hits there on average. Each bar counts once, with its
 * strongest hit: summing every detected attack would let a busy beat look stronger than an accented one.
 */
export function averagePattern(
  onsets: Onset[],
  cycleLen: number,
  subdivision: number,
  cycleCount: number,
): number[][] {
  const pattern = Array.from({ length: cycleLen }, () => new Array(subdivision).fill(0));
  if (!cycleCount) return pattern;
  const strongest = new Map<string, number>();
  for (const o of onsets) {
    if (o.beat === null || o.cycle === null) continue;
    const key = `${o.cycle}:${o.beat}:${o.sub}`;
    strongest.set(key, Math.max(strongest.get(key) ?? 0, o.strength));
  }
  for (const [key, strength] of strongest) {
    const [, beat, sub] = key.split(":").map(Number);
    pattern[beat - 1][sub] += strength / cycleCount;
  }
  return pattern;
}

export function correlation(a: number[], b: number[]): number | null {
  const n = a.length;
  const mean = (x: number[]) => x.reduce((s, v) => s + v, 0) / n;
  const ma = mean(a);
  const mb = mean(b);
  let cov = 0;
  let va = 0;
  let vb = 0;
  for (let i = 0; i < n; i++) {
    cov += (a[i] - ma) * (b[i] - mb);
    va += (a[i] - ma) ** 2;
    vb += (b[i] - mb) ** 2;
  }
  return va && vb ? cov / Math.sqrt(va * vb) : null;
}

export type MeterFamily = { id: string; label: string; family: string; accents: (n: number) => number[] };

// Generic accent families; `family` matches the field of the same name in palos/*.json.
export const METER_FAMILIES: MeterFamily[] = [
  { id: "doce", label: "12 tiempos (3·6·8·10·12)", family: "12 tiempos", accents: (n) => (n === 12 ? [3, 6, 8, 10, 12] : []) },
  { id: "ternario", label: "Ternario (golpe cada 3)", family: "ternario", accents: (n) => everyK(n, 3) },
  { id: "binario", label: "Binario (golpe cada 2)", family: "binario", accents: (n) => everyK(n, 2) },
  { id: "cuaternario", label: "Binario (golpe cada 4)", family: "binario", accents: (n) => everyK(n, 4) },
];

function everyK(n: number, k: number): number[] {
  return n % k ? [] : Array.from({ length: n / k }, (_, i) => (i + 1) * k);
}

/** Beat numbers (1..n) that carry the family's accents when its pattern is rotated by `rotation`. */
export function accentBeats(family: MeterFamily, n: number, rotation: number): number[] {
  const accents = family.accents(n);
  const r = ((rotation % n) + n) % n;
  return Array.from({ length: n }, (_, i) => i + 1).filter((b) => accents.includes(((b - 1 + r) % n) + 1));
}

export type MeterMatchResult = { family: MeterFamily; corr: number; rotation: number };

/** Best correlation over every rotation, so the result doesn't depend on where the count starts. */
export function meterMatches(onBeat: number[]): MeterMatchResult[] {
  const n = onBeat.length;
  return METER_FAMILIES.flatMap((family) => {
    if (!family.accents(n).length) return [];
    let best = { family, corr: -1, rotation: 0 };
    for (let r = 0; r < n; r++) {
      const accented = accentBeats(family, n, r);
      const corr = correlation(onBeat, onBeat.map((_, i) => (accented.includes(i + 1) ? 1 : 0))) ?? -1;
      if (corr > best.corr) best = { family, corr, rotation: r };
    }
    return [best];
  }).sort((a, b) => b.corr - a.corr);
}

export function templateCorrelation(pattern: number[][], accents: number[] | null): number | null {
  if (!accents) return null;
  const onBeat = pattern.map((subs) => subs[0]);
  const template = onBeat.map((_, i) => (accents.includes(i + 1) ? 1 : 0));
  return correlation(onBeat, template);
}

export function shiftAccents(accents: number[], n: number, shift: number): number[] {
  return accents.map((a) => ((((a - 1 + shift) % n) + n) % n) + 1).sort((x, y) => x - y);
}
