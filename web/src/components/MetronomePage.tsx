import { useEffect, useState } from "react";
import { fetchPalos, type Palo } from "../api";
import { MetronomeWheel } from "./MetronomeWheel";
import { startingTempo, TempoControl, tempoBounds } from "./TempoControl";

export function MetronomePage({ paloId }: { paloId?: string }) {
  const [palos, setPalos] = useState<Palo[] | null>(null);
  useEffect(() => {
    fetchPalos().then((all) => setPalos(all.filter((p) => p.forms?.length)), () => setPalos([]));
  }, []);
  if (!palos) return null;
  const palo = palos.find((p) => p.id === paloId) ?? palos[0];
  if (!palo) return <p className="muted">No hay palos con formas de acentuación todavía.</p>;
  return <MetronomeBody key={palo.id} palo={palo} palos={palos} />;
}

function MetronomeBody({ palo, palos }: { palo: Palo; palos: Palo[] }) {
  const forms = palo.forms!;
  const [formId, setFormId] = useState(forms[0].id);
  const [startOverride, setStartOverride] = useState<number | null>(null);
  const [bpm, setBpm] = useState(() => startingTempo(palo.tempo_bpm, palo.default_bpm));
  const [active, setActive] = useState(false);

  const form = forms.find((f) => f.id === formId)!;
  const cycleLen = form.cycle_len ?? palo.cycle_len ?? 4;
  const countStart = startOverride ?? form.count_start;
  const [lo, hi] = tempoBounds(palo.tempo_bpm);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (e.code !== "Space" || ["INPUT", "SELECT", "BUTTON", "TEXTAREA"].includes(tag)) return;
      e.preventDefault();
      setActive((a) => !a);
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, []);

  return (
    <section className="metro">
      <header className="page-head">
        <h1>Metrónomo</h1>
        <p className="muted">Cada palo, con sus acentos. Pulsa espacio para empezar y parar.</p>
      </header>

      <span className="eyebrow">Palo</span>
      <div className="chips" role="group" aria-label="Palo">
        {palos.map((p) => (
          <a key={p.id} className="chip" href={`#metronomo/${p.id}`} aria-pressed={p.id === palo.id}>
            {p.name}
          </a>
        ))}
      </div>

      <div className="metro-body">
        <div className="panel metro-wheel">
          <MetronomeWheel cycleLen={cycleLen} form={form} countStart={countStart} bpm={bpm} active={active} />
        </div>

        <div className="metro-controls">
          <div className="panel">
            <span className="eyebrow">Forma de acentuación</span>
            <div className="chips" role="group" aria-label="Forma">
              {forms.map((f) => (
                <button
                  key={f.id}
                  className="chip"
                  aria-pressed={f.id === form.id}
                  onClick={() => {
                    setFormId(f.id);
                    setStartOverride(null);
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <p>{form.explain}</p>
          </div>

          <div className="panel">
            <span className="eyebrow">Tempo</span>
            <TempoControl bpm={bpm} min={lo} max={hi} onChange={setBpm} />
            {cycleLen > 1 && (
              <div className="seg" role="group" aria-label="Contar desde">
                <span className="eyebrow">Contar desde</span>
                {[...new Set([form.count_start, cycleLen, 1])].map((n) => (
                  <button key={n} className="chip" aria-pressed={countStart === n} onClick={() => setStartOverride(n)}>
                    {n}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button className={active ? "play-big on" : "play-big"} onClick={() => setActive(!active)} aria-pressed={active}>
            {active ? "Parar" : "Empezar"}
          </button>
          <a className="back eyebrow" href={`#doc/${palo.id}`}>Ver la documentación de {palo.name} →</a>
        </div>
      </div>
    </section>
  );
}
