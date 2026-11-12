import { useEffect, useState } from "react";
import type { Form } from "../api";
import { useMetronome } from "../metronome";
import { displayOrder } from "../pattern";
import type { CajonMap, Ramp, Remate, SoundSet } from "../rhythm";
import { CompasWheel } from "./CompasWheel";

type Props = {
  cycleLen: number;
  form: Form;
  countStart: number;
  bpm: number;
  active: boolean;
  sounds?: SoundSet;
  cajon?: CajonMap;
  remate?: Remate | null;
  remateEvery?: number;
  ramp?: Ramp | null;
  recorded?: boolean;
};

export function MetronomeWheel({ cycleLen, form, countStart, bpm, active, sounds, cajon, remate, remateEvery, ramp, recorded }: Props) {
  const { beat, bpm: liveBpm } = useMetronome(active, { cycleLen, form, countStart, bpm, sounds, cajon, remate, remateEvery, ramp, recorded });
  const [pulse, setPulse] = useState(0);
  useEffect(() => {
    if (beat !== null) setPulse((p) => p + 1);
  }, [beat]);

  const order = displayOrder(cycleLen, countStart);
  const strength = Object.fromEntries(
    order.map((b) => [b, form.accents.includes(b) ? 1 : form.weak?.includes(b) ? 0.55 : 0.1]),
  );
  return (
    <CompasWheel
      order={order}
      accents={form.accents}
      weak={form.weak}
      strength={strength}
      center={String(Math.round(liveBpm))}
      caption={beat === null ? "BPM" : `${Math.round(liveBpm)} BPM`}
      current={beat}
      pulse={pulse}
    />
  );
}
