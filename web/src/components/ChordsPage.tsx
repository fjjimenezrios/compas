import { useEffect, useRef, useState, type ReactNode } from "react";
import { strum, strumSequence } from "../chordAudio";
import {
  bestVoicing, CHORD_TYPES, chordName, chordNotes, describeFlamenco, describeVoicing, FLAMENCO, FLAMENCO_MODE,
  formula, keyChords, lowestBarre, prettyNote, ROOT_CHIPS, rootName, shapeVoicing, typeInfo, voicings,
  type ChordRef, type ChordType, type Frets, type LabelMode, type Voicing,
} from "../chords";
import { ChordDiagram } from "./ChordDiagram";

const TABS = [
  { id: "biblioteca", href: "#acordes", label: "Biblioteca" },
  { id: "cejilla", href: "#acordes/cejilla", label: "Cejilla" },
  { id: "flamencos", href: "#acordes/flamencos", label: "Flamencos" },
];

const MODES: { id: LabelMode; label: string }[] = [
  { id: "intervals", label: "Intervalos" },
  { id: "notes", label: "Notas" },
  { id: "none", label: "Nada" },
];

const STEP_MS = 1100;

type Labels = { mode: LabelMode; setMode: (m: LabelMode) => void };

export function ChordsPage({ tab }: { tab?: string }) {
  const [pc, setPc] = useState(0);
  const [type, setType] = useState<ChordType>("major");
  const [mode, setMode] = useState<LabelMode>("intervals");
  const active = tab === "cejilla" || tab === "flamencos" ? tab : "biblioteca";
  const pick = (nextPc: number, nextType: ChordType) => {
    setPc(nextPc);
    setType(nextType);
    location.hash = "acordes";
  };

  return (
    <section>
      <header className="page-head">
        <h1>Acordes</h1>
        <p className="muted">Toca un acorde para verlo, escucharlo y moverlo por el mástil.</p>
      </header>

      <nav className="subtabs" aria-label="Acordes">
        {TABS.map((t) => (
          <a key={t.id} href={t.href} aria-current={active === t.id ? "page" : undefined}>{t.label}</a>
        ))}
      </nav>

      {active === "biblioteca" && <Library pc={pc} type={type} mode={mode} setMode={setMode} setPc={setPc} setType={setType} />}
      {active === "cejilla" && <Cejilla type={type} setType={setType} mode={mode} setMode={setMode} onPick={pick} />}
      {active === "flamencos" && <Flamencos mode={mode} setMode={setMode} />}
    </section>
  );
}

// ---- Small building blocks, each row of choices looks different on purpose. -----------------

function PickerRow({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div className="picker-row">
      <span className="picker-label"><b>{n}</b>{title}</span>
      {children}
    </div>
  );
}

function NoteGrid({ value, onChange, label }: { value: number; onChange: (pc: number) => void; label: string }) {
  return (
    <div className="note-grid" role="group" aria-label={label}>
      {ROOT_CHIPS.map((r) => (
        <button key={r.pc} className="note-btn" aria-pressed={r.pc === value} onClick={() => onChange(r.pc)}>
          <b>{r.main}</b>
          <small>{r.alt ?? " "}</small>
        </button>
      ))}
    </div>
  );
}

/** With a root, each button shows the real chord (Cm, C7…); without one, just the type's symbol. */
function TypeGrid({ type, setType, rootPc }: { type: ChordType; setType: (t: ChordType) => void; rootPc?: number }) {
  return (
    <div className="type-grid" role="group" aria-label="Tipo de acorde">
      {CHORD_TYPES.map((t) => (
        <button key={t.id} className="type-btn" aria-pressed={t.id === type} onClick={() => setType(t.id)}>
          <b>{rootPc === undefined ? t.symbol || "M" : chordName(rootPc, t.id)}</b>
          <small>{t.name}</small>
        </button>
      ))}
    </div>
  );
}

function LabelToggle({ mode, setMode }: Labels) {
  return (
    <div className="seg" role="group" aria-label="Etiquetas de los puntos">
      <span className="eyebrow">Etiquetas de los puntos</span>
      {MODES.map((m) => (
        <button key={m.id} className="chip" aria-pressed={mode === m.id} onClick={() => setMode(m.id)}>{m.label}</button>
      ))}
    </div>
  );
}

function PlayButton({ frets, label = "Oír" }: { frets: Frets; label?: string }) {
  return (
    <button className="chip accent play-chip" onClick={() => strum(frets)} aria-label={`${label} el acorde`}>
      ▶ {label}
    </button>
  );
}

