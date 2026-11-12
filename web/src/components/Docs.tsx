import { useEffect, useMemo, useState } from "react";
import { fetchGuide, fetchPalos, fetchSongs, type Form, type Palo, type SongSummary } from "../api";
import { PALMAS_Y_CAJON } from "../rhythm";
import { prioritize, splitSections, type Section } from "../study";
import { MetronomeWheel } from "./MetronomeWheel";
import { startingTempo, TempoControl, tempoBounds } from "./TempoControl";

function usePalosAndSongs() {
  const [palos, setPalos] = useState<Palo[] | null>(null);
  const [songs, setSongs] = useState<SongSummary[]>([]);
  useEffect(() => {
    fetchPalos().then(setPalos, () => setPalos([]));
    fetchSongs().then(setSongs, () => setSongs([]));
  }, []);
  return { palos, songs };
}

const hasGuide = (p: Palo) => (p.forms?.length ?? 0) > 0;

export function DocsIndex() {
  const { palos, songs } = usePalosAndSongs();
  if (!palos) return null;
  const ordered = [...palos].sort((a, b) => Number(hasGuide(b)) - Number(hasGuide(a)));
  return (
    <section>
      <header className="page-head">
        <h1>Documentación</h1>
        <p className="muted">Para entender cada palo: cómo se cuenta, dónde van los acentos y cómo suena.</p>
      </header>
      <a className="panel quiz-banner" href="#test">
        <span>
          <b>Ponte a prueba</b>
          <small className="muted">Preguntas rápidas sacadas de las guías, con el metrónomo para comprobar las respuestas.</small>
        </span>
        <span className="chip accent">Hacer el test →</span>
      </a>
      <ul className="palo-grid">
        {ordered.map((p) => {
          const count = songs.filter((s) => s.palo === p.id).length;
          const body = (
            <>
              <span className="eyebrow">{p.family}</span>
              <h2>{p.name}</h2>
              <p className={p.summary ? "" : "muted"}>{p.summary ?? "Todavía sin guía."}</p>
              <span className="mono muted">
                {count ? `${count} canción${count > 1 ? "es" : ""} en la biblioteca` : "sin canciones aún"}
              </span>
            </>
          );
          return (
            <li key={p.id}>
              {hasGuide(p) ? (
                <a className="palo-card" href={`#doc/${p.id}`}>{body}</a>
              ) : (
                <div className="palo-card disabled">{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Sources({ urls }: { urls: string[] }) {
  if (!urls.length) return <p className="sources muted">Sin fuente específica: orientativo.</p>;
  return (
    <p className="sources muted">
      Fuentes:{" "}
      {urls.map((u, i) => (
        <span key={u}>
          {i > 0 && " · "}
          <a href={u} target="_blank" rel="noopener noreferrer">{new URL(u).hostname.replace("www.", "")}</a>
        </span>
      ))}
    </p>
  );
}

function FormCard(props: { palo: Palo; form: Form; bpm: number; active: boolean; onToggle: () => void }) {
  const { palo, form, bpm, active, onToggle } = props;
  return (
    <article className="panel form-card" aria-label={form.label}>
      <div className="form-wheel">
        <MetronomeWheel cycleLen={form.cycle_len ?? palo.cycle_len ?? 4} form={form} countStart={form.count_start} bpm={bpm} active={active} sounds={PALMAS_Y_CAJON} cajon={palo.cajon} />
      </div>
      <div className="form-text">
        <h3>{form.label}</h3>
        <p>{form.explain}</p>
        <Sources urls={form.sources} />
      </div>
      <button className={active ? "play-btn on" : "play-btn"} onClick={onToggle} aria-pressed={active}>
        {active ? "Parar" : "Probar"}
      </button>
    </article>
  );
}

export function DocPalo({ id }: { id: string }) {
  const { palos, songs } = usePalosAndSongs();
  const [sections, setSections] = useState<Section[] | null>(null);
  const palo = palos?.find((p) => p.id === id);
  const [bpm, setBpm] = useState<number | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);

  useEffect(() => {
    fetchGuide(id).then((md) => setSections(md ? prioritize(splitSections(md)) : []), () => setSections([]));
  }, [id]);

  useEffect(() => {
    if (palo && bpm === null) setBpm(startingTempo(palo.tempo_bpm, palo.default_bpm));
  }, [palo, bpm]);

  const mine = useMemo(() => songs.filter((s) => s.palo === id), [songs, id]);

  if (!palos) return null;
  if (!palo || !hasGuide(palo)) {
    return (
      <p className="muted">
        No hay guía para este palo todavía. <a href="#doc">Volver a Documentación</a>
      </p>
    );
  }
  const [lo, hi] = tempoBounds(palo.tempo_bpm);
  const tempo = bpm ?? startingTempo(palo.tempo_bpm, palo.default_bpm);

  return (
    <article className="doc">
      <header className="song-head">
        <a href="#doc" className="eyebrow back">← Documentación</a>
        <h1>{palo.name}</h1>
        <p className="muted">{palo.summary}</p>
        <div className="chips">
          <a className="chip accent" href={`#test/${palo.id}`}>Test de {palo.name} →</a>
          <span className="chip">{palo.family}</span>
          {palo.cycle_len && <span className="chip">ciclo de {palo.cycle_len}</span>}
          {palo.tempo_bpm && <span className="chip">{palo.tempo_bpm[0]}–{palo.tempo_bpm[1]} BPM</span>}
        </div>
      </header>

      <section className="panel tempo-panel">
        <div>
          <span className="eyebrow">Tempo de las pruebas</span>
          <p className="muted">Pulsos por minuto: cada golpe de la rueda es un pulso.</p>
        </div>
        <TempoControl bpm={tempo} min={lo} max={hi} onChange={setBpm} />
      </section>

      <h2 className="section-title">Formas de acentuación</h2>
      <div className="form-grid">
        {palo.forms!.map((f) => (
          <FormCard
            key={f.id}
            palo={palo}
            form={f}
            bpm={tempo}
            active={playing === f.id}
            onToggle={() => setPlaying(playing === f.id ? null : f.id)}
          />
        ))}
      </div>

      {mine.length > 0 && (
        <>
          <h2 className="section-title">Escúchalo en canciones</h2>
          <p className="muted">Abre una y pulsa reproducir: la rueda marca el compás mientras suena.</p>
          <ul className="example-list">
            {mine.map((s) => (
              <li key={s.slug}>
                <a className="song-row compact" href={`#${s.slug}`}>
                  <span className="song-title">
                    <h3>{s.title}</h3>
                    <span className="muted">{s.artist}</span>
                  </span>
                  <span className="stat mono">{Math.round(s.tempo_bpm)}<small>BPM</small></span>
                </a>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 className="section-title">Guía completa</h2>
      {sections === null ? null : sections.length === 0 ? (
        <p className="muted">Este palo aún no tiene guía escrita.</p>
      ) : (
        <div className="guide">
          {sections.map((s, i) => (
            <details key={s.id} className="panel guide-card" open={i === 0}>
              <summary><h3>{s.title}</h3></summary>
              <div className="prose" dangerouslySetInnerHTML={{ __html: s.html }} />
            </details>
          ))}
        </div>
      )}
    </article>
  );
}
