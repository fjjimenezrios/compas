import { useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from "react";
import { SECTION_LABELS, type Section } from "../api";
import { layerName } from "../pattern";
import { isDrifting, orderTracks, presetSelection, selectionLabel, toggleTrack as toggled } from "../tracks";
import { Slider } from "./Slider";

export type Loop = { start: number; end: number; label: string };

/** What the palmas trainer and the sections panel need from the player. */
export type PlayerApi = {
  getTime: () => number;
  isPlaying: () => boolean;
  play: () => Promise<void>;
  pause: () => void;
  seek: (t: number) => void;
};

type Props = {
  slug: string;
  layers: Record<string, string>;
  beats: number[];
  onBeat: (index: number) => void;
  sections: Section[];
  loop: Loop | null;
  onLoop: (loop: Loop | null) => void;
  /** While the trainer is on, Space is a palma, not play/pause. */
  lockSpace: boolean;
  ref?: Ref<PlayerApi>;
};

const SPEED_MIN = 0.5;
const SPEED_MAX = 1;
export const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

export function beatIndexAt(beats: number[], t: number): number {
  let lo = 0;
  let hi = beats.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (beats[mid] <= t) {
      found = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return found;
}

export function PlayerBar({ slug, layers, beats, onBeat, sections, loop, onLoop, lockSpace, ref }: Props) {
  const tracks = useMemo(() => orderTracks(Object.keys(layers)), [layers]);
  const [selected, setSelected] = useState<string[]>(() => presetSelection("mix", tracks));
  const [volumes, setVolumes] = useState<Record<string, number>>({});
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState<string[]>([]);

  const els = useRef(new Map<string, HTMLAudioElement>());
  const handled = useRef(new WeakSet<HTMLAudioElement>());
  const inSync = useRef(new WeakSet<HTMLAudioElement>());
  const lastFix = useRef(new WeakMap<HTMLAudioElement, number>());
  const wrap = useRef<HTMLDivElement>(null);
  const playingRef = useRef(false);
  const timeRef = useRef(0);
  const speedRef = useRef(1);
  const loopRef = useRef<Loop | null>(null);
  const lockRef = useRef(false);
  playingRef.current = playing;
  speedRef.current = speed;
  loopRef.current = loop;
  lockRef.current = lockSpace;

  // Tracks play in the same order they are listed, so the clock source is stable.
  const active = tracks.filter((t) => selected.includes(t));

  /**
   * The clock is the first track that is already playing in sync. A track that was just added is still
   * loading (its position is 0), so it must never set the song's position: until it is aligned the
   * position keeps advancing with the browser's own clock.
   */
  const clock = () => {
    for (const id of tracks) {
      const el = els.current.get(id);
      if (el && inSync.current.has(el) && !el.paused && el.readyState >= 2) return el;
    }
    return null;
  };

  // Speed and volume apply to every track, including ones that were just added.
  useEffect(() => {
    for (const [id, el] of els.current) {
      el.playbackRate = speed;
      el.volume = volumes[id] ?? 1;
    }
  }, [speed, volumes, selected]);

  function stopAll() {
    els.current.forEach((el) => el.pause());
    setPlaying(false);
  }

  // A track added mid-song waits until the browser has the audio at the current position, then
  // lines up with the clock and starts. The tracks already playing are never interrupted.
  const join = (el: HTMLAudioElement) => {
    const finish = () => {
      el.currentTime = timeRef.current;
      if (!playingRef.current) {
        inSync.current.add(el);
        return;
      }
      // If the browser refuses (autoplay rules), stop so the button shows the truth and a tap resumes it.
      void el.play().then(() => inSync.current.add(el)).catch(stopAll);
    };
    const whenBuffered = () => (el.readyState >= 3 ? finish() : el.addEventListener("canplay", finish, { once: true }));
    const seekThere = () => {
      if (Math.abs(el.currentTime - timeRef.current) < 0.02) return whenBuffered();
      el.addEventListener("seeked", whenBuffered, { once: true });
      el.currentTime = timeRef.current;
    };
    if (el.readyState >= 1) seekThere();
    else el.addEventListener("loadedmetadata", seekThere, { once: true });
  };

  useEffect(() => {
    for (const el of els.current.values()) {
      if (handled.current.has(el)) continue;
      handled.current.add(el);
      join(el);
    }
    if (!selected.length) setPlaying(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  function seek(t: number) {
    timeRef.current = t;
    setTime(t);
    els.current.forEach((el) => {
      el.currentTime = t;
    });
    onBeat(beatIndexAt(beats, t));
  }

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let prev = performance.now();
    const tick = (now: number) => {
      const master = clock();
      let t = master ? master.currentTime : timeRef.current + ((now - prev) / 1000) * speedRef.current;
      prev = now;
      const looping = loopRef.current;
      if (looping && t >= looping.end) {
        seek(looping.start);
        t = looping.start;
      } else {
        timeRef.current = t;
        setTime(t);
        onBeat(beatIndexAt(beats, t));
      }
      if (master) {
        for (const el of els.current.values()) {
          if (el === master || !inSync.current.has(el) || el.seeking || el.paused) continue;
          // Seeking an MP3 glitches it, so a layer is only re-aligned when it has really drifted, and not too often.
          if (isDrifting(t, el.currentTime) && now - (lastFix.current.get(el) ?? 0) > 1000) {
            lastFix.current.set(el, now);
            el.currentTime = t;
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, beats, onBeat, tracks]);

  async function play() {
    const all = [...els.current.values()];
    if (!all.length) {
      setOpen(true);
      return;
    }
    all.forEach((el) => {
      el.currentTime = timeRef.current;
    });
    const started = await Promise.all(all.map((el) => el.play().then(() => inSync.current.add(el)).then(() => true, () => false)));
    if (started.some(Boolean)) setPlaying(true);
    else stopAll();
  }

  async function toggle() {
    if (playingRef.current) stopAll();
    else await play();
  }

  useImperativeHandle(ref, () => ({
    getTime: () => clock()?.currentTime ?? timeRef.current,
    isPlaying: () => playingRef.current,
    play,
    pause: stopAll,
    seek,
  }));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape") setOpen(false);
      const tag = (e.target as HTMLElement).tagName;
      if (e.code !== "Space" || lockRef.current || ["INPUT", "SELECT", "BUTTON", "TEXTAREA"].includes(tag)) return;
      e.preventDefault();
      void toggle();
    };
    const onPointer = (e: PointerEvent) => {
      if (open && wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    addEventListener("keydown", onKey);
    addEventListener("pointerdown", onPointer);
    return () => {
      removeEventListener("keydown", onKey);
      removeEventListener("pointerdown", onPointer);
    };
  });

  const toggleTrack = (id: string) => setSelected((s) => toggled(s, id));

  const row = (id: string) => {
    const checked = selected.includes(id);
    return (
      <li key={id} className={checked ? "track-row on" : "track-row"}>
        <label className="track-check">
          <input type="checkbox" checked={checked} onChange={() => toggleTrack(id)} />
          <span>{layerName(id)}</span>
        </label>
        <Slider
          className="track-volume"
          min={0}
          max={1}
          step={0.05}
          value={volumes[id] ?? 1}
          disabled={!checked}
          onChange={(v) => setVolumes({ ...volumes, [id]: v })}
          aria-label={`Volumen: ${layerName(id)}`}
        />
      </li>
    );
  };

  return (
    <div className="player">
      {active.map((id) => (
        <audio
          key={id}
          ref={(el) => {
            if (el) els.current.set(id, el);
            else els.current.delete(id);
          }}
          src={`songs/${slug}/${layers[id]}`}
          preload="auto"
          onEnded={stopAll}
          onError={() => {
            setFailed((f) => [...new Set([...f, id])]);
            setSelected((s) => s.filter((x) => x !== id));
          }}
          onLoadedMetadata={(e) => {
            const length = e.currentTarget.duration || 0; // read now: React clears currentTarget after the handler
            setDuration((d) => Math.max(d, length));
          }}
        />
      ))}

      {loop && (
        <button className="loop-pill" onClick={() => onLoop(null)} aria-label="Quitar el bucle">
          <span aria-hidden="true">↻</span> {loop.label} · {mmss(loop.start)}–{mmss(loop.end)} <b aria-hidden="true">✕</b>
        </button>
      )}

      <button className="play" onClick={() => void toggle()} aria-label={playing ? "Pausa" : "Reproducir"} title="Espacio" disabled={!active.length}>
        {playing ? (
          <svg viewBox="0 0 24 24" width="22" height="22"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" /><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" width="22" height="22"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>
        )}
      </button>
      <span className="mono time">{mmss(time)}</span>
      <div className="seek-wrap">
        {duration > 0 && (sections.length > 0 || loop) && (
          <div className="bands" aria-hidden="true">
            {sections.map((s, i) => (
              <span
                key={i}
                className={`band ${s.kind}`}
                title={`${SECTION_LABELS[s.kind]} · ${mmss(s.start)}–${mmss(s.end)}`}
                style={{ left: `${(s.start / duration) * 100}%`, width: `${((s.end - s.start) / duration) * 100}%` }}
              />
            ))}
            {loop && <span className="band-loop" style={{ left: `${(loop.start / duration) * 100}%`, width: `${((loop.end - loop.start) / duration) * 100}%` }} />}
          </div>
        )}
        <Slider id="seek" className="seek" min={0} max={duration || 0} step={0.01} value={time} onChange={seek} aria-label="Posición" />
      </div>
      <span className="mono time end">{mmss(duration)}</span>

      <div className="player-row2">
        <div className="tracks" ref={wrap}>
          <button className="tracks-btn" aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(!open)}>
            <span aria-hidden="true">♪</span>
            <span className="tracks-label">{selectionLabel(active)}</span>
            <b className="tracks-count">{active.length}</b>
          </button>

          {open && (
            <div className="tracks-panel" role="dialog" aria-label="Pistas para escuchar">
              <div className="tracks-head">
                <div>
                  <h3>Elige qué escuchar</h3>
                  <p className="muted">Marca varias pistas para oírlas a la vez.</p>
                </div>
                <button className="tracks-close" onClick={() => setOpen(false)} aria-label="Cerrar">✕</button>
              </div>
              <div className="tracks-presets">
                <button className="chip" onClick={() => setSelected(presetSelection("mix", tracks))}>Solo la mezcla</button>
                <button className="chip" onClick={() => setSelected(presetSelection("stems", tracks))}>Todas las separadas</button>
                <button className="chip" onClick={() => setSelected(presetSelection("none", tracks))}>Ninguna</button>
              </div>
              {failed.length > 0 && (
                <p className="tracks-note error" role="alert">No se pudo cargar: {failed.map(layerName).join(", ")}.</p>
              )}
              {tracks.includes("original") && (
                <>
                  <span className="eyebrow">Mezcla</span>
                  <ul className="track-list">{row("original")}</ul>
                  <p className="tracks-note muted">La mezcla ya lleva todas las pistas: al elegir una separada, se desmarca.</p>
                </>
              )}
              {tracks.some((t) => t !== "original") && (
                <>
                  <span className="eyebrow">Pistas separadas</span>
                  <ul className="track-list">{tracks.filter((t) => t !== "original").map(row)}</ul>
                </>
              )}
            </div>
          )}
        </div>

        <label className="speed">
          <span className="speed-label">
            <span className="eyebrow">Velocidad</span>
            <b className="mono">{Math.round(speed * 100)}%</b>
          </span>
          <Slider id="speed" min={SPEED_MIN} max={SPEED_MAX} step={0.05} value={speed} onChange={setSpeed} aria-label="Velocidad de reproducción" />
        </label>
      </div>
    </div>
  );
}
