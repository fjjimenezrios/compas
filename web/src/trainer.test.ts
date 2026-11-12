import { describe, expect, it } from "vitest";
import { beatAdvice, buildTargets, describeOffset, evaluateTaps, matchWindow, nearestTarget } from "./trainer";

// A 12-beat cycle at 250 ms per beat, counted from 12, with the first beat of the song being the 12.
const order = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const grid = { beats: Array.from({ length: 36 }, (_, i) => 1 + i * 0.25), first_start: 0, order, cycle_len: 12 };
const ACCENTS = [3, 6, 8, 10, 12];

describe("targets", () => {
  it("numbers the beats from the grid and keeps the accents inside the range", () => {
    const all = buildTargets(grid, ACCENTS);
    expect(all.slice(0, 5).map((t) => t.beat)).toEqual([12, 3, 6, 8, 10]);
    expect(all).toHaveLength(15);
    // 1 s..4 s covers the whole first bar and the 12 that opens the second one
    expect(buildTargets(grid, ACCENTS, 1, 4).map((t) => t.beat)).toEqual([12, 3, 6, 8, 10, 12]);
  });

  it("follows a grid whose first bar starts a few beats in", () => {
    // first_start 3: the song begins three beats before the first full bar, so beat 0 is the 10 of the previous one
    const shifted = { ...grid, first_start: 3 };
    expect(buildTargets(shifted, ACCENTS).slice(0, 3).map((t) => t.beat)).toEqual([10, 12, 3]);
  });

  it("sizes the window to the pulse", () => {
    expect(matchWindow(grid.beats)).toBeCloseTo(0.1125);
    expect(matchWindow([0, 1, 2, 3])).toBe(0.2);
  });
});

describe("evaluating taps", () => {
  const targets = buildTargets(grid, ACCENTS, 0, 4); // 12, 3, 6, 8, 10 in the first bar + the next 12
  const win = 0.11;

  it("scores perfect palmas", () => {
    const ev = evaluateTaps(targets.map((t) => t.time), targets, win);
    expect(ev.hitRate).toBe(1);
    expect(ev.meanMs).toBe(0);
    expect(ev.missed).toHaveLength(0);
    expect(ev.extra).toHaveLength(0);
  });

  it("measures being late and early, with sign", () => {
    expect(evaluateTaps(targets.map((t) => t.time + 0.05), targets, win).meanMs).toBe(50);
    expect(evaluateTaps(targets.map((t) => t.time - 0.04), targets, win).meanMs).toBe(-40);
  });

  it("reports missed accents and extra palmas", () => {
    const taps = [targets[0].time, targets[2].time, 1.6]; // skips the 3, and 1.6 is nowhere near an accent
    const ev = evaluateTaps(taps, targets, win);
    expect(ev.matches.map((m) => m.beat)).toEqual([12, 6]);
    expect(ev.missed.map((t) => t.beat)).toEqual(expect.arrayContaining([3, 8, 10]));
    expect(ev.extra).toEqual([1.6]);
    expect(ev.hitRate).toBeCloseTo(2 / targets.length);
  });

  it("never lets one tap count for two accents", () => {
    const ev = evaluateTaps([targets[1].time], targets, 1);
    expect(ev.matches).toHaveLength(1);
  });

  it("summarises each beat", () => {
    const taps = targets.map((t) => t.time + (t.beat === 8 ? -0.04 : 0));
    const ev = evaluateTaps(taps, targets, win);
    expect(ev.perBeat.find((b) => b.beat === 8)).toMatchObject({ hits: 1, total: 1, meanMs: -40 });
    expect(ev.perBeat.find((b) => b.beat === 12)).toMatchObject({ hits: 2, total: 2, meanMs: 0 });
  });
});

describe("wording", () => {
  it("says it the way a teacher would", () => {
    expect(beatAdvice(8, -40)).toBe("Vas adelantado 40 ms en el 8");
    expect(beatAdvice(6, 55)).toBe("Vas retrasado 55 ms en el 6");
    expect(beatAdvice(3, 10)).toBe("Vas justo en el 3");
    expect(beatAdvice(10, null)).toBe("No palmeaste el 10");
    expect(describeOffset(-60)).toBe("60 ms adelantado");
    expect(describeOffset(12)).toBe("justo");
    expect(describeOffset(90)).toBe("90 ms tarde");
  });

  it("finds the accent a tap was aiming at", () => {
    const targets = buildTargets(grid, ACCENTS, 0, 4);
    expect(nearestTarget(targets[1].time + 0.03, targets, 0.11)).toMatchObject({ target: { beat: 3 }, offsetMs: 30 });
    expect(nearestTarget(1.6, targets, 0.11)).toBeNull();
  });
});
