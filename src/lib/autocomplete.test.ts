import { describe, it, expect } from "vitest";
import { filterSuggestions, getSceneHeadingPrefixSuggestions, getTimeOfDaySuggestions, TIME_OF_DAY } from "./autocomplete";
import type { DocEntry } from "./autocomplete";

describe("filterSuggestions", () => {
  it("returns entries matching prefix, sorted by frequency", () => {
    const entries: DocEntry[] = [
      { text: "JOHN", pos: 1 },
      { text: "JANE", pos: 10 },
      { text: "JOHN", pos: 20 },
      { text: "JESSICA", pos: 30 },
    ];
    expect(filterSuggestions(entries, "J", 999)).toEqual(["JOHN", "JANE", "JESSICA"]);
  });

  it("excludes the block at the given position", () => {
    const entries: DocEntry[] = [
      { text: "JOHN", pos: 1 },
      { text: "JOHN", pos: 10 },
    ];
    // Excluding pos=10 leaves one JOHN at pos=1 — still suggested
    expect(filterSuggestions(entries, "J", 10)).toEqual(["JOHN"]);
  });

  it("returns empty array when query is empty", () => {
    const entries: DocEntry[] = [{ text: "JOHN", pos: 1 }];
    expect(filterSuggestions(entries, "", 999)).toEqual([]);
  });

  it("returns empty array when query is only whitespace", () => {
    const entries: DocEntry[] = [{ text: "JOHN", pos: 1 }];
    expect(filterSuggestions(entries, "   ", 999)).toEqual([]);
  });

  it("is case-insensitive", () => {
    const entries: DocEntry[] = [{ text: "INT. OFFICE - DAY", pos: 1 }];
    expect(filterSuggestions(entries, "int.", 999)).toEqual(["INT. OFFICE - DAY"]);
  });

  it("excludes entries that do not match the prefix", () => {
    const entries: DocEntry[] = [
      { text: "JOHN", pos: 1 },
      { text: "ALICE", pos: 10 },
    ];
    expect(filterSuggestions(entries, "A", 999)).toEqual(["ALICE"]);
  });

  it("respects the limit", () => {
    const entries: DocEntry[] = Array.from({ length: 10 }, (_, i) => ({
      text: `CHAR_${i}`,
      pos: i * 10,
    }));
    expect(filterSuggestions(entries, "C", 999, 3)).toHaveLength(3);
  });

  it("excludes by position so two blocks with same name both count except the excluded one", () => {
    const entries: DocEntry[] = [
      { text: "JOHN", pos: 1 },
      { text: "JOHN", pos: 10 },
    ];
    // Exclude pos=1; pos=10 still contributes frequency 1 → JOHN is still suggested
    expect(filterSuggestions(entries, "J", 1)).toEqual(["JOHN"]);
  });

  it("skips blank text entries", () => {
    const entries: DocEntry[] = [
      { text: "", pos: 1 },
      { text: "   ", pos: 10 },
      { text: "JOHN", pos: 20 },
    ];
    expect(filterSuggestions(entries, "J", 999)).toEqual(["JOHN"]);
  });
});

describe("getSceneHeadingPrefixSuggestions", () => {
  it("returns matching static prefixes before doc entries", () => {
    const entries: DocEntry[] = [
      { text: "INT. OFFICE - DAY", pos: 10 },
    ];
    const result = getSceneHeadingPrefixSuggestions("INT", entries, 999);
    expect(result[0]).toBe("INT.");
    expect(result).toContain("INT./EXT.");
    expect(result).toContain("INT. OFFICE - DAY");
    expect(result.indexOf("INT.")).toBeLessThan(result.indexOf("INT. OFFICE - DAY"));
  });

  it("returns only static matches when no doc entries match", () => {
    const entries: DocEntry[] = [
      { text: "EXT. PARK - DAY", pos: 10 },
    ];
    const result = getSceneHeadingPrefixSuggestions("INT", entries, 999);
    expect(result).toContain("INT.");
    expect(result).toContain("INT./EXT.");
    expect(result).not.toContain("EXT. PARK - DAY");
  });

  it("deduplicates case-insensitively, keeping static form", () => {
    const entries: DocEntry[] = [
      { text: "int.", pos: 10 },
    ];
    const result = getSceneHeadingPrefixSuggestions("INT", entries, 999);
    expect(result).toContain("INT.");
    expect(result).not.toContain("int.");
    expect(result.filter(r => r.toLowerCase() === "int.")).toHaveLength(1);
  });

  it("caps total result at limit", () => {
    const entries: DocEntry[] = Array.from({ length: 20 }, (_, i) => ({
      text: `INT. ROOM_${i} - DAY`,
      pos: i * 10,
    }));
    const result = getSceneHeadingPrefixSuggestions("INT", entries, 999, 5);
    expect(result).toHaveLength(5);
  });

  it("returns empty when query does not match anything", () => {
    const entries: DocEntry[] = [{ text: "INT. OFFICE - DAY", pos: 10 }];
    expect(getSceneHeadingPrefixSuggestions("XYZ", entries, 999)).toEqual([]);
  });
});

describe("getTimeOfDaySuggestions", () => {
  it("filters TIME_OF_DAY by case-insensitive prefix match", () => {
    expect(getTimeOfDaySuggestions("D")).toContain("DAY");
    expect(getTimeOfDaySuggestions("D")).toContain("DAWN");
    expect(getTimeOfDaySuggestions("D")).not.toContain("NIGHT");
    expect(getTimeOfDaySuggestions("d")).toContain("DAY");
  });

  it("returns full TIME_OF_DAY list when query is empty", () => {
    expect(getTimeOfDaySuggestions("")).toEqual(TIME_OF_DAY);
  });

  it("returns full TIME_OF_DAY list when query is whitespace only", () => {
    expect(getTimeOfDaySuggestions("   ")).toEqual(TIME_OF_DAY);
  });

  it("returns empty array when non-empty query matches nothing", () => {
    expect(getTimeOfDaySuggestions("XYZ")).toEqual([]);
  });

  it("matches multi-word entries by prefix", () => {
    expect(getTimeOfDaySuggestions("MOM")).toContain("MOMENTS LATER");
    expect(getTimeOfDaySuggestions("moments")).toContain("MOMENTS LATER");
  });
});
