import { OPEN_MIDI, type Frets } from "./chords";

let ctx: AudioContext | null = null;

function pluck(audio: AudioContext, time: number, freq: number) {
  const gain = audio.createGain();
  gain.gain.setValueAtTime(0.0001, time);
  gain.gain.exponentialRampToValueAtTime(0.2, time + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0005, time + 1.8);
  gain.connect(audio.destination);
  for (const [type, ratio, level] of [["triangle", 1, 1], ["sine", 2, 0.35]] as const) {
    const osc = audio.createOscillator();
    const part = audio.createGain();
    part.gain.value = level;
    osc.type = type;
    osc.frequency.value = freq * ratio;
    osc.connect(part).connect(gain);
    osc.start(time);
    osc.stop(time + 1.9);
  }
}

/** Strums the chord from the low string to the high one. */
export function strum(frets: Frets) {
  ctx ??= new AudioContext();
  void ctx.resume();
  const start = ctx.currentTime + 0.02;
  let k = 0;
  frets.forEach((fret, i) => {
    if (fret === null) return;
    const freq = 440 * 2 ** ((OPEN_MIDI[i] + fret - 69) / 12);
    pluck(ctx!, start + k * 0.045, freq);
    k++;
  });
}

/** Strums each chord in turn; returns a function that cancels the chords still to come. */
export function strumSequence(chords: Frets[], gapMs: number, onChord: (index: number) => void): () => void {
  const timers = chords.map((frets, i) =>
    window.setTimeout(() => {
      strum(frets);
      onChord(i);
    }, i * gapMs),
  );
  return () => timers.forEach((id) => window.clearTimeout(id));
}
