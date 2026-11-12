import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import type { Grid } from "../api";
import {
  beatAdvice, buildTargets, describeOffset, evaluateTaps, JUST_MS, matchWindow, nearestTarget, type Evaluation,
} from "../trainer";
import type { PlayerApi } from "./PlayerBar";

const LATENCY_KEY = "compas.latency";

function readLatency(): number {
  try {
    return Number(localStorage.getItem(LATENCY_KEY)) || 0;
  } catch {
    return 0;
  }
}

type Feedback = { tone: "ok" | "early" | "late" | "off"; text: string };

type Props = {
  grid: Grid;
  accents: number[];
  player: RefObject<PlayerApi | null>;
  active: boolean;
  onActive: (on: boolean) => void;
};

export function Trainer({ grid, accents, player, active, onActive }: Props) {
  const [latency, setLatency] = useState(readLatency);
  const [last, setLast] = useState<Feedback | null>(null);
  const [count, setCount] = useState(0);
  const [result, setResult] = useState<Evaluation | null>(null);
  const taps = useRef<number[]>([]);
  const button = useRef<HTMLButtonElement>(null);

  const targets = useMemo(() => buildTargets(grid, accents), [grid, accents]);
  const window = useMemo(() => matchWindow(grid.beats), [grid]);

  const changeLatency = (ms: number) => {
    const value = Math.max(-300, Math.min(300, Math.round(ms)));
    setLatency(value);
    try {
      localStorage.setItem(LATENCY_KEY, String(value));
    } catch {
      /* storage blocked: the adjustment still applies to this visit */
    }
  };

  const tap = () => {
    const api = player.current;
    if (!api) return;
    // Read the song's position at the moment of the tap. The player's output latency makes a clap that is
    // in time with what you *hear* land a little after the audio position, which the adjustment removes.
    const t = api.getTime() - latency / 1000;
    taps.current.push(t);
    setCount(taps.current.length);
    const hit = nearestTarget(t, targets, window);
    setLast(
      hit
        ? { tone: Math.abs(hit.offsetMs) < JUST_MS ? "ok" : hit.offsetMs < 0 ? "early" : "late", text: `En el ${hit.target.beat}: ${describeOffset(hit.offsetMs)}` }
        : { tone: "off", text: "Fuera de un acento" },
    );
  };
  const tapRef = useRef(tap);
  tapRef.current = tap;

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      e.preventDefault();
      if (!e.repeat) tapRef.current();
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [active]);

  const start = async () => {
    taps.current = [];
    setCount(0);
    setLast(null);
    setResult(null);
    onActive(true);
    await player.current?.play();
    requestAnimationFrame(() => button.current?.focus());
  };

  const stop = () => {
    player.current?.pause();
    onActive(false);
    const done = taps.current;
    if (!done.length) {
      setLast({ tone: "off", text: "No registré ninguna palma" });
      return;
    }
    const range = buildTargets(grid, accents, Math.min(...done) - window, Math.max(...done) + window);
    setResult(evaluateTaps(done, range, window));
  };

  const accentLabel = accents.length ? accents.join(" · ") : "—";
  const total = result ? result.matches.length + result.missed.length : 0;
  const bias = result?.meanMs ?? null;
  const steady = result?.spreadMs !== null && (result?.spreadMs ?? 999) <= 60;
  const beatsInOrder = result ? grid.order.filter((b) => result.perBeat.some((p) => p.beat === b)) : [];

  return (
    <section className="panel trainer" aria-label="Entrenador de palmas">
      <div className="trainer-head">
        <div>
          <span className="eyebrow">Entrenador de palmas</span>
          <h2>Palmea con la canción</h2>
        </div>
        <span className="chip" title="Cambia los acentos en «Acentos en la rueda»">Acentos {accentLabel}</span>
      </div>

      {!active ? (
        <>
          <p className="muted">
            Pulsa <kbd>Espacio</kbd> (o el botón grande) en cada acento. Al terminar te digo cuánto te has acercado a cada tiempo.
          </p>
          <button className="play-big" onClick={() => void start()} disabled={!accents.length}>
            Empezar
          </button>
          {!accents.length && <p className="muted">Elige unos acentos en la rueda para poder entrenar.</p>}
        </>
      ) : (
        <>
          <button
            ref={button}
            className="tap-btn"
            onPointerDown={(e) => {
              e.preventDefault();
              tap();
            }}
            aria-label="Palma"
          >
            PALMA
            <small>{count} palmas</small>
          </button>
          <p className={`trainer-live ${last?.tone ?? ""}`} role="status" aria-live="off">
            {last ? last.text : "Espera al primer acento…"}
          </p>
          <button className="play-btn on" onClick={stop}>Terminar</button>
        </>
      )}

      {last && !active && !result && <p className="muted">{last.text}</p>}

      {result && !active && (
        <div className="trainer-result">
          <h3>
            {result.matches.length} de {total} acentos
            <span className="mono"> · {Math.round(result.hitRate * 100)} %</span>
          </h3>
          {bias === null ? (
            <p>No acerté a emparejar ninguna palma con un acento. Prueba bajando la velocidad.</p>
          ) : (
            <p>
              En media vas <b>{describeOffset(bias)}</b>
              {result.spreadMs !== null && <span className="muted"> · regularidad ±{result.spreadMs} ms</span>}
            </p>
          )}
          <ul className="trainer-beats">
            {beatsInOrder.map((b) => {
              const stats = result.perBeat.find((p) => p.beat === b)!;
              const tone = stats.meanMs === null ? "off" : Math.abs(stats.meanMs) < JUST_MS ? "ok" : stats.meanMs < 0 ? "early" : "late";
              return (
                <li key={b} className={tone}>
                  <b className="mono">{b}</b>
                  <span>{beatAdvice(b, stats.meanMs)}</span>
                  <small className="mono muted">{stats.hits}/{stats.total}</small>
                </li>
              );
            })}
          </ul>
          {result.extra.length > 0 && <p className="muted">{result.extra.length} palmas fuera de los acentos.</p>}
          {bias !== null && Math.abs(bias) >= 30 && steady && (
            <div className="trainer-bias">
              <p>
                Vas siempre {bias < 0 ? "adelantado" : "tarde"}. Si es la latencia de tu dispositivo (el sonido tarda en
                salir), puedo compensarla.
              </p>
              <button className="chip accent" onClick={() => changeLatency(latency + bias)}>Compensar {bias} ms</button>
            </div>
          )}
          <button className="chip" onClick={() => void start()}>Repetir</button>
        </div>
      )}

      <details className="trainer-settings">
        <summary>Ajuste de latencia</summary>
        <label className="latency">
          <span className="muted">Resta este retraso a cada palma (ms). Súbelo si sueles ir tarde en todos los tiempos.</span>
          <input
            id="latency"
            type="number"
            min={-300}
            max={300}
            step={10}
            value={latency}
            onChange={(e) => changeLatency(Number(e.target.value))}
            aria-label="Latencia en milisegundos"
          />
        </label>
      </details>
    </section>
  );
}
