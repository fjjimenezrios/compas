import type { Barre, DiagramString } from "../chords";

type Props = {
  strings: DiagramString[];
  barre?: Barre | null;
  compact?: boolean;
  title: string;
};

const X0 = 30;
const DX = 17;
const Y0 = 28;
const DY = 21;
const ROWS = 5;
const sx = (i: number) => X0 + i * DX;

function startFret(strings: DiagramString[], barre?: Barre | null): number {
  if (barre) return barre.fret;
  const frets = strings.flatMap((s) => (s.fret ? [s.fret] : []));
  if (!frets.length || Math.max(...frets) <= ROWS) return 1;
  return Math.min(...frets);
}

export function ChordDiagram({ strings, barre, compact = false, title }: Props) {
  const start = startFret(strings, barre);
  const rowY = (fret: number) => Y0 + (fret - start) * DY + DY / 2;
  const covered = (i: number, fret: number) => !!barre && i >= barre.from && i <= barre.to && fret === barre.fret;
  const bottom = Y0 + ROWS * DY;

  return (
    <svg className={compact ? "diagram compact" : "diagram"} viewBox="0 0 145 150" role="img" aria-label={title}>
      {Array.from({ length: ROWS + 1 }, (_, r) => (
        <line
          key={r}
          x1={X0}
          x2={sx(5)}
          y1={Y0 + r * DY}
          y2={Y0 + r * DY}
          stroke={r === 0 && start === 1 ? "var(--fg)" : "var(--muted)"}
          strokeWidth={r === 0 && start === 1 ? 4 : 1}
          opacity={r === 0 && start === 1 ? 1 : 0.55}
        />
      ))}
      {strings.map((_, i) => (
        <line key={i} x1={sx(i)} x2={sx(i)} y1={Y0} y2={bottom} stroke="var(--muted)" strokeWidth={1} opacity={0.7} />
      ))}
      {start > 1 && (
        <text x={12} y={Y0 + DY / 2 + 4} fontSize={11} textAnchor="middle" style={{ fill: "var(--muted)" }}>
          {start}
        </text>
      )}

      {barre && (
        <rect
          x={sx(barre.from) - 8}
          y={rowY(barre.fret) - 7.5}
          width={sx(barre.to) - sx(barre.from) + 16}
          height={15}
          rx={7.5}
          fill="var(--fg)"
        />
      )}

      {strings.map((s, i) => {
        if (s.fret === null) {
          return <text key={i} x={sx(i)} y={17} fontSize={12} textAnchor="middle" style={{ fill: "var(--muted)" }}>×</text>;
        }
        if (s.fret === 0) {
          return <circle key={i} cx={sx(i)} cy={14} r={4.5} fill="none" stroke={s.root ? "var(--accent)" : "var(--muted)"} strokeWidth={s.root ? 2.4 : 1.6} />;
        }
        const label = !compact && s.label;
        const isBarreEnd = barre && i === barre.from && covered(i, s.fret);
        if (covered(i, s.fret) && !isBarreEnd) return null;
        const cx = sx(i);
        const cy = rowY(s.fret);
        return (
          <g key={i}>
            {(!covered(i, s.fret) || s.root) && (
              <circle cx={cx} cy={cy} r={7.5} fill={s.root ? "var(--accent)" : "var(--fg)"} />
            )}
            {label && (
              <text x={cx} y={cy + 3} fontSize={label.length > 2 ? 6.5 : 8} fontWeight={700} textAnchor="middle" style={{ fill: s.root ? "var(--on-accent)" : "var(--bg)" }}>
                {label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
