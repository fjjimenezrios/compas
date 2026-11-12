import { describe, expect, it } from "vitest";
import { isDrifting, orderTracks, presetSelection, selectionLabel, toggleTrack } from "./tracks";

describe("tracks", () => {
  it("lists the mix first and unknown layers last", () => {
    expect(orderTracks(["other", "vocals", "guitarra", "original", "drums"])).toEqual(["original", "drums", "vocals", "other", "guitarra"]);
  });

  it("builds the quick selections", () => {
    const tracks = orderTracks(["original", "drums", "guitar", "bass"]);
    expect(presetSelection("mix", tracks)).toEqual(["original"]);
    expect(presetSelection("stems", tracks)).toEqual(["drums", "guitar", "bass"]);
    expect(presetSelection("none", tracks)).toEqual([]);
    expect(presetSelection("mix", ["drums", "bass"])).toEqual(["drums"]);
    expect(presetSelection("stems", ["original"])).toEqual(["original"]);
  });

  it("only re-syncs a layer that has really drifted", () => {
    expect(isDrifting(10, 10.04)).toBe(false);
    expect(isDrifting(10, 10.2)).toBe(true);
    expect(isDrifting(10, 9.8)).toBe(true);
  });

  it("lets layers combine but keeps the full mix apart from them", () => {
    expect(toggleTrack(["original"], "drums")).toEqual(["drums"]);
    expect(toggleTrack(["drums"], "guitar")).toEqual(["drums", "guitar"]);
    expect(toggleTrack(["drums", "guitar"], "original")).toEqual(["original"]);
    expect(toggleTrack(["drums", "guitar"], "drums")).toEqual(["guitar"]);
    expect(toggleTrack(["drums"], "drums")).toEqual([]);
  });

  it("summarises the selection for the button", () => {
    expect(selectionLabel([])).toBe("Elegir pistas");
    expect(selectionLabel(["original"])).toBe("Mezcla original");
    expect(selectionLabel(["drums", "guitar"])).toBe("Palmas y percusión + Guitarra");
    expect(selectionLabel(["drums", "guitar", "bass"])).toBe("3 pistas");
  });
});
