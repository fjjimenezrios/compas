import { describe, expect, it } from "vitest";
import { parseRoute } from "./App";

describe("routes", () => {
  it("maps hashes to sections", () => {
    expect(parseRoute("")).toEqual({ view: "library" });
    expect(parseRoute("#")).toEqual({ view: "library" });
    expect(parseRoute("#doc")).toEqual({ view: "docs", id: undefined });
    expect(parseRoute("#doc/bulerias")).toEqual({ view: "docs", id: "bulerias" });
    expect(parseRoute("#metronomo/tangos")).toEqual({ view: "metronome", id: "tangos" });
    expect(parseRoute("#alfileres-de-colores")).toEqual({ view: "song", slug: "alfileres-de-colores" });
  });
});
