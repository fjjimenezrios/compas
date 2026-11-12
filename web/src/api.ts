export type Meta = {
  title: string;
  artist: string;
  palo: string;
  palo_name: string;
  tempo_bpm: number;
  cycle_len: number;
  count_start: number;
  cycles: number;
  profile_corr: number | null;
  low_confidence_cycles: number;
  beat_source: string;
  layers: string[];
  notes: string;
};

export type SongSummary = Meta & { slug: string };

export type Cycle = {
  index: number;
  start: number;
  end: number;
  beat_times: number[];
  partial: boolean;
  tempo_bpm: number;
  template_corr: number | null;
  suggested_shift: number;
  no_compas: boolean;
  confidence: number;
  low_confidence: boolean;
};

export type Grid = {
  palo: string;
  cycle_len: number;
  count_start: number;
  order: number[];
  accents: number[] | null;
  subdivision: number;
  first_start: number;
  beats: number[];
  phase_corr: number | null;
  profile_corr: number | null;
  cycles: Cycle[];
  strength_source: "drums" | "mix";
};

export type Onset = {
  t: number;
  strength: number;
  cycle: number | null;
  beat: number | null;
  sub: number;
  offset_ms: number;
};

export type Song = {
  slug: string;
  meta: Meta;
  layers: Record<string, string>;
};

async function json<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.json();
}

export type Form = {
  id: string;
  label: string;
  accents: number[];
  weak?: number[];
  offbeats?: boolean;
  count_start: number;
  explain: string;
  sources: string[];
};

export type Palo = {
  id: string;
  name: string;
  family: string;
  cycle_len: number | null;
  accents: number[] | null;
  count_start: number;
  tempo_bpm: [number, number] | null;
  default_bpm?: number;
  status: string;
  summary?: string;
  forms?: Form[];
};

// The published build has no Python server: `flamenco-study export-static` writes these endpoints as .json files.
const API_EXT = import.meta.env.VITE_STATIC === "1" ? ".json" : "";

export const fetchSongs = () => json<SongSummary[]>(`api/songs${API_EXT}`);
export const fetchPalos = () => json<Palo[]>(`api/palos${API_EXT}`);
export const fetchSong = (slug: string) => json<Song>(`api/songs/${slug}${API_EXT}`);
export const fetchGrid = (slug: string) => json<Grid>(`songs/${slug}/analysis/grid.json`);
export const fetchOnsets = (slug: string, layer: string) =>
  json<Onset[]>(`songs/${slug}/analysis/onsets-${layer}.json`);

/** Study guide for a palo (estudio/<id>.md), or null when none has been written yet. */
export async function fetchGuide(id: string): Promise<string | null> {
  const res = await fetch(`estudio/${id}.md`);
  // The dev server answers unknown paths with index.html, so a 200 isn't enough.
  if (!res.ok || (res.headers.get("content-type") ?? "").includes("text/html")) return null;
  return res.text();
}
