import { useEffect, useState } from "react";
import type { Form } from "../api";
import { useMetronome } from "../metronome";
import { displayOrder } from "../pattern";
import { CompasWheel } from "./CompasWheel";

type Props = { cycleLen: number; form: Form; countStart: number; bpm: number; active: boolean };

export function MetronomeWheel({ cycleLen, form, countStart, bpm, active }: Props) {
  const current = useMetronome(active, { cycleLen, form, countStart, bpm });
  const [pulse, setPulse] = useState(0);
  useEffect(() => {
    if (current !== null) setPulse((p) => p + 1);
  }, [current]);

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
      center={String(bpm)}
      caption="BPM"
      current={current}
      pulse={pulse}
    />
  );
}
