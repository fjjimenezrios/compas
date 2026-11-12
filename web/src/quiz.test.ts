import { describe, expect, it } from "vitest";
import { beatsFeedback, isCorrect, shuffle, summarize, type Question } from "./quiz";

const choice: Question = { id: "c", palo: "bulerias", type: "choice", q: "?", options: ["a", "b", "c"], answer: 1, explain: "", source: "" };
const beats: Question = { id: "b", palo: "bulerias", type: "beats", q: "?", answer: [12, 3, 6], cycle_len: 12, explain: "", source: "" };

describe("quiz", () => {
  it("checks a multiple-choice answer", () => {
    expect(isCorrect(choice, 1)).toBe(true);
    expect(isCorrect(choice, 0)).toBe(false);
    expect(isCorrect(choice, null)).toBe(false);
  });

  it("checks a beats answer whatever the order, and needs exactly the right ones", () => {
    expect(isCorrect(beats, [3, 6, 12])).toBe(true);
    expect(isCorrect(beats, [3, 6])).toBe(false);
    expect(isCorrect(beats, [3, 6, 12, 8])).toBe(false);
    expect(isCorrect(beats, [])).toBe(false);
  });

  it("says what was missing and what was extra", () => {
    expect(beatsFeedback([12, 3, 6], [3, 8])).toEqual({ missing: [6, 12], extra: [8] });
    expect(beatsFeedback([12, 3, 6], [3, 6, 12])).toEqual({ missing: [], extra: [] });
  });

  it("shuffles without losing or repeating questions", () => {
    const list = Array.from({ length: 20 }, (_, i) => i);
    const out = shuffle(list, () => 0.3);
    expect([...out].sort((a, b) => a - b)).toEqual(list);
    expect(list[0]).toBe(0); // the original is untouched
  });

  it("counts the score", () => {
    expect(summarize({ a: true, b: false, c: true })).toEqual({ correct: 2, total: 3 });
    expect(summarize({})).toEqual({ correct: 0, total: 0 });
  });
});
