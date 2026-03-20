import { describe, it, expect } from "vitest";
import { encodeRevisionMark, decodeRevisionMark } from "./revision";

describe("revision mark encoding", () => {
  it("encodes an insert mark", () => {
    const mark = encodeRevisionMark("blue", "insert", "hello");
    expect(mark).toBe("[[REV:color=blue;op=insert]]hello[[/REV]]");
  });

  it("decodes a mark back", () => {
    const mark = "[[REV:color=pink;op=delete]]goodbye[[/REV]]";
    const result = decodeRevisionMark(mark);
    expect(result).toEqual({ color: "pink", op: "delete", text: "goodbye" });
  });
});
