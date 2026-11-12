import { useEffect, useState } from "react";
import { fetchSongs, type SongSummary } from "../api";

const pct = (v: number | null) => (v === null ? "—" : v.toFixed(2).replace(".", ","));

export function Library() {
  const [songs, setSongs] = useState<SongSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSongs().then(setSongs, (e) => setError(String(e)));
  }, []);

  if (error) return <p className="muted">No se pudo leer la biblioteca ({error}). ¿Está corriendo flamenco-study serve?</p>;
  if (!songs) return null;
  if (!songs.length) {
    return (
      <div className="empty lunares">
        <div className="panel">
          <h2>Aún no hay canciones</h2>
          <p className="muted">
            Pídeselo a Claude Code: <span className="mono">"analiza esta canción, es una bulería"</span>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <section>
      <header className="page-head">
        <h1>Biblioteca</h1>
        <p className="muted">Todas las canciones analizadas. Abre una para ver su compás y reproducirla.</p>
      </header>
    <ul className="library">
      {songs.map((s) => (
        <li key={s.slug}>
          <a className="song-row" href={`#${s.slug}`}>
            <span className="song-title">
              <h2>{s.title}</h2>
              <span className="muted">{s.artist}</span>
            </span>
            <span className="chip accent">{s.palo_name}</span>
            <span className="stat mono">
              {Math.round(s.tempo_bpm)}
              <small>BPM</small>
            </span>
            <span className="stat mono">
              {s.cycles}
              <small>compases</small>
            </span>
            <span className="stat mono">
              {pct(s.profile_corr)}
              <small>parecido</small>
            </span>
          </a>
        </li>
      ))}
    </ul>
    </section>
  );
}
