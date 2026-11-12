export type ChordType = "major" | "m" | "6" | "7" | "9" | "m6" | "m7" | "maj7" | "dim" | "aug" | "sus4";
export type Frets = (number | null)[];
export type Tone = { label: string; semis: number; steps: number };
export type LabelMode = "intervals" | "notes" | "none";
export type DiagramString = { fret: number | null; label: string | null; root: boolean };
export type Barre = { fret: number; from: number; to: number };
export type Voicing = { id: string; label: string; frets: Frets; barre: Barre | null; position: number; shape: "open" | "E" | "A" };

const x = null;

/** `steps` is the letter distance from the root (a 3rd is two letters up), so note names spell correctly. */
export const TONES: Record<string, Tone> = Object.fromEntries(
  (
    [
      ["R", 0, 0], ["b2", 1, 1], ["2", 2, 1], ["9", 2, 1], ["b3", 3, 2], ["3", 4, 2], ["4", 5, 3],
      ["#11", 6, 3], ["b5", 6, 4], ["5", 7, 4], ["#5", 8, 4], ["6", 9, 5], ["13", 9, 5], ["b7", 10, 6], ["7", 11, 6],
    ] as [string, number, number][]
  ).map(([label, semis, steps]) => [label, { label, semis, steps }]),
);
const t = (...labels: string[]) => labels.map((l) => TONES[l]);

export type ChordTypeInfo = { id: ChordType; symbol: string; name: string; tones: Tone[] };

export const CHORD_TYPES: ChordTypeInfo[] = [
  { id: "major", symbol: "", name: "Mayor", tones: t("R", "3", "5") },
  { id: "m", symbol: "m", name: "Menor", tones: t("R", "b3", "5") },
  { id: "6", symbol: "6", name: "Sexta", tones: t("R", "3", "5", "6") },
  { id: "7", symbol: "7", name: "Séptima", tones: t("R", "3", "5", "b7") },
  { id: "9", symbol: "9", name: "Novena", tones: t("R", "3", "5", "b7", "9") },
  { id: "m6", symbol: "m6", name: "Menor 6", tones: t("R", "b3", "5", "6") },
  { id: "m7", symbol: "m7", name: "Menor 7", tones: t("R", "b3", "5", "b7") },
  { id: "maj7", symbol: "maj7", name: "Mayor 7", tones: t("R", "3", "5", "7") },
  { id: "dim", symbol: "dim", name: "Disminuido", tones: t("R", "b3", "b5") },
  { id: "aug", symbol: "+", name: "Aumentado", tones: t("R", "3", "#5") },
  { id: "sus4", symbol: "sus4", name: "Suspendido", tones: t("R", "4", "5") },
];

export const typeInfo = (id: ChordType) => CHORD_TYPES.find((c) => c.id === id)!;

/** Open-string pitch classes and MIDI numbers, low E to high e. */
export const OPEN_PC = [4, 9, 2, 7, 11, 4];
export const OPEN_MIDI = [40, 45, 50, 55, 59, 64];

const FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
const MINORISH: ChordType[] = ["m", "m6", "m7", "dim"];

/** Minor-type chords use C# and G# (as printed on the chord chart); the rest use flats. */
export function rootName(pc: number, type: ChordType = "major"): string {
  if (MINORISH.includes(type) && (pc === 1 || pc === 8)) return pc === 1 ? "C#" : "G#";
  return FLAT_NAMES[pc];
}

