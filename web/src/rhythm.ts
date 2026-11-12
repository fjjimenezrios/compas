import type { Form } from "./api";

export type Level = "accent" | "weak" | "normal";

export function clickLevel(form: Pick<Form, "accents" | "weak">, beat: number): Level {
  if (form.accents.includes(beat)) return "accent";
  return form.weak?.includes(beat) ? "weak" : "normal";
}

const GAIN: Record<Level, number> = { accent: 1, weak: 0.55, normal: 0.3 };
const PITCH: Record<Level, number> = { accent: 1400, weak: 1000, normal: 700 };
const START_PITCH = 2000;

/** The count-start beat gets its own, higher pitch so the "1" (or the "12") is always audible. */
export function clickSound(form: Pick<Form, "accents" | "weak">, beat: number, countStart: number) {
  const level = clickLevel(form, beat);
  return { pitch: beat === countStart ? START_PITCH : PITCH[level], gain: GAIN[level] };
}

export type Hit = "clap" | "clapSoft" | "bass" | "slap" | "ghost";
export type SoundSet = { click: boolean; palmas: boolean; cajon: boolean };
/** G = grave (bass), A = agudo (slap). Beats that aren't listed are ghost notes. */
export type CajonMap = Record<string, "G" | "A">;
export type Remate = { beats: number[]; cajon: CajonMap };
export type Ramp = { step: number; everyCycles: number; max: number };

export const PALMAS_Y_CAJON: SoundSet = { click: false, palmas: true, cajon: true };

/** A remate closes every Nth bar. */
export const isRemateCycle = (cycle: number, every: number) => every > 0 && (cycle + 1) % every === 0;

/** The tempo for the next bar: it rises by `step` every `everyCycles` bars and never passes `max`. */
export function nextBpm(bpm: number, completedCycles: number, ramp?: Ramp | null): number {
  if (!ramp || completedCycles <= 0 || completedCycles % ramp.everyCycles !== 0) return bpm;
  return bpm >= ramp.max ? bpm : Math.min(ramp.max, bpm + ramp.step);
}

type BeatArgs = {
  form: Pick<Form, "accents" | "weak">;
  beat: number;
  order: number[];
  sounds: SoundSet;
  cajon?: CajonMap;
  remate?: Remate | null;
  remateCycle?: boolean;
};

/**
 * What plays on one beat. Palmas fuertes go on the accents and palmas sordas on the weak beats. The
 * cajón follows the palo's own pattern when it fits the chosen form of accents; otherwise it uses a
 * generic one: grave on the first accent, agudo on the other accents, ghost notes in between.
 */
export function hitsForBeat({ form, beat, order, sounds, cajon, remate, remateCycle }: BeatArgs): { kind: Hit; gain: number }[] {
  const hits: { kind: Hit; gain: number }[] = [];
  const level = clickLevel(form, beat);
  const inRemate = !!remateCycle && !!remate && remate.beats.includes(beat);

  if (sounds.palmas) {
    if (level === "accent" || inRemate) hits.push({ kind: "clap", gain: 1 });
    else if (level === "weak") hits.push({ kind: "clapSoft", gain: 0.7 });
  }

  if (sounds.cajon) {
    const key = String(beat);
    const fits = !!cajon && Object.keys(cajon).every((k) => form.accents.includes(Number(k)));
    const drum = (inRemate ? remate!.cajon[key] : undefined) ?? (fits ? cajon![key] : undefined);
    if (drum) hits.push(drum === "G" ? { kind: "bass", gain: 1 } : { kind: "slap", gain: 0.9 });
    else if (fits) hits.push({ kind: "ghost", gain: 0.6 });
    else if (level === "accent") {
      const first = order.find((b) => form.accents.includes(b));
      hits.push(beat === first ? { kind: "bass", gain: 1 } : { kind: "slap", gain: 0.9 });
    } else hits.push({ kind: "ghost", gain: level === "weak" ? 0.6 : 0.35 });
  }
  return hits;
}
