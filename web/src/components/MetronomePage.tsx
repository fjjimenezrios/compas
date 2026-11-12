import { useEffect, useState } from "react";
import { fetchPalos, type Palo } from "../api";
import type { Ramp, SoundSet } from "../rhythm";
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

const SOUNDS: { id: keyof SoundSet; label: string; hint: string }[] = [
  { id: "palmas", label: "Palmas", hint: "fuertes en los acentos, sordas en los tiempos flojos" },
  { id: "cajon", label: "Cajón", hint: "grave, agudo y notas fantasma" },
  { id: "click", label: "Clic", hint: "el pitido de siempre" },
];
const REMATE_EVERY = [2, 4, 8];
const RAMP_STEPS = [2, 5, 10];
const RAMP_EVERY = [2, 4, 8];

function MetronomeBody({ palo, palos }: { palo: Palo; palos: Palo[] }) {
  const forms = palo.forms!;
  const [formId, setFormId] = useState(forms[0].id);
  const [startOverride, setStartOverride] = useState<number | null>(null);
  const [bpm, setBpm] = useState(() => startingTempo(palo.tempo_bpm, palo.default_bpm));
  const [active, setActive] = useState(false);
  const [sounds, setSounds] = useState<SoundSet>({ click: false, palmas: true, cajon: true });
  const [recorded, setRecorded] = useState(true);
  const [remateEvery, setRemateEvery] = useState(0);
  const [rampOn, setRampOn] = useState(false);
  const [rampStep, setRampStep] = useState(5);
  const [rampEvery, setRampEvery] = useState(4);

  const form = forms.find((f) => f.id === formId)!;
  const cycleLen = form.cycle_len ?? palo.cycle_len ?? 4;
  const countStart = startOverride ?? form.count_start;
  const [lo, hi] = tempoBounds(palo.tempo_bpm);
  const ramp: Ramp | null = rampOn ? { step: rampStep, everyCycles: rampEvery, max: hi } : null;

  // At least one sound must stay on, or the metronome would run in silence.
  const toggleSound = (id: keyof SoundSet) => {
    const next = { ...sounds, [id]: !sounds[id] };
    if (Object.values(next).some(Boolean)) setSounds(next);
  };

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
          <MetronomeWheel
            cycleLen={cycleLen}
            form={form}
            countStart={countStart}
            bpm={bpm}
            active={active}
            sounds={sounds}
            cajon={palo.cajon}
            remate={palo.remate}
            remateEvery={remateEvery}
            ramp={ramp}
            recorded={recorded}
          />
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

          <div className="panel">
            <span className="eyebrow">Sonido</span>
            <div className="sound-set" role="group" aria-label="Sonido">
              {SOUNDS.map((s) => (
                <label key={s.id} className={sounds[s.id] ? "sound-opt on" : "sound-opt"}>
                  <input type="checkbox" checked={sounds[s.id]} onChange={() => toggleSound(s.id)} />
                  <span><b>{s.label}</b><small className="muted">{s.hint}</small></span>
                </label>
              ))}
            </div>
            <label className="check-row recorded-row">
              <input type="checkbox" checked={recorded} onChange={(e) => setRecorded(e.target.checked)} />
              <span><b>Grabaciones reales</b><small className="muted"> Desmárcalo para oír los sonidos sintetizados.</small></span>
            </label>
          </div>

          <div className="panel practice">
            <span className="eyebrow">Práctica</span>
            <div className="practice-row">
              <label className="pick">
                <span>Remate</span>
                <select
                  id="remate"
                  value={remateEvery}
                  disabled={!palo.remate}
                  onChange={(e) => setRemateEvery(Number(e.target.value))}
                >
                  <option value={0}>Sin remate</option>
                  {REMATE_EVERY.map((n) => <option key={n} value={n}>Cada {n} compases</option>)}
                </select>
              </label>
              {palo.remate ? (
                <p className="muted">Golpes A-A-G en los tiempos {palo.remate.beats.join(", ")}, como cierre.</p>
              ) : (
                <p className="muted">Este palo aún no tiene un remate documentado en las guías.</p>
              )}
            </div>
            <div className="practice-row">
              <label className="check-row">
                <input type="checkbox" checked={rampOn} onChange={(e) => setRampOn(e.target.checked)} />
                <span><b>Subir el tempo poco a poco</b></span>
              </label>
              {rampOn && (
                <div className="ramp-fields">
                  <label className="pick">
                    <span>Sube</span>
                    <select id="ramp-step" value={rampStep} onChange={(e) => setRampStep(Number(e.target.value))}>
                      {RAMP_STEPS.map((n) => <option key={n} value={n}>{n} BPM</option>)}
                    </select>
                  </label>
                  <label className="pick">
                    <span>Cada</span>
                    <select id="ramp-every" value={rampEvery} onChange={(e) => setRampEvery(Number(e.target.value))}>
                      {RAMP_EVERY.map((n) => <option key={n} value={n}>{n} compases</option>)}
                    </select>
                  </label>
                  <p className="muted">Hasta {hi} BPM. Si mueves el tempo, la subida vuelve a empezar desde ahí.</p>
                </div>
              )}
            </div>
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
