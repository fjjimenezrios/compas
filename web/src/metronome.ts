import { useEffect, useRef, useState } from "react";
import type { Form } from "./api";
import { displayOrder } from "./pattern";

export type Level = "accent" | "weak" | "normal";

export function clickLevel(form: Pick<Form, "accents" | "weak">, beat: number): Level {
  if (form.accents.includes(beat)) return "accent";
  return form.weak?.includes(beat) ? "weak" : "normal";
}

const GAIN: Record<Level, number> = { accent: 1, weak: 0.55, normal: 0.3 };
const PITCH: Record<Level, number> = { accent: 1400, weak: 1000, normal: 700 };
const START_PITCH = 2000;
const OFFBEAT = { pitch: 520, gain: 0.14 };

/** The count-start beat gets its own, higher pitch so the "1" (or the "12") is always audible. */
export function clickSound(form: Pick<Form, "accents" | "weak">, beat: number, countStart: number) {
  const level = clickLevel(form, beat);
  return { pitch: beat === countStart ? START_PITCH : PITCH[level], gain: GAIN[level] };
}

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

type Config = { cycleLen: number; form: Form; countStart: number; bpm: number };

const LOOKAHEAD_S = 0.12;
const TICK_MS = 25;

/**
 * Web Audio metronome. Clicks are scheduled slightly ahead of the audio clock (the usual
 * lookahead pattern) so timing doesn't depend on setInterval jitter. `bpm` is read live, so
 * moving the slider doesn't restart the count; changing the form or count start does.
 * Returns the beat number currently sounding, or null when stopped.
 */
export function useMetronome(active: boolean, config: Config): number | null {
  const [current, setCurrent] = useState<number | null>(null);
  const live = useRef(config);
  live.current = config;

  useEffect(() => {
    if (!active) return;
    const ctx = new AudioContext();
    void ctx.resume();
    const due: { time: number; beat: number }[] = [];
    let next = ctx.currentTime + 0.08;
    let index = 0;

    const schedule = () => {
      const { cycleLen, form, countStart, bpm } = live.current;
      const order = displayOrder(cycleLen, countStart);
      const period = 60 / bpm;
      while (next < ctx.currentTime + LOOKAHEAD_S) {
        const beat = order[index % cycleLen];
        const { pitch, gain } = clickSound(form, beat, countStart);
        click(ctx, next, pitch, gain);
        if (form.offbeats) click(ctx, next + period / 2, OFFBEAT.pitch, OFFBEAT.gain);
        due.push({ time: next, beat });
        next += period;
        index++;
      }
    };
    const timer = setInterval(schedule, TICK_MS);

    let raf = 0;
    const draw = () => {
      let latest: number | null = null;
      while (due.length && due[0].time <= ctx.currentTime) latest = due.shift()!.beat;
      if (latest !== null) setCurrent(latest);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      clearInterval(timer);
      cancelAnimationFrame(raf);
      void ctx.close();
      setCurrent(null);
    };
  }, [active, config.cycleLen, config.form.id, config.countStart]);

  return active ? current : null;
}
