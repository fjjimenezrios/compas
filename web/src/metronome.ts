import { useEffect, useRef, useState } from "react";
import type { Form } from "./api";
import { displayOrder } from "./pattern";
import { clickSound, hitsForBeat, isRemateCycle, nextBpm, type CajonMap, type Ramp, type Remate, type SoundSet } from "./rhythm";
import { playHit, preloadSamples } from "./sounds";

export { clickLevel, clickSound } from "./rhythm";

const OFFBEAT = { pitch: 520, gain: 0.14 };
const CLICK_ONLY: SoundSet = { click: true, palmas: false, cajon: false };

function click(ctx: AudioContext, time: number, pitch: number, gain: number) {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.frequency.value = pitch;
  env.gain.setValueAtTime(gain * 0.5, time);
  env.gain.exponentialRampToValueAtTime(0.001, time + 0.06);
  osc.connect(env).connect(ctx.destination);
  osc.start(time);
  osc.stop(time + 0.07);
}

export type MetronomeConfig = {
  cycleLen: number;
  form: Form;
  countStart: number;
  bpm: number;
  sounds?: SoundSet;
  cajon?: CajonMap;
  remate?: Remate | null;
  /** Play the remate on every Nth bar; 0 or undefined = never. */
  remateEvery?: number;
  ramp?: Ramp | null;
  /** Use the recordings of palmas and cajón (default) or force the synthesized sounds. */
  recorded?: boolean;
};

export type MetronomeState = { beat: number | null; bpm: number; cycle: number };

const LOOKAHEAD_S = 0.12;
const TICK_MS = 25;

/**
 * Web Audio metronome. Sounds are scheduled slightly ahead of the audio clock (the usual lookahead
 * pattern) so timing doesn't depend on setInterval jitter. Everything except the form and the count
 * start is read live, so changing the tempo or the sounds doesn't restart the count. With a ramp the
 * tempo rises as the bars go by; moving the tempo slider starts the ramp again from that value.
 * Returns the beat sounding now (or null when stopped) and the tempo actually in use.
 */
export function useMetronome(active: boolean, config: MetronomeConfig): MetronomeState {
  const [state, setState] = useState<MetronomeState>({ beat: null, bpm: config.bpm, cycle: 0 });
  const live = useRef(config);
  live.current = config;

  useEffect(() => {
    if (!active) return;
    const ctx = new AudioContext();
    void ctx.resume();
    void preloadSamples();
    const due: (MetronomeState & { time: number })[] = [];
    let next = ctx.currentTime + 0.08;
    let index = 0;
    let cycle = 0;
    let base = live.current.bpm;
    let seenBpm = base;

    const schedule = () => {
      while (next < ctx.currentTime + LOOKAHEAD_S) {
        const cfg = live.current;
        if (cfg.bpm !== seenBpm) {
          base = cfg.bpm;
          seenBpm = cfg.bpm;
        }
        const order = displayOrder(cfg.cycleLen, cfg.countStart);
        const pos = index % cfg.cycleLen;
        if (pos === 0 && index > 0) {
          cycle++;
          base = nextBpm(base, cycle, cfg.ramp);
        }
        const beat = order[pos];
        const sounds = cfg.sounds ?? CLICK_ONLY;
        const period = 60 / base;

        if (sounds.click) {
          const { pitch, gain } = clickSound(cfg.form, beat, cfg.countStart);
          click(ctx, next, pitch, gain);
          if (cfg.form.offbeats) click(ctx, next + period / 2, OFFBEAT.pitch, OFFBEAT.gain);
        }
        const hits = hitsForBeat({
          form: cfg.form, beat, order, sounds, cajon: cfg.cajon, remate: cfg.remate,
          remateCycle: isRemateCycle(cycle, cfg.remateEvery ?? 0),
        });
        const recorded = cfg.recorded ?? true;
        for (const h of hits) playHit(ctx, next, h.kind, h.gain, recorded);
        if (cfg.form.offbeats && sounds.palmas) playHit(ctx, next + period / 2, "clapSoft", 0.5, recorded);

        due.push({ time: next, beat, bpm: Math.round(base), cycle });
        next += period;
        index++;
      }
    };
    const timer = setInterval(schedule, TICK_MS);

    let raf = 0;
    const draw = () => {
      let latest: (MetronomeState & { time: number }) | null = null;
      while (due.length && due[0].time <= ctx.currentTime) latest = due.shift()!;
      if (latest) setState({ beat: latest.beat, bpm: latest.bpm, cycle: latest.cycle });
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      clearInterval(timer);
      cancelAnimationFrame(raf);
      void ctx.close();
      setState({ beat: null, bpm: live.current.bpm, cycle: 0 });
    };
  }, [active, config.cycleLen, config.form.id, config.countStart]);

  return active ? state : { beat: null, bpm: config.bpm, cycle: 0 };
}