function VoicingCard({ v, pc, type, mode }: { v: Voicing; pc: number; type: ChordType; mode: LabelMode }) {
  return (
    <article className="panel voicing-card">
      <ChordDiagram strings={describeVoicing(v.frets, pc, type, mode)} barre={v.barre} title={`${chordName(pc, type)}: ${v.label}`} />
      <h3>{v.label}</h3>
      <PlayButton frets={v.frets} />
    </article>
  );
}

// ---- Biblioteca. ------------------------------------------------------------------------------

function Library({ pc, type, mode, setMode, setPc, setType }: {
  pc: number; type: ChordType; mode: LabelMode; setMode: (m: LabelMode) => void;
  setPc: (n: number) => void; setType: (t: ChordType) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (["INPUT", "SELECT", "TEXTAREA"].includes((e.target as HTMLElement).tagName)) return;
      const types = CHORD_TYPES.map((c) => c.id);
      const at = types.indexOf(type);
      if (e.key === "ArrowRight") setPc((pc + 1) % 12);
      else if (e.key === "ArrowLeft") setPc((pc + 11) % 12);
      else if (e.key === "ArrowDown") setType(types[(at + 1) % types.length]);
      else if (e.key === "ArrowUp") setType(types[(at + types.length - 1) % types.length]);
      else return;
      e.preventDefault();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [pc, type, setPc, setType]);

  const info = typeInfo(type);

  return (
    <div className="chord-library">
      <div className="panel picker">
        <PickerRow n={1} title="Nota"><NoteGrid value={pc} onChange={setPc} label="Nota" /></PickerRow>
        <PickerRow n={2} title="Tipo"><TypeGrid type={type} setType={setType} rootPc={pc} /></PickerRow>
      </div>

      <div className="panel chord-hero">
        <button className="step" onClick={() => setPc((pc + 11) % 12)} aria-label={`Acorde anterior, ${chordName((pc + 11) % 12, type)}`}>
          ◀<small>{chordName((pc + 11) % 12, type)}</small>
        </button>
        <div className="hero-name">
          <h2>{chordName(pc, type)}</h2>
          <p className="muted">{info.name} · notas {chordNotes(pc, type).join(" · ")} · fórmula {formula(type)}</p>
          <PlayButton frets={bestVoicing(pc, type).frets} label="Oír el acorde" />
        </div>
        <button className="step" onClick={() => setPc((pc + 1) % 12)} aria-label={`Acorde siguiente, ${chordName((pc + 1) % 12, type)}`}>
          ▶<small>{chordName((pc + 1) % 12, type)}</small>
        </button>
      </div>
      <p className="muted keys-hint">Con el teclado: ← → cambian la nota, ↑ ↓ el tipo de acorde.</p>

      <div className="section-row">
        <h2 className="section-title">Cómo se toca</h2>
        <LabelToggle mode={mode} setMode={setMode} />
      </div>
      <div className="voicing-grid">
        {voicings(pc, type).map((v) => <VoicingCard key={v.id} v={v} pc={pc} type={type} mode={mode} />)}
      </div>

      <h2 className="section-title">Todos los acordes de {prettyNote(rootName(pc))}</h2>
      <div className="mini-grid">
        {CHORD_TYPES.map((t) => {
          const v = bestVoicing(pc, t.id);
          return (
            <button key={t.id} className="mini" aria-pressed={t.id === type} onClick={() => setType(t.id)}>
              <ChordDiagram compact strings={describeVoicing(v.frets, pc, t.id, "none")} barre={v.barre} title={chordName(pc, t.id)} />
              <span className="mono">{chordName(pc, t.id)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---- Cejilla. ---------------------------------------------------------------------------------

function Cejilla({ type, setType, mode, setMode, onPick }: {
  type: ChordType; setType: (t: ChordType) => void; mode: LabelMode; setMode: (m: LabelMode) => void;
  onPick: (pc: number, t: ChordType) => void;
}) {
  const [shape, setShape] = useState<"E" | "A">("E");
  const [fret, setFret] = useState(3);
  const [keyPc, setKeyPc] = useState(2);

  const basePc = shape === "E" ? 4 : 9;
  const pc = (basePc + fret) % 12;
  const v = shapeVoicing(shape, type, fret);
  const open = shapeVoicing(shape, type, 0);
  const string = shape === "E" ? 6 : 5;
  const shapeName = shape === "E" ? "Mi" : "La";
  const setClamped = (n: number) => setFret(Math.min(12, Math.max(0, n)));

  return (
    <div className="cejilla">
      <div className="panel">
        <h2>Un acorde abierto, movido por el mástil</h2>
        <p>
          Si pones la cejilla (el dedo índice, haciendo de cejuela) en un traste y repites la forma de un acorde abierto
          de <b>Mi</b> o de <b>La</b>, el acorde sube de nota sin cambiar de forma. El nombre lo da la nota de la
          cuerda más grave de la forma: la <b>6.ª</b> en la forma de Mi y la <b>5.ª</b> en la forma de La.
        </p>
      </div>

      <div className="panel picker">
        <PickerRow n={1} title="Forma">
          <div className="shape-seg" role="group" aria-label="Forma">
            <button aria-pressed={shape === "E"} onClick={() => setShape("E")}><b>Forma de Mi</b><small>nota de la cuerda 6</small></button>
            <button aria-pressed={shape === "A"} onClick={() => setShape("A")}><b>Forma de La</b><small>nota de la cuerda 5</small></button>
          </div>
        </PickerRow>
        <PickerRow n={2} title="Tipo"><TypeGrid type={type} setType={setType} /></PickerRow>
        <PickerRow n={3} title="Traste">
          <div className="fret-control">
            <button className="step-sm" onClick={() => setClamped(fret - 1)} aria-label="Un traste hacia atrás">◀</button>
            <input id="fret" type="range" min={0} max={12} value={fret} onChange={(e) => setClamped(Number(e.target.value))} aria-label="Traste de la cejilla" />
            <button className="step-sm" onClick={() => setClamped(fret + 1)} aria-label="Un traste hacia delante">▶</button>
            <span className="mono fret-value">{fret === 0 ? "al aire" : `traste ${fret}`}</span>
          </div>
        </PickerRow>
      </div>

      <div className="toolbar"><LabelToggle mode={mode} setMode={setMode} /></div>
      <div className="panel barre-demo">
        <div className="barre-pair">
          <figure>
            <ChordDiagram strings={describeVoicing(open.frets, basePc, type, mode)} title={`${chordName(basePc, type)} abierto`} />
            <figcaption>1. Forma de {shapeName} abierta: <b>{chordName(basePc, type)}</b></figcaption>
          </figure>
          <span className="arrow" aria-hidden="true">→</span>
          <figure>
            <ChordDiagram strings={describeVoicing(v.frets, pc, type, mode)} barre={v.barre} title={`${chordName(pc, type)} con cejilla en el traste ${fret}`} />
            <figcaption>2. Cejilla en el traste {fret}: <b>{chordName(pc, type)}</b></figcaption>
          </figure>
        </div>
        <div className="barre-text">
          <h3>{chordName(pc, type)} · forma de {shapeName}{fret ? ` · traste ${fret}` : ""}</h3>
          <ol>
            <li>Haz la forma de {shapeName} {typeInfo(type).symbol || "mayor"} abierta.</li>
            <li>
              {v.barre
                ? `Muévela ${fret} trastes y estira el índice sobre todas las cuerdas del traste ${fret}: es la cejilla.`
                : fret
                  ? `Muévela ${fret} trastes. Este acorde se hace con los dedos sueltos, sin cejilla.`
                  : "Con el traste 0 no hace falta cejilla: es el acorde abierto."}
            </li>
            <li>
              La nota de la cuerda {string} en el traste {fret} es <b>{prettyNote(rootName(pc, type))}</b>. Ese es el nombre del acorde.
            </li>
          </ol>
          <PlayButton frets={v.frets} />
        </div>
      </div>

      <h3 className="mini-title">Nota de la cuerda {string}, traste a traste</h3>
      <div className="fret-notes">
        {Array.from({ length: 13 }, (_, f) => (
          <button key={f} className="fret-note" aria-pressed={f === fret} onClick={() => setFret(f)}>
            <span className="mono muted">{f}</span>
            <b>{prettyNote(rootName((basePc + f) % 12, type))}</b>
          </button>
        ))}
      </div>

      <h2 className="section-title">Los acordes de una tonalidad</h2>
      <div className="panel picker">
        <PickerRow n={1} title="Tonalidad"><NoteGrid value={keyPc} onChange={setKeyPc} label="Tonalidad" /></PickerRow>
      </div>
      <p className="mono key-notes">
        Notas: {keyChords(keyPc).map((c) => c.name.replace(/m$|dim$/, "")).join(" · ")}
      </p>
      <p className="muted">Los siete acordes de la tonalidad con cejilla. Toca uno para abrirlo en la biblioteca.</p>
      <div className="mini-grid keys">
        {keyChords(keyPc).map((c) => {
          const b = lowestBarre(c.pc, c.type);
          return (
            <button key={c.numeral} className="mini" onClick={() => onPick(c.pc, c.type)}>
              <span className="numeral">{c.numeral}</span>
              <ChordDiagram compact strings={describeVoicing(b.frets, c.pc, c.type, "none")} barre={b.barre} title={`${c.name}, cejilla en el traste ${b.position}`} />
              <span className="mono">{c.name}</span>
              <small className="muted">traste {b.position}</small>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---- Flamencos. -------------------------------------------------------------------------------

function Progression({ label, chords }: { label: string; chords: ChordRef[] }) {
  const [now, setNow] = useState<number | null>(null);
  const stop = useRef<(() => void) | null>(null);
  useEffect(() => () => stop.current?.(), []);

  const voices = chords.map((c) => bestVoicing(c.pc, c.type));
  const play = () => {
    stop.current?.();
    const cancel = strumSequence(voices.map((v) => v.frets), STEP_MS, setNow);
    const end = window.setTimeout(() => setNow(null), voices.length * STEP_MS);
    stop.current = () => {
      cancel();
      window.clearTimeout(end);
    };
  };

  return (
    <article className="panel progression">
      <div className="prog-head">
        <div>
          <h3>{label}</h3>
          <p className="mono muted">{chords.map((c) => chordName(c.pc, c.type)).join(" – ")}</p>
        </div>
        <button className="chip accent play-chip" onClick={play} aria-label={`Oír ${label}`}>▶ Oír</button>
      </div>
      <div className="prog-row">
        {voices.map((v, i) => (
          <button key={i} className="mini" aria-pressed={now === i} onClick={() => strum(v.frets)}>
            <ChordDiagram compact strings={describeVoicing(v.frets, chords[i].pc, chords[i].type, "none")} barre={v.barre} title={chordName(chords[i].pc, chords[i].type)} />
            <span className="mono">{chordName(chords[i].pc, chords[i].type)}</span>
          </button>
        ))}
      </div>
    </article>
  );
}

function Flamencos({ mode, setMode }: Labels) {
  return (
    <div className="flamencos">
      <div className="toolbar between">
        <p className="muted">
          Acordes con cuerdas al aire, típicos del toque flamenco. El punto rojo es la nota fundamental (R); el resto
          indica qué papel hace cada nota en el acorde.
        </p>
        <LabelToggle mode={mode} setMode={setMode} />
      </div>
      <div className="flamenco-grid">
        {FLAMENCO.map((c) => (
          <article key={c.id} className="panel voicing-card">
            <ChordDiagram strings={describeFlamenco(c, mode)} barre={c.barre} title={c.name} />
            <h3>{c.name}</h3>
            {c.note && <p className="sources muted">{c.note}</p>}
            <PlayButton frets={c.frets} />
          </article>
        ))}
      </div>

      <h2 className="section-title">La cadencia flamenca</h2>
      <p>
        El toque flamenco usa el modo frigio con la tercera mayor sobre la tónica. Según el tono, la cadencia es
        distinta: <b>por medio</b> (La frigio) resuelve de B♭ a A, y <b>por arriba</b> (Mi frigio) de F a E.
      </p>
      <div className="progression-grid">
        {FLAMENCO_MODE.cadences.map((c) => <Progression key={c.id} label={c.label} chords={c.chords} />)}
      </div>

      <h3 className="mini-title">Los acordes de La frigio, por grados</h3>
      <div className="mini-grid keys">
        {FLAMENCO_MODE.degrees.map((d) => {
          const v = bestVoicing(d.chord.pc, d.chord.type);
          return (
            <button key={d.numeral} className="mini" onClick={() => strum(v.frets)} aria-label={`Oír ${chordName(d.chord.pc, d.chord.type)}`}>
              <span className="numeral">{d.numeral}</span>
              <ChordDiagram compact strings={describeVoicing(v.frets, d.chord.pc, d.chord.type, "none")} barre={v.barre} title={chordName(d.chord.pc, d.chord.type)} />
              <span className="mono">{chordName(d.chord.pc, d.chord.type)}</span>
              <small className="muted">{d.role || " "}</small>
            </button>
          );
        })}
      </div>

      <h3 className="mini-title">Progresiones típicas</h3>
      <div className="progression-grid">
        {FLAMENCO_MODE.progressions.map((p) => <Progression key={p.id} label={p.label} chords={p.chords} />)}
      </div>
      <p className="sources muted">
        Fuentes:{" "}
        {FLAMENCO_MODE.sources.map((u, i) => (
          <span key={u}>{i > 0 && " · "}<a href={u} target="_blank" rel="noopener noreferrer">{new URL(u).hostname.replace("www.", "")}</a></span>
        ))}
      </p>
    </div>
  );
}
