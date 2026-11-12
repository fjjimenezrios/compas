import { CHORD_TYPES, voicings } from "../web/src/chords";

const unique = new Set<string>();
for (let pc = 0; pc < 12; pc++)
  for (const type of CHORD_TYPES)
    for (const v of voicings(pc, type.id)) unique.add(v.frets.map((f) => f ?? "x").join("-"));
console.log(JSON.stringify([...unique]));
