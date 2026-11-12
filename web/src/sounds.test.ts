import { describe, expect, it } from "vitest";
import { pickVariant } from "./sounds";

describe("choosing a recording", () => {
  it("always plays the only one there is", () => {
    expect(pickVariant(1, undefined)).toBe(0);
    expect(pickVariant(1, 0)).toBe(0);
  });

  it("never repeats the hit that just played", () => {
    for (let last = 0; last < 4; last++) {
      for (let r = 0; r < 1; r += 0.05) expect(pickVariant(4, last, () => r)).not.toBe(last);
    }
  });

  it("can reach every other variant", () => {
    const seen = new Set<number>();
    for (let r = 0; r < 1; r += 0.01) seen.add(pickVariant(4, 2, () => r));
    expect([...seen].sort()).toEqual([0, 1, 3]);
  });

  it("starts anywhere when nothing has played yet", () => {
    expect(pickVariant(3, undefined, () => 0)).toBe(0);
    expect(pickVariant(3, undefined, () => 0.99)).toBe(2);
  });
});
