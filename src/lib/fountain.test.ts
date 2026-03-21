import { describe, it, expect } from "vitest";
import { tiptapToFountain, fountainToTiptap } from "./fountain";

const SIMPLE_DOC = {
  type: "doc" as const,
  content: [
    { type: "sceneHeading", content: [{ type: "text", text: "INT. COFFEE SHOP - DAY" }] },
    { type: "action", content: [{ type: "text", text: "Sarah sits alone." }] },
    { type: "character", content: [{ type: "text", text: "SARAH" }] },
    { type: "dialogue", content: [{ type: "text", text: "I've been waiting." }] },
    { type: "transition", content: [{ type: "text", text: "CUT TO:" }] },
  ],
};

describe("tiptapToFountain", () => {
  it("serializes scene heading as-is", () => {
    expect(tiptapToFountain(SIMPLE_DOC)).toContain("INT. COFFEE SHOP - DAY");
  });

  it("serializes transition with > prefix", () => {
    expect(tiptapToFountain(SIMPLE_DOC)).toContain("> CUT TO:");
  });

  it("serializes dialogue after character", () => {
    const result = tiptapToFountain(SIMPLE_DOC);
    const lines = result.split("\n");
    const charIdx = lines.findIndex((l) => l.trim() === "SARAH");
    expect(lines[charIdx + 1]).toBe("I've been waiting.");
  });
});

describe("fountainToTiptap", () => {
  it("round-trips a simple document", () => {
    const fountain = tiptapToFountain(SIMPLE_DOC);
    const { doc } = fountainToTiptap(fountain);   // <-- destructure
    const types = doc.content.map((n: any) => n.type);
    expect(types).toContain("sceneHeading");
    expect(types).toContain("action");
    expect(types).toContain("character");
    expect(types).toContain("dialogue");
  });
});

describe("title page — parsing (fountainToTiptap)", () => {
  it("returns empty fields for a file with no title block", () => {
    const source = "\nINT. COFFEE SHOP - DAY\n\nSarah sits.\n";
    const { titlePage } = fountainToTiptap(source);
    expect(titlePage.fields).toEqual([]);
  });

  it("does not treat scene heading with colon as a title key", () => {
    const source = "EXT. PLACE: DAY\n\nAction.\n";
    const { titlePage } = fountainToTiptap(source);
    expect(titlePage.fields).toEqual([]);
  });

  it("parses single-line inline value", () => {
    const source = "Credit: Written by\n\nAction.\n";
    const { titlePage } = fountainToTiptap(source);
    expect(titlePage.fields).toEqual([{ key: "Credit", values: ["Written by"] }]);
  });

  it("parses multi-line indented values (4-space)", () => {
    const source = "Contact:\n    123 Main St\n    LA, CA\n\nAction.\n";
    const { titlePage } = fountainToTiptap(source);
    expect(titlePage.fields).toContainEqual({ key: "Contact", values: ["123 Main St", "LA, CA"] });
  });

  it("parses multi-line indented values (3-space)", () => {
    const source = "Contact:\n   123 Main St\n   LA, CA\n\nAction.\n";
    const { titlePage } = fountainToTiptap(source);
    expect(titlePage.fields).toContainEqual({ key: "Contact", values: ["123 Main St", "LA, CA"] });
  });

  it("parses multi-line indented values (tab)", () => {
    const source = "Contact:\n\t123 Main St\n\tLA, CA\n\nAction.\n";
    const { titlePage } = fountainToTiptap(source);
    expect(titlePage.fields).toContainEqual({ key: "Contact", values: ["123 Main St", "LA, CA"] });
  });

  it("parses a full title block with all standard keys", () => {
    const source = [
      "Title:",
      "    MY SCREENPLAY",
      "Credit: Written by",
      "Author: Jane Smith",
      "Draft date: 3/21/2026",
      "Contact:",
      "    123 Main St",
      "    LA, CA",
      "",
      "INT. OFFICE - DAY",
    ].join("\n");
    const { titlePage, doc } = fountainToTiptap(source);
    expect(titlePage.fields.find((f) => f.key === "Title")?.values).toEqual(["MY SCREENPLAY"]);
    expect(titlePage.fields.find((f) => f.key === "Author")?.values).toEqual(["Jane Smith"]);
    expect(doc.content[0].type).toBe("sceneHeading");
  });

  it("preserves unknown custom keys", () => {
    const source = "Notes: WGA #12345\n\nAction.\n";
    const { titlePage } = fountainToTiptap(source);
    expect(titlePage.fields).toContainEqual({ key: "Notes", values: ["WGA #12345"] });
  });
});
