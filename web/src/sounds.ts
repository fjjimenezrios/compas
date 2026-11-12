import type { Hit } from "./rhythm";

const samples = new Map<Hit, AudioBuffer[]>();
const lastPlayed = new Map<Hit, number>();

/** Picks one of `count` recordings at random, never the one that just played, so no hit repeats exactly. */
export function pickVariant(count: number, last: number | undefined, random: () => number = Math.random): number {
  if (count <= 1) return 0;
  if (last === undefined) return Math.floor(random() * count);
  const pick = Math.floor(random() * (count - 1));
  return pick < last ? pick : pick + 1;
}

/**
 * Recordings that replace the synthesized sounds, listed in samples/manifest.json. Each kind takes one file or a
 * list of variants, e.g. { "clap": ["palma-fuerte-1.wav", "palma-fuerte-2.wav"] }. Kinds that aren't listed keep
 * the synthesized sound. (Listing them avoids probing for files that aren't there.)
 */
const KINDS: Hit[] = ["clap", "clapSoft", "bass", "slap", "ghost"];

let loading: Promise<void> | null = null;

/**
 * Downloads and decodes the recordings once, when the app opens, so the very first hit already uses them.
 * They are decoded with an offline context, so they don't depend on (or wait for) the live audio context.
 */
export function preloadSamples(): Promise<void> {
  loading ??= (async () => {
    try {
      const res = await fetch("samples/manifest.json");
      if (!res.ok || !(res.headers.get("content-type") ?? "").includes("json")) return;
      const manifest: Partial<Record<Hit, string | string[]>> = await res.json();
      const decoder = new OfflineAudioContext(1, 1, 44100);
      await Promise.all(
        KINDS.map(async (kind) => {
          const files = ([] as string[]).concat(manifest[kind] ?? []);
          const buffers = await Promise.all(
            files.map(async (file) => {
              try {
                const audio = await fetch(`samples/${file}`);
                return audio.ok ? await decoder.decodeAudioData(await audio.arrayBuffer()) : null;
              } catch {
                return null; // unreadable recording: the others (or the synthesized sound) cover for it
              }
            }),
          );
          const loaded = buffers.filter((b): b is AudioBuffer => b !== null);
          if (loaded.length) samples.set(kind, loaded);
        }),
      );
    } catch {
      /* no manifest: everything stays synthesized */
    }
  })();
  return loading;
}

const noises = new WeakMap<AudioContext, AudioBuffer>();

function noise(ctx: AudioContext): AudioBuffer {
  let buffer = noises.get(ctx);
  if (!buffer) {
    buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noises.set(ctx, buffer);
  }
  return buffer;
}

function envelope(ctx: AudioContext, time: number, peak: number, dur: number, attack = 0.001) {
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, time);
  env.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), time + attack);
  env.gain.exponentialRampToValueAtTime(0.0001, time + dur);
  env.connect(ctx.destination);
  return env;
}

function burst(ctx: AudioContext, time: number, o: { freq: number; q: number; type: BiquadFilterType; dur: number; gain: number }) {
  const src = ctx.createBufferSource();
  src.buffer = noise(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = o.type;
  filter.frequency.value = o.freq;
  filter.Q.value = o.q;
  src.connect(filter).connect(envelope(ctx, time, o.gain, o.dur));
  src.start(time);
  src.stop(time + o.dur + 0.02);
}

function thump(ctx: AudioContext, time: number, o: { from: number; to: number; dur: number; gain: number }) {
  const osc = ctx.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(o.from, time);
  osc.frequency.exponentialRampToValueAtTime(o.to, time + o.dur * 0.6);
  osc.connect(envelope(ctx, time, o.gain, o.dur, 0.002));
  osc.start(time);
  osc.stop(time + o.dur + 0.02);
}

/**
 * Palmas and cajón: a recording when there is one (a different variant each time, with a touch of random
 * level and pitch, as no two real hits are the same), otherwise synthesized from filtered noise and short
 * pitch drops. `recorded = false` forces the synthesized sound.
 */
export function playHit(ctx: AudioContext, time: number, kind: Hit, gain = 1, recorded = true) {
  const variants = recorded ? samples.get(kind) : undefined;
  if (variants?.length) {
    const index = pickVariant(variants.length, lastPlayed.get(kind));
    lastPlayed.set(kind, index);
    const src = ctx.createBufferSource();
    src.buffer = variants[index];
    src.playbackRate.value = 1 + (Math.random() - 0.5) * 0.04;
    const g = ctx.createGain();
    g.gain.value = gain * (0.9 + Math.random() * 0.2);
    src.connect(g).connect(ctx.destination);
    src.start(time);
    return;
  }
  switch (kind) {
    case "clap":
      burst(ctx, time, { freq: 1900, q: 0.9, type: "bandpass", dur: 0.09, gain: 0.9 * gain });
      burst(ctx, time + 0.012, { freq: 1100, q: 1.5, type: "bandpass", dur: 0.06, gain: 0.55 * gain });
      break;
    case "clapSoft":
      burst(ctx, time, { freq: 900, q: 1.2, type: "bandpass", dur: 0.05, gain: 0.35 * gain });
      break;
    case "bass":
      thump(ctx, time, { from: 150, to: 55, dur: 0.28, gain: 0.9 * gain });
      burst(ctx, time, { freq: 250, q: 0.7, type: "lowpass", dur: 0.05, gain: 0.35 * gain });
      break;
    case "slap":
      burst(ctx, time, { freq: 3000, q: 1.1, type: "bandpass", dur: 0.07, gain: 0.7 * gain });
      thump(ctx, time, { from: 260, to: 140, dur: 0.06, gain: 0.25 * gain });
      break;
    case "ghost":
      thump(ctx, time, { from: 120, to: 80, dur: 0.08, gain: 0.25 * gain });
      break;
  }
}
