import { useEffect, useMemo, useState } from "react";
import { fetchGrid, fetchOnsets, fetchPalos, fetchSong, type Grid, type Onset, type Palo, type Song } from "../api";
import {
  averagePattern,
  displayOrder,
  layerName,
  METER_FAMILIES,
  meterMatches,
  shiftAccents,
  templateCorrelation,
} from "../pattern";
import { CompasWheel } from "./CompasWheel";
import { MeterMatch } from "./MeterMatch";
import { PatternBars } from "./PatternBars";
import { PlayerBar } from "./PlayerBar";
import { TempoCurve } from "./TempoCurve";

const LAYER_ORDER = ["drums", "guitar", "vocals", "bass", "other", "original"];
const fmt = (v: number | null) => (v === null ? "—" : v.toFixed(2).replace(".", ","));

export function SongView({ slug }: { slug: string }) {
  const [song, setSong] = useState<Song | null>(null);
  const [grid, setGrid] = useState<Grid | null>(null);
  const [layer, setLayer] = useState("drums");
  const [onsets, setOnsets] = useState<Onset[]>([]);
  const [countStart, setCountStart] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [beatIdx, setBeatIdx] = useState(-1);
  const [palos, setPalos] = useState<Palo[]>([]);
  const [view, setView] = useState({ id: "palo", shift: 0 });

  useEffect(() => {
    fetchPalos().then(setPalos, () => setPalos([]));
  }, []);

  useEffect(() => {
    Promise.all([fetchSong(slug), fetchGrid(slug)]).then(([s, g]) => {
      setSong(s);
      setGrid(g);
      setCountStart(g.count_start);
      setLayer((current) => (current in s.layers ? current : Object.keys(s.layers)[0]));
    }, (e) => setError(String(e)));
  }, [slug]);

  useEffect(() => {
    fetchOnsets(slug, layer).then(setOnsets, () => setOnsets([]));
  }, [slug, layer]);

  const fullCycles = grid?.cycles.filter((c) => !c.partial && !c.no_compas).length ?? 0;
  const pattern = useMemo(
    () => (grid ? averagePattern(onsets, grid.cycle_len, grid.subdivision, fullCycles) : []),
    [onsets, grid, fullCycles],
  );
  const matches = useMemo(
    () => (pattern.some((subs) => subs[0] > 0) ? meterMatches(pattern.map((subs) => subs[0])) : []),
    [pattern],
  );

  if (error) return <p className="muted">No se pudo cargar la canción ({error}).</p>;
  if (!song || !grid || countStart === null) return null;

  const order = displayOrder(grid.cycle_len, countStart);
  const n = grid.cycle_len;
  // Beat numbers come from the analysed grid; countStart only changes how the wheel is drawn.
  const current = beatIdx < 0 ? null : grid.order[(((beatIdx - grid.first_start) % n) + n) % n];
  const layerCorr = templateCorrelation(pattern, grid.accents);
  const onBeat = Object.fromEntries(pattern.map((subs, i) => [i + 1, subs[0]]));
  const layers = Object.keys(song.layers).sort(
    (a, b) => (LAYER_ORDER.indexOf(a) + 1 || 99) - (LAYER_ORDER.indexOf(b) + 1 || 99),
  );
  const low = grid.cycles.filter((c) => !c.partial && c.low_confidence).length;
  const accentsLabel = grid.accents ? grid.accents.join(" · ") : "sin plantilla verificada";
  const family = METER_FAMILIES.find((f) => f.id === view.id);
  const baseAccents = family ? family.accents(n) : grid.accents ?? [];
  const shownAccents = shiftAccents(baseAccents, n, view.shift);
  const pickFamily = (id: string) => {
    const match = matches.find((m) => m.family.id === id);
    setView({ id, shift: match ? -match.rotation : 0 });
  };

  return (
    <article className="song">
      <header className="song-head">
        <a href="#" className="eyebrow back">← Biblioteca</a>
        <h1>{song.meta.title}</h1>
        <p className="muted">
          {song.meta.artist} · <span className="accent-text">{song.meta.palo_name}</span> · acentos {accentsLabel}
        </p>
      </header>

      <div className="song-body">
        <aside className="wheel-col">
          <div className="panel">
            <CompasWheel
              order={order}
              accents={shownAccents}
              strength={onBeat}
              center={String(Math.round(song.meta.tempo_bpm))}
              caption={current === null ? "BPM" : `${Math.round(song.meta.tempo_bpm)} BPM`}
              current={current}
              pulse={beatIdx}
            />
            <div className="accent-pick">
              <label className="pick">
                <span className="eyebrow">Acentos en la rueda</span>
                <select id="wheel-accents" value={view.id} onChange={(e) => pickFamily(e.target.value)}>
                  <option value="palo">Plantilla de {song.meta.palo_name}</option>
                  {matches.map((m) => (
                    <option key={m.family.id} value={m.family.id}>
                      {m.family.label} · {fmt(m.corr)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="nudge">
                <button className="chip" onClick={() => setView({ ...view, shift: view.shift - 1 })} aria-label="Mover acentos un tiempo antes">◀</button>
                <span className="mono">{shownAccents.length ? shownAccents.join(" · ") : "—"}</span>
                <button className="chip" onClick={() => setView({ ...view, shift: view.shift + 1 })} aria-label="Mover acentos un tiempo después">▶</button>
              </div>
            </div>
            <div className="seg" role="group" aria-label="Empezar la cuenta en">
              <span className="eyebrow">Cuenta desde</span>
              {[grid.cycle_len, 1].map((n) => (
                <button key={n} className="chip" aria-pressed={countStart === n} onClick={() => setCountStart(n)}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <dl className="facts">
            <div><dt className="eyebrow">Compases</dt><dd className="mono">{fullCycles}</dd></div>
            <div><dt className="eyebrow">Parecido con el palo</dt><dd className="mono">{fmt(grid.profile_corr)}</dd></div>
            <div><dt className="eyebrow">Baja confianza</dt><dd className="mono">{low} / {fullCycles}</dd></div>
            <div><dt className="eyebrow">Pulso detectado con</dt><dd className="mono">{song.meta.beat_source}</dd></div>
          </dl>
        </aside>

        <div className="main-col">
          <MeterMatch
            matches={matches}
            selected={view.id}
            onSelect={(m) => setView({ id: m.family.id, shift: -m.rotation })}
            tempo={song.meta.tempo_bpm}
            declaredPalo={song.meta.palo}
            palos={palos}
            layerLabel={layerName(layer)}
          />
          <section className="panel">
            <div className="section-head">
              <div>
                <span className="eyebrow">Patrón medio por tiempo</span>
                <h2>{layerName(layer)}</h2>
              </div>
              <span className="chip" title="Correlación de esta capa con la plantilla de acentos del palo">
                parecido {fmt(layerCorr)}
              </span>
            </div>
            <div className="chips" role="group" aria-label="Capa">
              {layers.map((l) => (
                <button key={l} className="chip" aria-pressed={l === layer} onClick={() => setLayer(l)}>
                  {layerName(l)}
                </button>
              ))}
            </div>
            <PatternBars order={order} accents={shownAccents} pattern={pattern} />
            <p className="legend muted">
              <span><i className="sw" style={{ background: "var(--accent)" }} />golpe en acento del palo</span>
              <span><i className="sw" style={{ background: "var(--fg)" }} />golpe en otro tiempo</span>
              <span><i className="sw" style={{ background: "var(--albero)" }} />contratiempo</span>
            </p>
            {layer === "drums" && (
              <p className="note muted">
                La capa de percusión mezcla palmas, cajón y taconeo: la separación no puede distinguirlos.
              </p>
            )}
          </section>

          <section className="panel">
            <div className="section-head">
              <div>
                <span className="eyebrow">Tempo compás a compás</span>
                <h2>¿Acelera o se mantiene?</h2>
              </div>
            </div>
            <TempoCurve cycles={grid.cycles} />
            {low > 0 && (
              <p className="note muted">
                Rayado: compases donde el patrón medido se aleja de la plantilla del palo o el pulso es irregular.
                No significa que estén mal, sino que la detección no es fiable ahí.
              </p>
            )}
          </section>
        </div>
      </div>
      <PlayerBar slug={slug} layers={song.layers} beats={grid.beats} onBeat={setBeatIdx} />
    </article>
  );
}
