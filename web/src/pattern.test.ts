import { describe, expect, it } from "vitest";
import type { Onset } from "./api";
import {
  accentBeats,
  averagePattern,
  displayOrder,
  METER_FAMILIES,
  meterMatches,
  templateCorrelation,
} from "./pattern";

const onset = (beat: number | null, sub: number, strength = 1, cycle = 0): Onset => ({
  t: 0, strength, cycle, beat, sub, offset_ms: 0,
});

describe("pattern", () => {
  it("starts the count on 12 for bulerías", () => {
    expect(displayOrder(12, 12)).toEqual([12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    expect(displayOrder(4, 1)).toEqual([1, 2, 3, 4]);
  });

  it("averages the strongest hit of each bar, ignoring onsets outside the grid", () => {
    const p = averagePattern(
      [onset(3, 0, 1, 0), onset(3, 0, 0.4, 0), onset(3, 0, 0.6, 1), onset(3, 1, 0.5, 0), onset(null, 0)],
      12, 2, 2,
    );
    expect(p[2][0]).toBeCloseTo(0.8); // (1 + 0.6) / 2: the extra 0.4 hit in bar 0 doesn't count
    expect(p[2][1]).toBeCloseTo(0.25);
    expect(p[0]).toEqual([0, 0]);
  });

  it("doesn't let a busy beat outweigh an accented one", () => {
    // beat 1: three soft hits per bar; beat 2: one strong hit per bar
    const busy = [0, 1].flatMap((c) => [onset(1, 0, 0.3, c), onset(1, 0, 0.3, c), onset(1, 0, 0.3, c), onset(2, 0, 0.9, c)]);
    const p = averagePattern(busy, 4, 1, 2);
    expect(p[1][0]).toBeGreaterThan(p[0][0]);
  });

  it("ranks a 3-3-3-3 pattern as ternario whatever the count start", () => {
    const onBeat = Array.from({ length: 12 }, (_, i) => ((i + 2) % 3 === 0 ? 1 : 0.2));
    const [best] = meterMatches(onBeat);
    expect(best.family.id).toBe("ternario");
    expect(best.corr).toBeCloseTo(1);
    expect(accentBeats(best.family, 12, best.rotation)).toEqual([2, 5, 8, 11]);
  });

  it("rotating moves every accent by one beat", () => {
    const ternario = METER_FAMILIES.find((f) => f.id === "ternario")!;
    expect(accentBeats(ternario, 12, 0)).toEqual([3, 6, 9, 12]);
    expect(accentBeats(ternario, 12, -1)).toEqual([1, 4, 7, 10]);
    expect(accentBeats(ternario, 12, 1)).toEqual([2, 5, 8, 11]);
  });

  it("scores a perfect bulería skeleton as 1", () => {
    const accents = [3, 6, 8, 10, 12];
    const p = averagePattern(accents.map((b) => onset(b, 0)), 12, 2, 1);
    expect(templateCorrelation(p, accents)).toBeCloseTo(1);
    expect(templateCorrelation(p, null)).toBeNull();
  });
});
