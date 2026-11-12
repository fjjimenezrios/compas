export type Question = {
  id: string;
  palo: string;
  type: "choice" | "beats";
  q: string;
  options?: string[];
  /** Index of the right option, or the right beats. */
  answer: number | number[];
  cycle_len?: number;
  /** Id of the palo's form the metronome plays to check the answer. */
  form?: string;
  explain: string;
  source: string;
};

export type Given = number | number[] | null;

export function isCorrect(q: Question, given: Given): boolean {
  if (given === null) return false;
  if (q.type === "choice") return given === q.answer;
  const right = q.answer as number[];
  const chosen = Array.isArray(given) ? given : [];
  return chosen.length === right.length && right.every((b) => chosen.includes(b));
}

export function shuffle<T>(items: T[], random: () => number = Math.random): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export const summarize = (results: Record<string, boolean>) => {
  const values = Object.values(results);
  return { correct: values.filter(Boolean).length, total: values.length };
};

/** What to say about the chosen beats once the answer is checked: which were missing and which were extra. */
export function beatsFeedback(right: number[], chosen: number[]) {
  return {
    missing: right.filter((b) => !chosen.includes(b)).sort((a, b) => a - b),
    extra: chosen.filter((b) => !right.includes(b)).sort((a, b) => a - b),
  };
}

export async function fetchQuiz(): Promise<Question[]> {
  const res = await fetch("estudio/quiz.json");
  if (!res.ok || (res.headers.get("content-type") ?? "").includes("text/html")) return [];
  return res.json();
}
