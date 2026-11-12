type Props = { bpm: number; min: number; max: number; onChange: (bpm: number) => void };

export function TempoControl({ bpm, min, max, onChange }: Props) {
  const set = (v: number) => onChange(Math.min(max, Math.max(min, Math.round(v))));
  return (
    <div className="tempo">
      <button className="chip" onClick={() => set(bpm - 5)} aria-label="Bajar 5 pulsos por minuto">−5</button>
      <input
        id="tempo"
        type="range"
        min={min}
        max={max}
        value={bpm}
        onChange={(e) => set(Number(e.target.value))}
        aria-label="Pulsos por minuto"
      />
      <button className="chip" onClick={() => set(bpm + 5)} aria-label="Subir 5 pulsos por minuto">+5</button>
      <span className="mono tempo-value">{bpm}<small>BPM</small></span>
    </div>
  );
}

export function tempoBounds(tempo: [number, number] | null): [number, number] {
  return tempo ?? [40, 260];
}

export function startingTempo(tempo: [number, number] | null, preferred?: number): number {
  const [lo, hi] = tempoBounds(tempo);
  return Math.min(hi, Math.max(lo, preferred ?? 100));
}
