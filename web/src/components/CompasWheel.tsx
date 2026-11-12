type Props = {
  order: number[];
  accents: number[] | null;
  weak?: number[];
  strength: Record<number, number>;
  center: string;
  caption: string;
  current?: number | null;
  pulse?: number;
};

const SIZE = 320;
const C = SIZE / 2;
const R = 118;

export function CompasWheel({ order, accents, weak = [], strength, center, caption, current = null, pulse = 0 }: Props) {
  const max = Math.max(...Object.values(strength), 0.0001);
  return (
    <svg viewBox={`0 0 ${SIZE} ${SIZE}`} width="100%" role="img" aria-label={`Rueda de compás: ${caption}`}>
      <circle cx={C} cy={C} r={R} fill="none" stroke="var(--line)" strokeWidth={1.5} />
      {order.map((beat, k) => {
        const a = (k / order.length) * 2 * Math.PI - Math.PI / 2;
        const x = C + R * Math.cos(a);
        const y = C + R * Math.sin(a);
        const isAccent = accents?.includes(beat) ?? false;
        const isWeak = !isAccent && weak.includes(beat);
        const s = (strength[beat] ?? 0) / max;
        const r = 5 + 15 * s;
        return (
          <g key={beat}>
            {beat === current && (
              <circle key={pulse} className="beat-flash" cx={x} cy={y} r={24} fill="none" stroke="var(--albero)" strokeWidth={4} />
            )}
            {isAccent ? (
              <circle cx={x} cy={y} r={r} fill="var(--accent)" />
            ) : (
              <circle cx={x} cy={y} r={r} fill="none" stroke={isWeak ? "var(--albero)" : "var(--muted)"} strokeWidth={isWeak ? 3.5 : 2} />
            )}
            <text
              x={C + (R + 30) * Math.cos(a)}
              y={C + (R + 30) * Math.sin(a) + 5}
              textAnchor="middle"
              fontSize={15}
              fontWeight={isAccent ? 700 : 400}
              style={{ fill: isAccent ? "var(--accent)" : isWeak ? "var(--albero)" : "var(--muted)" }}
            >
              {beat}
            </text>
          </g>
        );
      })}
      {current === null ? (
        <text x={C} y={C + 14} textAnchor="middle" fontSize={44} style={{ fontFamily: "var(--display)", fontWeight: 800 }}>
          {center}
        </text>
      ) : (
        <text
          x={C}
          y={C + 28}
          textAnchor="middle"
          fontSize={84}
          style={{
            fontFamily: "var(--display)",
            fontWeight: 800,
            fill: accents?.includes(current) ? "var(--accent)" : "var(--fg)",
          }}
        >
          {current}
        </text>
      )}
      <text x={C} y={current === null ? C + 36 : C + 52} textAnchor="middle" fontSize={11} style={{ fill: "var(--muted)", letterSpacing: "0.12em" }}>
        {caption}
      </text>
    </svg>
  );
}
