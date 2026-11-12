import { describe, expect, it } from "vitest";
import { prioritize, slug, splitSections } from "./study";

const md = [
  "## Qué es",
  "Texto [fuente](https://example.com).",
  "## El compás",
  "```",
  "## no es un título",
  "```",
  "### Subapartado",
  "## El toque (guitarra)",
  "Acordes.",
].join("\n");

describe("study guides", () => {
  it("splits on level-2 headings only and ignores fenced code", () => {
    expect(splitSections(md).map((s) => s.title)).toEqual(["Qué es", "El compás", "El toque (guitarra)"]);
    expect(splitSections(md)[1].html).toContain("no es un título");
  });

  it("opens external links in a new tab safely", () => {
    expect(splitSections(md)[0].html).toContain('target="_blank"');
    expect(splitSections(md)[0].html).toContain("noopener");
  });

  it("puts the beat and guitar sections first, keeping the rest in order", () => {
    const titles = prioritize(splitSections(md)).map((s) => s.title);
    expect(titles).toEqual(["El compás", "El toque (guitarra)", "Qué es"]);
  });

  it("makes ascii ids from accented titles", () => {
    expect(slug("Tipos y variantes: el compás")).toBe("tipos-y-variantes-el-compas");
  });
});
