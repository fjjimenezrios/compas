type Props = {
  order: number[];
  accents: number[] | null;
  pattern: number[][];
};

const H = 180;
const TOP = 12;
const BASE = H - 34;
const COL = 52;

export function PatternBars({ order, accents, pattern }: Props) {
  const max = Math.max(...pattern.flat(), 0.0001);
  const subs = pattern[0]?.length ?? 1;
  const barW = (COL - 14) / subs;
  const width = order.length * COL;
  return (
    <div style={{ overflowX: "auto" }}>
      <svg viewBox={`0 0 ${width} ${H}`} width="100%" style={{ minWidth: 520 }} role="img" aria-label="Patrón medio por tiempo">
        {order.map((beat, k) => {
          const x0 = k * COL + 7;
          const isAccent = accents?.includes(beat) ?? false;
          return (
            <g key={beat}>
              {isAccent && <rect x={k * COL + 2} y={TOP - 6} width={COL - 4} height={BASE - TOP + 6} rx={6} fill="var(--accent-soft)" />}
              {pattern[beat - 1].map((v, sub) => {
                const h = ((BASE - TOP) * v) / max;
                return (
                  <rect
                    key={sub}
                    x={x0 + sub * barW}
                    y={BASE - h}
                    width={barW - 3}
                    height={Math.max(h, 1)}
                    rx={2}
                    fill={sub === 0 ? (isAccent ? "var(--accent)" : "var(--fg)") : "var(--albero)"}
                  />
                );
              })}
              <text
                x={k * COL + COL / 2}
                y={H - 10}
                textAnchor="middle"
                fontSize={14}
                fontWeight={isAccent ? 700 : 400}
                style={{ fill: isAccent ? "var(--accent)" : "var(--muted)" }}
              >
                {beat}
              </text>
            </g>
          );
        })}
        <line x1={0} x2={width} y1={BASE + 0.5} y2={BASE + 0.5} stroke="var(--line)" />
      </svg>
    </div>
  );
}
