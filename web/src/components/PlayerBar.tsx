import { useEffect, useRef, useState } from "react";
import { layerName } from "../pattern";

type Props = {
  slug: string;
  layers: Record<string, string>;
  beats: number[];
  onBeat: (index: number) => void;
};

const SPEEDS = [0.5, 0.75, 1];
const mmss = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

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

export function PlayerBar({ slug, layers, beats, onBeat }: Props) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [layer, setLayer] = useState("original" in layers ? "original" : Object.keys(layers)[0]);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      const t = audio.current?.currentTime ?? 0;
      onBeat(beatIndexAt(beats, t));
      setTime(t);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, beats, onBeat]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (e.code !== "Space" || ["INPUT", "SELECT", "BUTTON", "TEXTAREA"].includes(el.tagName)) return;
      e.preventDefault();
      toggle();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  });

  useEffect(() => {
    if (audio.current) audio.current.playbackRate = speed;
  }, [speed, layer]);

  function toggle() {
    const a = audio.current;
    if (!a) return;
    if (a.paused) a.play();
    else a.pause();
  }

  function switchLayer(next: string) {
    const a = audio.current;
    const at = a?.currentTime ?? 0;
    const wasPlaying = a ? !a.paused : false;
    setLayer(next);
    requestAnimationFrame(() => {
      if (!audio.current) return;
      audio.current.currentTime = at;
      if (wasPlaying) audio.current.play();
    });
  }

  function seek(t: number) {
    if (!audio.current) return;
    audio.current.currentTime = t;
    setTime(t);
    onBeat(beatIndexAt(beats, t));
  }

  return (
    <div className="player">
      <audio
        ref={audio}
        src={`songs/${slug}/${layers[layer]}`}
        preload="auto"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
      />
      <button className="play" onClick={toggle} aria-label={playing ? "Pausa" : "Reproducir"} title="Espacio">
        {playing ? (
          <svg viewBox="0 0 24 24" width="22" height="22"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" /><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" /></svg>
        ) : (
          <svg viewBox="0 0 24 24" width="22" height="22"><path d="M8 5v14l11-7z" fill="currentColor" /></svg>
        )}
      </button>
      <span className="mono time">{mmss(time)}</span>
      <input
        id="seek"
        className="seek"
        type="range"
        min={0}
        max={duration || 0}
        step={0.01}
        value={time}
        onChange={(e) => seek(Number(e.target.value))}
        aria-label="Posición"
      />
      <span className="mono time muted">{mmss(duration)}</span>
      <label className="pick">
        <span className="eyebrow">Escuchar</span>
        <select id="layer" value={layer} onChange={(e) => switchLayer(e.target.value)}>
          {Object.keys(layers).map((l) => (
            <option key={l} value={l}>{layerName(l)}</option>
          ))}
        </select>
      </label>
      <label className="pick">
        <span className="eyebrow">Velocidad</span>
        <select id="speed" value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
          {SPEEDS.map((s) => (
            <option key={s} value={s}>{s * 100}%</option>
          ))}
        </select>
      </label>
    </div>
  );
}
