// src/editor/extensions/revisionMark.ts
import { Mark, mergeAttributes } from "@tiptap/core";
import type { RevisionColor, RevisionOp } from "../../types/screenplay";
import { REVISION_HEX } from "../../types/screenplay";

export const RevisionMark = Mark.create({
  name: "revision",
  addAttributes() {
    return {
      color: { default: "blue" },
      op: { default: "insert" },
    };
  },
  parseHTML() {
    return [{ tag: "span[data-revision]" }];
  },
  renderHTML({ HTMLAttributes }) {
    const { color, op } = HTMLAttributes as { color: RevisionColor; op: RevisionOp };
    const bg = REVISION_HEX[color] ?? "#dbeafe";
    const style =
      op === "delete"
        ? `text-decoration:line-through;opacity:0.6;background:${bg}`
        : `background:${bg}`;
    return ["span", mergeAttributes(HTMLAttributes, { "data-revision": true, style }), 0];
  },
});
