import { describe, it, expect } from "vitest";
import { estimatePageCount, estimateWordCount } from "./pageCount";

describe("estimatePageCount", () => {
  it("returns 1 for a short doc", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "sceneHeading", content: [{ type: "text", text: "INT. ROOM - DAY" }] },
        { type: "action", content: [{ type: "text", text: "Short scene." }] },
      ],
    };
    expect(estimatePageCount(doc as any)).toBe(1);
  });
});

describe("estimateWordCount", () => {
  it("counts words across all blocks", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "action", content: [{ type: "text", text: "Hello world" }] },
        { type: "dialogue", content: [{ type: "text", text: "How are you" }] },
      ],
    };
    expect(estimateWordCount(doc as any)).toBe(5);
  });
});
