import { describe, expect, it } from "vitest";
import { clickLevel, clickSound } from "./metronome";

const bulerias = { accents: [12, 3, 6, 8, 10], weak: undefined };
const alSeis = { accents: [12, 6], weak: [2, 4, 8, 10] };

describe("metronome clicks", () => {
  it("classifies each beat as accent, weak or normal", () => {
    expect(clickLevel(bulerias, 3)).toBe("accent");
    expect(clickLevel(bulerias, 4)).toBe("normal");
    expect(clickLevel(alSeis, 8)).toBe("weak");
    expect(clickLevel(alSeis, 7)).toBe("normal");
  });

  it("gives the count-start beat its own pitch and keeps accents louder than weak beats", () => {
    const start = clickSound(bulerias, 12, 12);
    const accent = clickSound(bulerias, 3, 12);
    expect(start.pitch).toBeGreaterThan(accent.pitch);
    expect(accent.gain).toBeGreaterThan(clickSound(alSeis, 2, 12).gain);
    expect(clickSound(alSeis, 2, 12).gain).toBeGreaterThan(clickSound(alSeis, 7, 12).gain);
  });
});
