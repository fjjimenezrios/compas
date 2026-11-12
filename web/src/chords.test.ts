import { describe, expect, it } from "vitest";
import {
  bestVoicing, CHORD_TYPES, chordName, chordNotes, describeFlamenco, describeVoicing, FLAMENCO, FLAMENCO_MODE, keyChords, lowestBarre,
  OPEN_PC, shapeFret, shapeVoicing, spell, TONES, typeInfo, voicings, type ChordType, type Frets,
} from "./chords";

const pitchClasses = (frets: Frets) =>
  frets.flatMap((f, i) => (f === null ? [] : [(OPEN_PC[i] + f) % 12]));

describe("every voicing in the library sounds the chord it claims to", () => {
  for (const { id, tones } of CHORD_TYPES) {
    // The 5th may be left out of chords with four or more tones, as guitarists do.
    const required = tones.length >= 4 ? tones.filter((tn) => tn.label !== "5") : tones;
    for (let pc = 0; pc < 12; pc++) {
      it(`${pc}:${id}`, () => {
        const list = voicings(pc, id);
        expect(list.length).toBeGreaterThan(0);
        for (const v of list) {
          const pcs = new Set(pitchClasses(v.frets).map((p) => (p - pc + 12) % 12));
          for (const p of pcs) expect(tones.map((tn) => tn.semis), `${v.label} ${v.frets}`).toContain(p);
          for (const tn of required) expect([...pcs], `${v.label} ${v.frets}`).toContain(tn.semis);
        }
      });
    }
  }
});

describe("movable shapes", () => {
  it("puts the barre where the root string sounds the chord", () => {
    expect(shapeFret("E", 0)).toBe(8);
    expect(shapeFret("A", 0)).toBe(3);
    expect(shapeVoicing("E", "major", 8).frets).toEqual([8, 10, 10, 9, 8, 8]);
    expect(shapeVoicing("A", "major", 3).frets).toEqual([null, 3, 5, 5, 5, 3]);
    expect(shapeVoicing("E", "m", 8).barre).toEqual({ fret: 8, from: 0, to: 5 });
  });

  it("draws no barre for open chords or for the diminished shapes", () => {
    expect(shapeVoicing("E", "major", 0).barre).toBeNull();
    expect(shapeVoicing("E", "dim", 3).barre).toBeNull();
  });

  it("orders voicings from the open position up the neck", () => {
    expect(voicings(9, "major").map((v) => v.position)).toEqual([0, 5]);
    expect(voicings(0, "m").map((v) => v.position)).toEqual([3, 8]);
  });

  it("lists open voicings once and prefers them", () => {
    expect(voicings(4, "major").filter((v) => v.shape === "open")).toHaveLength(1);
    expect(bestVoicing(0, "major").frets).toEqual([null, 3, 2, 0, 1, 0]);
    expect(bestVoicing(6, "m").position).toBe(2); // F#m: E shape at fret 2 beats the A shape at 9
    expect(lowestBarre(4, "major").position).toBe(7); // E major as a barre uses the A shape
  });
});

describe("names", () => {
  it("spells notes from the root", () => {
    expect(spell("Bb", TONES["3"])).toBe("D");
    expect(spell("F#", TONES["3"])).toBe("A#");
    expect(spell("C", TONES.b3)).toBe("Eb");
    expect(chordNotes(1, "m")).toEqual(["C♯", "E", "G♯"]);
    expect(chordNotes(1, "major")).toEqual(["D♭", "F", "A♭"]);
    expect(chordNotes(0, "7")).toEqual(["C", "E", "G", "B♭"]);
  });

  it("labels fretted notes by interval or by note name", () => {
    const frets = bestVoicing(0, "major").frets;
    expect(describeVoicing(frets, 0, "major", "intervals").map((s) => s.label)).toEqual([null, "R", "3", "5", "R", "3"]);
    expect(describeVoicing(frets, 0, "major", "notes").map((s) => s.label)).toEqual([null, "C", "E", "G", "C", "E"]);
    expect(describeVoicing(frets, 0, "major", "none").every((s) => s.label === null)).toBe(true);
  });

  it("builds the chords of a key", () => {
    expect(keyChords(2).map((c) => c.name)).toEqual(["D", "Em", "F♯m", "G", "A", "Bm", "C♯dim"]);
    expect(keyChords(10).map((c) => c.name)).toEqual(["B♭", "Cm", "Dm", "E♭", "F", "Gm", "Adim"]);
  });

  it("has 11 chord types, each with a spelled formula", () => {
    expect(CHORD_TYPES).toHaveLength(11);
    expect(typeInfo("sus4" as ChordType).tones.map((tn) => tn.label)).toEqual(["R", "4", "5"]);
  });
});

describe("flamenco harmony", () => {
  it("names the degrees of A Phrygian", () => {
    expect(FLAMENCO_MODE.degrees.map((d) => chordName(d.chord.pc, d.chord.type))).toEqual(["A", "B♭", "C9", "Dm", "Edim", "F", "Gm"]);
  });

  it("builds the cadences and progressions from real chords", () => {
    const name = (cs: { pc: number; type: ChordType }[]) => cs.map((c) => chordName(c.pc, c.type)).join(" – ");
    expect(name(FLAMENCO_MODE.cadences[0].chords)).toBe("B♭ – A");
    expect(name(FLAMENCO_MODE.cadences[1].chords)).toBe("F – E");
    expect(FLAMENCO_MODE.progressions.map((p) => name(p.chords))).toEqual([
      "A – B♭ – A", "A – B♭ – C9 – B♭ – A", "A9 – Gm7 – A7", "A9 – B♭ – C9 – Gm – A9",
    ]);
    for (const c of [...FLAMENCO_MODE.cadences, ...FLAMENCO_MODE.progressions].flatMap((p) => p.chords)) {
      expect(bestVoicing(c.pc, c.type).frets.some((f) => f !== null)).toBe(true);
    }
  });
});

describe("flamenco chords", () => {
  const semis: Record<string, number> = Object.fromEntries(Object.values(TONES).map((tn) => [tn.label, tn.semis]));
  for (const c of FLAMENCO) {
    it(`${c.name}: every string's role matches the frets`, () => {
      c.frets.forEach((fret, i) => {
        if (fret === null) return expect(c.tones[i]).toBeNull();
        expect((OPEN_PC[i] + fret - c.rootPc + 120) % 12, `string ${6 - i}`).toBe(semis[c.tones[i]!]);
      });
    });
  }

  it("spells the notes of E(addb9)", () => {
    const e = FLAMENCO.find((c) => c.id === "e-addb9")!;
    expect(describeFlamenco(e, "notes").map((s) => s.label)).toEqual(["E", "B", "F", "G♯", "B", "E"]);
    expect(describeFlamenco(e, "intervals").filter((s) => s.root)).toHaveLength(2);
  });

  it("spells the notes of Bb(#11)", () => {
    const bb = FLAMENCO.find((c) => c.id === "bb-s11")!;
    expect(describeFlamenco(bb, "notes").map((s) => s.label)).toEqual([null, "B♭", "F", "B♭", "D", "E"]);
  });
});
