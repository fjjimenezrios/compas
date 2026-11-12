import { layerName } from "./pattern";

const ORDER = ["original", "drums", "guitar", "vocals", "bass", "other"];
const rank = (id: string) => (ORDER.includes(id) ? ORDER.indexOf(id) : ORDER.length);

/** The full mix first, then the separated layers in the order players look for them. */
export const orderTracks = (ids: string[]) => [...ids].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));

export type Preset = "mix" | "stems" | "none";

export function presetSelection(preset: Preset, tracks: string[]): string[] {
  if (preset === "none") return [];
  const stems = tracks.filter((t) => t !== "original");
  if (preset === "stems") return stems.length ? stems : tracks;
  return tracks.includes("original") ? ["original"] : tracks.slice(0, 1);
}

/** Several <audio> elements never run on exactly the same clock; past this gap they are re-synced. */
export const isDrifting = (masterTime: number, otherTime: number, threshold = 0.06) =>
  Math.abs(masterTime - otherTime) > threshold;

/**
 * The full mix already contains every layer: playing it together with a layer would double that layer
 * and, since each MP3 starts about 25 ms apart, make it sound phasey. So the mix and the layers exclude
 * each other, while layers combine freely.
 */
export function toggleTrack(selected: string[], id: string): string[] {
  if (selected.includes(id)) return selected.filter((t) => t !== id);
  return id === "original" ? [id] : [...selected.filter((t) => t !== "original"), id];
}

export function selectionLabel(selected: string[]): string {
  if (!selected.length) return "Elegir pistas";
  if (selected.length <= 2) return selected.map(layerName).join(" + ");
  return `${selected.length} pistas`;
}
