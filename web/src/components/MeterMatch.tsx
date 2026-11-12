import type { Palo } from "../api";
import type { MeterMatchResult } from "../pattern";

type Props = {
  matches: MeterMatchResult[];
  tempo: number;
  declaredPalo: string;
  palos: Palo[];
  layerLabel: string;
  selected: string;
  onSelect: (match: MeterMatchResult) => void;
};

const fmt = (v: number) => v.toFixed(2).replace(".", ",");

export function MeterMatch({ matches, tempo, declaredPalo, palos, layerLabel, selected, onSelect }: Props) {
  if (!matches.length) return null;
  const best = matches[0];
  const declared = palos.find((p) => p.id === declaredPalo);
  const inTempo = (p: Palo) => !p.tempo_bpm || (tempo >= p.tempo_bpm[0] && tempo <= p.tempo_bpm[1]);
  const family = palos.filter((p) => p.family === best.family.family);

  return (
    <section className="panel">
      <div className="section-head">
        <div>
          <span className="eyebrow">¿A qué se parece? · {layerLabel}</span>
          <h2>{best.family.label}</h2>
        </div>
        <span className="chip accent">más parecido {fmt(best.corr)}</span>
      </div>
      <ul className="matches">
        {matches.map((m, i) => (
          <li key={m.family.id}>
            <button
              className="match-row"
              aria-pressed={selected === m.family.id}
              onClick={() => onSelect(m)}
              title="Ver estos acentos en la rueda"
            >
              <span>{m.family.label}</span>
              <span className="bar"><i style={{ width: `${Math.max(0, m.corr) * 100}%`, background: i ? "var(--muted)" : "var(--accent)" }} /></span>
              <span className="mono">{fmt(m.corr)}</span>
            </button>
          </li>
        ))}
      </ul>
      <p className="note muted">Pulsa una fila para ver esos acentos en la rueda.</p>
      {family.length > 0 && (
        <p className="note">
          Palos de esa familia:{" "}
          {family.map((p, i) => (
            <span key={p.id}>
              {i > 0 && " · "}
              <b>{p.name}</b>
              <span className="muted">
                {p.status === "TODO" ? " (plantilla sin verificar)" : inTempo(p) ? " (tempo encaja)" : " (tempo fuera de rango)"}
              </span>
            </span>
          ))}
        </p>
      )}
      {declared && declared.family !== best.family.family && (
        <p className="note muted">
          La canción está marcada como {declared.name}, pero en esta capa los golpes se parecen más a «{best.family.label}».
          Mira otras capas: a veces las palmas marcan de una manera y la guitarra de otra.
        </p>
      )}
    </section>
  );
}
