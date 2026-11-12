import { marked } from "marked";

export type Section = { title: string; id: string; html: string };

export const slug = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function renderMarkdown(md: string): string {
  // marked always emits `<a href=`; the guides only link to external sources, so all open in a new tab.
  return (marked.parse(md, { async: false }) as string).replaceAll(
    "<a href=",
    '<a target="_blank" rel="noopener noreferrer" href=',
  );
}

/** One section per `## ` heading; `###` and deeper stay inside their section. */
export function splitSections(md: string): Section[] {
  const sections: { title: string; lines: string[] }[] = [];
  let fenced = false;
  for (const line of md.split("\n")) {
    if (line.startsWith("```")) fenced = !fenced;
    const heading = !fenced && /^## (.+)/.exec(line);
    if (heading) sections.push({ title: heading[1].trim(), lines: [] });
    else if (sections.length) sections[sections.length - 1].lines.push(line);
  }
  return sections.map((s) => ({ title: s.title, id: slug(s.title), html: renderMarkdown(s.lines.join("\n")) }));
}

/** Sections about the beat and the guitar come first: they are what the practice cards refer to. */
export function prioritize(sections: Section[]): Section[] {
  const key = (s: Section) => (/compás|toque|guitarra/i.test(s.title) ? 0 : 1);
  return [...sections].sort((a, b) => key(a) - key(b));
}
