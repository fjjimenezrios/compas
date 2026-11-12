import { useState, type RefObject } from "react";
import { SECTION_LABELS, type Section } from "../api";
import { mmss, type Loop, type PlayerApi } from "./PlayerBar";

type Props = {
  sections: Section[];
  loop: Loop | null;
  onLoop: (loop: Loop | null) => void;
  player: RefObject<PlayerApi | null>;
};

export function SectionsPanel({ sections, loop, onLoop, player }: Props) {
  const [draft, setDraft] = useState<number | null>(null);
  const [hint, setHint] = useState<string | null>(null);

  const startLoop = (next: Loop) => {
    onLoop(next);
    player.current?.seek(next.start);
    void player.current?.play();
  };

  const markEnd = () => {
    const now = player.current?.getTime() ?? 0;
    if (draft === null) return setHint("Marca primero el inicio del bucle.");
    if (now - draft < 0.5) return setHint("El final tiene que ir después del inicio.");
    setHint(null);
    startLoop({ start: draft, end: now, label: "Bucle A–B" });
    setDraft(null);
  };

  return (
    <section className="panel sections" aria-label="Secciones y bucle">
      <div className="section-head">
        <div>
          <span className="eyebrow">Secciones y bucle</span>
          <h2>Repite lo que quieras</h2>
        </div>
        {loop && <button className="chip accent" onClick={() => onLoop(null)}>Quitar el bucle</button>}
      </div>

      {sections.length > 0 ? (
        <ul className="section-list">
          {sections.map((s, i) => {
            const on = loop?.start === s.start && loop?.end === s.end;
            return (
              <li key={i} className={on ? "sec-item on" : "sec-item"}>
                <span className={`dot ${s.kind}`} aria-hidden="true" />
                <span className="section-name">
                  <b>{SECTION_LABELS[s.kind]}</b>
                  <small className="mono muted">{mmss(s.start)} – {mmss(s.end)} · {Math.round(s.end - s.start)} s</small>
                </span>
                <span className="row-actions">
                  <button className="chip" onClick={() => player.current?.seek(s.start)} aria-label={`Ir a ${SECTION_LABELS[s.kind]} en ${mmss(s.start)}`}>Ir</button>
                  <button
                    className="chip"
                    aria-pressed={on}
                    onClick={() => (on ? onLoop(null) : startLoop({ start: s.start, end: s.end, label: SECTION_LABELS[s.kind] }))}
                  >
                    ↻ Bucle
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="muted">Esta canción no tiene secciones detectadas. Puedes marcar un bucle a mano.</p>
      )}

      <div className="loop-free">
        <span className="eyebrow">Bucle libre</span>
        <div className="loop-buttons">
          <button className="chip" onClick={() => { setDraft(player.current?.getTime() ?? 0); setHint(null); }}>
            Inicio aquí{draft !== null && <b className="mono"> · {mmss(draft)}</b>}
          </button>
          <button className="chip" onClick={markEnd}>Fin aquí</button>
        </div>
        {hint && <p className="muted" role="status">{hint}</p>}
      </div>
    </section>
  );
}
