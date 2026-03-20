// src/editor/extensions/autoDetect.ts
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

const SCENE_HEADING_RE = /^(INT\.|EXT\.|INT\.\/EXT\.|I\/E\.)/i;
const CHARACTER_RE = /^[A-Z][A-Z0-9 '\-()]{0,39}$/;

export const AutoDetect = Extension.create({
  name: "autoDetect",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("autoDetect"),
        appendTransaction(transactions, _oldState, newState) {
          if (!transactions.some((tr) => tr.docChanged)) return null;
          const tr = newState.tr;
          let changed = false;
          newState.doc.descendants((node, pos) => {
            const text = node.textContent.trim();
            if (!node.isBlock || !text) return;
            const currentType = node.type.name;
            if (SCENE_HEADING_RE.test(text) && currentType !== "sceneHeading") {
              tr.setNodeMarkup(pos, newState.schema.nodes.sceneHeading);
              changed = true;
            } else if (
              CHARACTER_RE.test(text) &&
              !text.endsWith(":") &&
              !/[.?!]/.test(text) &&
              currentType === "action"
            ) {
              tr.setNodeMarkup(pos, newState.schema.nodes.character);
              changed = true;
            }
          });
          return changed ? tr : null;
        },
      }),
    ];
  },
});