export const prettyNote = (name: string) => name.replace(/#/g, "♯").replace(/(?<=[A-G])b/g, "♭");
export const chordName = (pc: number, type: ChordType) => prettyNote(rootName(pc, type)) + typeInfo(type).symbol;

const ENHARMONIC: Record<number, { main: string; alt: string }> = {
  1: { main: "C♯", alt: "D♭" }, 3: { main: "E♭", alt: "D♯" }, 6: { main: "F♯", alt: "G♭" },
  8: { main: "A♭", alt: "G♯" }, 10: { main: "B♭", alt: "A♯" },
};

export const ROOT_CHIPS = FLAT_NAMES.map((name, pc) => ({
  pc,
  main: ENHARMONIC[pc]?.main ?? name,
  alt: ENHARMONIC[pc]?.alt ?? null,
}));

const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const NATURAL = [0, 2, 4, 5, 7, 9, 11];

export function spell(root: string, tone: Tone): string {
  const li = LETTERS.indexOf(root[0]);
  const accidental = root.endsWith("#") ? 1 : root.endsWith("b") ? -1 : 0;
  const target = (NATURAL[li] + accidental + tone.semis + 120) % 12;
  const letter = (li + tone.steps) % 7;
  let diff = (((target - NATURAL[letter]) % 12) + 12) % 12;
  if (diff > 6) diff -= 12;
  return LETTERS[letter] + (diff > 0 ? "#".repeat(diff) : "b".repeat(-diff));
}

export function chordNotes(pc: number, type: ChordType): string[] {
  const root = rootName(pc, type);
  return typeInfo(type).tones.map((tone) => prettyNote(spell(root, tone)));
}

export const formula = (type: ChordType) =>
  typeInfo(type).tones.map((tone) => (tone.label === "R" ? "1" : tone.label)).join(" ");

// ---- Movable shapes: fret offsets from the barre, low E to high e. -------------------------

const E_SHAPES: Record<ChordType, Frets> = {
  major: [0, 2, 2, 1, 0, 0], m: [0, 2, 2, 0, 0, 0], "6": [0, 2, 2, 1, 2, 0], "7": [0, 2, 0, 1, 0, 0],
  "9": [0, 2, 0, 1, 0, 2], m6: [0, 2, 2, 0, 2, 0], m7: [0, 2, 0, 0, 0, 0], maj7: [0, 2, 1, 1, 0, 0],
  dim: [0, 1, 2, 0, x, x], aug: [0, 3, 2, 1, 1, 0], sus4: [0, 2, 2, 2, 0, 0],
};
const A_SHAPES: Record<ChordType, Frets> = {
  major: [x, 0, 2, 2, 2, 0], m: [x, 0, 2, 2, 1, 0], "6": [x, 0, 2, 2, 2, 2], "7": [x, 0, 2, 0, 2, 0],
  "9": [x, 0, 2, 4, 2, 3], m6: [x, 0, 2, 2, 1, 2], m7: [x, 0, 2, 0, 1, 0], maj7: [x, 0, 2, 1, 2, 0],
  dim: [x, 0, 1, 2, 1, x], aug: [x, 0, 3, 2, 2, 1], sus4: [x, 0, 2, 2, 3, 0],
};
// The diminished shapes are played with separate fingers, not with a barre.
const NO_BAR: ChordType[] = ["dim"];

/** Open-position voicings that don't come from a movable shape (E and A are the shapes at fret 0). */
const OPEN: Record<number, Partial<Record<ChordType, Frets>>> = {
  0: { major: [x, 3, 2, 0, 1, 0], "6": [x, 3, 2, 2, 1, 0], "7": [x, 3, 2, 3, 1, 0], "9": [x, 3, 2, 3, 3, 0], maj7: [x, 3, 2, 0, 0, 0], aug: [x, 3, 2, 1, 1, 0], sus4: [x, 3, 3, 0, 1, 1] },
  2: { major: [x, x, 0, 2, 3, 2], m: [x, x, 0, 2, 3, 1], "6": [x, x, 0, 2, 0, 2], "7": [x, x, 0, 2, 1, 2], m6: [x, x, 0, 2, 0, 1], m7: [x, x, 0, 2, 1, 1], maj7: [x, x, 0, 2, 2, 2], dim: [x, x, 0, 1, 3, 1], aug: [x, x, 0, 3, 3, 2], sus4: [x, x, 0, 2, 3, 3] },
  5: { major: [x, x, 3, 2, 1, 1], maj7: [x, x, 3, 2, 1, 0] },
  7: { major: [3, 2, 0, 0, 0, 3], "6": [3, 2, 0, 0, 0, 0], "7": [3, 2, 0, 0, 0, 1], maj7: [3, 2, 0, 0, 0, 2], sus4: [3, 3, 0, 0, 1, 3] },
  11: { "7": [x, 2, 1, 2, 0, 2] },
};

const SHAPE_NAME = { E: "Mi", A: "La" } as const;

export function shapeVoicing(shape: "E" | "A", type: ChordType, fret: number): Voicing {
  const offsets = (shape === "E" ? E_SHAPES : A_SHAPES)[type];
  const frets = offsets.map((o) => (o === null ? null : fret + o));
  const zeros = offsets.flatMap((o, i) => (o === 0 ? [i] : []));
  const from = Math.min(...zeros);
  const to = Math.max(...zeros);
  const barre = fret > 0 && from < to && !NO_BAR.includes(type) ? { fret, from, to } : null;
  return {
    id: `${shape}${fret}`,
    label: fret === 0 ? "Abierto" : `Cejilla · forma de ${SHAPE_NAME[shape]} · traste ${fret}`,
    frets,
    barre,
    position: fret,
    shape: fret === 0 ? "open" : shape,
  };
}

/** The fret where a shape's root string must be barred to sound `pc`. */
export const shapeFret = (shape: "E" | "A", pc: number) => (pc - (shape === "E" ? 4 : 9) + 12) % 12;

export function voicings(pc: number, type: ChordType): Voicing[] {
  const list: Voicing[] = [];
  const open = OPEN[pc]?.[type];
  if (open) list.push({ id: "open", label: "Abierto", frets: open, barre: null, position: 0, shape: "open" });
  for (const shape of ["E", "A"] as const) {
    const v = shapeVoicing(shape, type, shapeFret(shape, pc));
    if (v.shape === "open" && open) continue;
    list.push(v);
  }
  // Open first, then the lowest barre: the position players will reach for first.
  return list.sort((a, b) => a.position - b.position);
}

export const bestVoicing = (pc: number, type: ChordType): Voicing =>
  voicings(pc, type).find((v) => v.shape === "open") ??
  voicings(pc, type).reduce((a, b) => (b.position < a.position ? b : a));

/** The barre version with the lowest fret, for teaching how any chord can be moved up the neck. */
export function lowestBarre(pc: number, type: ChordType): Voicing {
  const options = (["E", "A"] as const)
    .map((shape) => shapeVoicing(shape, type, shapeFret(shape, pc)))
    .filter((v) => v.position > 0);
  return options.reduce((a, b) => (b.position < a.position ? b : a));
}

export function describeVoicing(frets: Frets, pc: number, type: ChordType, mode: LabelMode): DiagramString[] {
  const root = rootName(pc, type);
  const tones = typeInfo(type).tones;
  return frets.map((fret, i) => {
    if (fret === null) return { fret, label: null, root: false };
    const semis = (OPEN_PC[i] + fret - pc + 120) % 12;
    const tone = tones.find((tn) => tn.semis === semis);
    const label = !tone || mode === "none" ? null : mode === "notes" ? prettyNote(spell(root, tone)) : tone.label;
    return { fret, label, root: semis === 0 };
  });
}

// ---- Chords of a key (the "key of D" chart). -----------------------------------------------

const DEGREES: { numeral: string; semis: number; steps: number; type: ChordType }[] = [
  { numeral: "I", semis: 0, steps: 0, type: "major" },
  { numeral: "ii", semis: 2, steps: 1, type: "m" },
  { numeral: "iii", semis: 4, steps: 2, type: "m" },
  { numeral: "IV", semis: 5, steps: 3, type: "major" },
  { numeral: "V", semis: 7, steps: 4, type: "major" },
  { numeral: "vi", semis: 9, steps: 5, type: "m" },
  { numeral: "vii°", semis: 11, steps: 6, type: "dim" },
];

export function keyChords(keyPc: number) {
  const key = FLAT_NAMES[keyPc];
  return DEGREES.map((d) => {
    const pc = (keyPc + d.semis) % 12;
    const spelled = spell(key, { label: d.numeral, semis: d.semis, steps: d.steps });
    return { numeral: d.numeral, pc, type: d.type, name: prettyNote(spelled) + typeInfo(d.type).symbol };
  });
}

// ---- Flamenco voicings (from the reference image), with the role of every string. -----------

export type FlamencoChord = {
  id: string;
  name: string;
  root: string;
  rootPc: number;
  frets: Frets;
  tones: (string | null)[];
  barre?: Barre;
  note?: string;
};

export const FLAMENCO: FlamencoChord[] = [
  { id: "e-addb9", name: "E (addb9)", root: "E", rootPc: 4, frets: [0, 2, 3, 1, 0, 0], tones: ["R", "5", "b2", "3", "5", "R"] },
  { id: "fmaj7-s11", name: "Fmaj7(#11)", root: "F", rootPc: 5, frets: [1, 3, 3, 2, 0, 0], tones: ["R", "5", "R", "3", "#11", "7"] },
  { id: "g13", name: "G13", root: "G", rootPc: 7, frets: [3, 2, 0, 0, 0, 0], tones: ["R", "3", "5", "R", "3", "13"], note: "Tal como aparece en la imagen: sin séptima." },
  { id: "a-add9b", name: "A (add9b)", root: "A", rootPc: 9, frets: [null, 0, 2, 3, 2, 0], tones: [null, "R", "5", "b2", "3", "5"] },
  { id: "bb-s11", name: "Bb (#11)", root: "Bb", rootPc: 10, frets: [null, 1, 3, 3, 3, 0], tones: [null, "R", "5", "R", "3", "#11"] },
  { id: "c7-9", name: "C7(9)", root: "C", rootPc: 0, frets: [null, 3, 2, 3, 3, 0], tones: [null, "R", "3", "b7", "2", "3"] },
  { id: "dm", name: "Dm", root: "D", rootPc: 2, frets: [null, null, 0, 2, 3, 1], tones: [null, null, "R", "5", "R", "b3"] },
  { id: "fs-sus4", name: "F#sus4(7addb9)", root: "F#", rootPc: 6, frets: [2, 4, 4, 0, 0, 0], tones: ["R", "5", "R", "b2", "4", "b7"] },
  { id: "bsus4", name: "Bsus4", root: "B", rootPc: 11, frets: [null, 2, 4, 4, 0, 0], tones: [null, "R", "5", "R", "R", "4"] },
  {
    id: "a7sus4", name: "A7sus4", root: "A", rootPc: 9, frets: [5, 7, 5, 7, 5, 5], tones: ["R", "5", "b7", "4", "5", "R"],
    barre: { fret: 5, from: 0, to: 5 },
    note: "Digitación estándar con cejilla en el 5: en la imagen no se leía con claridad.",
  },
];

export function describeFlamenco(chord: FlamencoChord, mode: LabelMode): DiagramString[] {
  return chord.frets.map((fret, i) => {
    const tone = chord.tones[i];
    if (fret === null || tone === null) return { fret: null, label: null, root: false };
    const label = mode === "none" ? null : mode === "notes" ? prettyNote(spell(chord.root, TONES[tone])) : tone;
    return { fret, label, root: tone === "R" };
  });
}

// ---- Flamenco harmony: the modal cadence and its chords (from the structured palo data). -----

export type ChordRef = { pc: number; type: ChordType };
const A: ChordRef = { pc: 9, type: "major" };
const Bb: ChordRef = { pc: 10, type: "major" };
const C9: ChordRef = { pc: 0, type: "9" };

export const FLAMENCO_MODE = {
  degrees: [
    { numeral: "I", chord: A, role: "tónica secundaria" },
    { numeral: "II", chord: Bb, role: "resolutivo" },
    { numeral: "III", chord: C9, role: "medio" },
    { numeral: "IV", chord: { pc: 2, type: "m" as ChordType }, role: "gran tónica" },
    { numeral: "V", chord: { pc: 4, type: "dim" as ChordType }, role: "" },
    { numeral: "VI", chord: { pc: 5, type: "major" as ChordType }, role: "" },
    { numeral: "VII", chord: { pc: 7, type: "m" as ChordType }, role: "semirresolutivo" },
  ],
  cadences: [
    { id: "medio", label: "Por medio · La frigio", chords: [Bb, A] },
    { id: "arriba", label: "Por arriba · Mi frigio", chords: [{ pc: 5, type: "major" as ChordType }, { pc: 4, type: "major" as ChordType }] },
  ],
  progressions: [
    { id: "i-ii-i", label: "I – II – I", chords: [A, Bb, A] },
    { id: "i-ii-iii-ii-i", label: "I – II – III – II – I", chords: [A, Bb, C9, Bb, A] },
    { id: "i-vii-i", label: "I – VII – I", chords: [{ pc: 9, type: "9" as ChordType }, { pc: 7, type: "m7" as ChordType }, { pc: 9, type: "7" as ChordType }] },
    { id: "i-ii-iii-vii-i", label: "I – II – III – VII – I", chords: [{ pc: 9, type: "9" as ChordType }, Bb, C9, { pc: 7, type: "m" as ChordType }, { pc: 9, type: "9" as ChordType }] },
  ],
  sources: [
    "https://www.melodigging.com/genre/buleria",
    "https://guitarcomposerstoolbox.com/es/flamenco/bulerias/",
    "https://www.sibetrans.com/trans/article/32/silvia-calado-olivo-por-bulerias-100-anos-de-compas-flamenco",
  ],
};
