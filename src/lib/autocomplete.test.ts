import { describe, it, expect } from "vitest";
import { filterSuggestions } from "./autocomplete";
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
