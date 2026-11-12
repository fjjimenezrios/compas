import { describe, expect, it } from "vitest";
import { hitsForBeat, isRemateCycle, nextBpm, PALMAS_Y_CAJON, type CajonMap, type Remate, type SoundSet } from "./rhythm";

const order = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
type F = { accents: number[]; weak?: number[] };
const tradicional: F = { accents: [12, 3, 6, 8, 10] };
const alSeis: F = { accents: [12, 6], weak: [2, 4, 8, 10] };
const cajon: CajonMap = { "3": "G", "6": "G", "8": "A", "10": "A", "12": "G" };
const remate: Remate = { beats: [10, 11, 12], cajon: { "10": "A", "11": "A", "12": "G" } };
const kinds = (beat: number, form = tradicional, sounds: SoundSet = PALMAS_Y_CAJON, remateCycle = false) =>
  hitsForBeat({ form, beat, order, sounds, cajon, remate, remateCycle }).map((h) => h.kind);

describe("palmas and cajón", () => {
  it("follows the bulería cajón pattern: g g G | g g G | g A | g A | g G", () => {
    expect(kinds(3)).toEqual(["clap", "bass"]);
    expect(kinds(6)).toEqual(["clap", "bass"]);
    expect(kinds(8)).toEqual(["clap", "slap"]);
    expect(kinds(10)).toEqual(["clap", "slap"]);
    expect(kinds(12)).toEqual(["clap", "bass"]);
    expect(kinds(4)).toEqual(["ghost"]);
    expect(kinds(1)).toEqual(["ghost"]);
  });

  it("plays only what is switched on", () => {
    expect(kinds(3, tradicional, { click: false, palmas: true, cajon: false })).toEqual(["clap"]);
    expect(kinds(4, tradicional, { click: false, palmas: true, cajon: false })).toEqual([]);
    expect(kinds(3, tradicional, { click: true, palmas: false, cajon: false })).toEqual([]);
  });

  it("puts the remate hits on its beats only in a remate bar", () => {
    expect(kinds(10, tradicional, PALMAS_Y_CAJON, true)).toEqual(["clap", "slap"]);
    expect(kinds(11, tradicional, PALMAS_Y_CAJON, true)).toEqual(["clap", "slap"]);
    expect(kinds(11, tradicional, PALMAS_Y_CAJON, false)).toEqual(["ghost"]);
    expect(kinds(12, tradicional, PALMAS_Y_CAJON, true)).toEqual(["clap", "bass"]);
  });

  it("uses a generic cajón when the form's accents don't fit the palo's pattern", () => {
    // counted at the 6: 12 and 6 are the accents, the first one in the count gets the bass
    expect(kinds(12, alSeis)).toEqual(["clap", "bass"]);
    expect(kinds(6, alSeis)).toEqual(["clap", "slap"]);
    expect(kinds(2, alSeis)).toEqual(["clapSoft", "ghost"]);
    expect(kinds(3, alSeis)).toEqual(["ghost"]);
  });

  it("finds the remate bars", () => {
    expect(isRemateCycle(3, 4)).toBe(true);
    expect(isRemateCycle(0, 4)).toBe(false);
    expect(isRemateCycle(7, 4)).toBe(true);
    expect(isRemateCycle(5, 0)).toBe(false);
  });
});

describe("tempo ramp", () => {
  const ramp = { step: 5, everyCycles: 4, max: 220 };
  it("rises by the step every N bars", () => {
    expect(nextBpm(200, 4, ramp)).toBe(205);
    expect(nextBpm(205, 8, ramp)).toBe(210);
    expect(nextBpm(200, 3, ramp)).toBe(200);
    expect(nextBpm(200, 0, ramp)).toBe(200);
  });
  it("never passes the maximum, nor lowers a tempo already above it", () => {
    expect(nextBpm(218, 4, ramp)).toBe(220);
    expect(nextBpm(230, 4, ramp)).toBe(230);
  });
  it("does nothing without a ramp", () => {
    expect(nextBpm(200, 4, null)).toBe(200);
  });
});
