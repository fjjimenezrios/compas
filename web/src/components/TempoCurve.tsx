import type { Cycle } from "../api";

const W = 640;
const H = 170;
const PAD = { l: 44, r: 12, t: 12, b: 26 };

export function TempoCurve({ cycles }: { cycles: Cycle[] }) {
  const full = cycles.filter((c) => !c.partial);
  if (full.length < 2) return <p className="muted">No hay compases suficientes para dibujar el tempo.</p>;
  const tempos = full.map((c) => c.tempo_bpm);
  const lo = Math.floor((Math.min(...tempos) - 4) / 5) * 5;
  const hi = Math.ceil((Math.max(...tempos) + 4) / 5) * 5;
  const x = (i: number) => PAD.l + (i / (full.length - 1)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * (H - PAD.t - PAD.b);
  const ticks = Array.from({ length: Math.floor((hi - lo) / 5) + 1 }, (_, i) => lo + i * 5).filter(
    (_, i, all) => all.length <= 6 || i % 2 === 0,
  );
  const points = full.map((c, i) => `${x(i)},${y(c.tempo_bpm)}`).join(" ");
  const step = x(1) - x(0);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Tempo por compás">
      <defs>
        <pattern id="rayas" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="2" height="6" fill="var(--line)" />
        </pattern>
      </defs>
      {full.map((c, i) =>
        c.low_confidence ? (
          <rect key={c.index} x={x(i) - step / 2} y={PAD.t} width={step} height={H - PAD.t - PAD.b} fill="url(#rayas)" />
        ) : null,
      )}
      {ticks.map((v) => (
        <g key={v}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="var(--line)" />
          <text x={PAD.l - 8} y={y(v) + 4} textAnchor="end" fontSize={11} style={{ fill: "var(--muted)" }}>
            {v}
          </text>
        </g>
      ))}
      <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth={2.2} strokeLinejoin="round" />
      <circle cx={x(full.length - 1)} cy={y(tempos[tempos.length - 1])} r={3.5} fill="var(--accent)" />
      <text x={(W + PAD.l) / 2} y={H - 6} textAnchor="middle" fontSize={11} style={{ fill: "var(--muted)" }}>
        compás 1 → {full.length}
      </text>
    </svg>
  );
}
