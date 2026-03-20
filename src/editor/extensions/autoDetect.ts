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

          // Compute the combined changed range in the new document so we only
          // scan nodes near the edit instead of walking the whole document.
          let changedFrom = newState.doc.content.size;
          let changedTo = 0;
          for (const tx of transactions) {
            if (!tx.docChanged) continue;
            tx.mapping.maps.forEach((stepMap) => {
              stepMap.forEach((_oldFrom, _oldTo, newFrom, newTo) => {
                changedFrom = Math.min(changedFrom, newFrom);
                changedTo = Math.max(changedTo, newTo);
              });
            });
          }
          if (changedFrom > changedTo) return null;

          const tr = newState.tr;
          let changed = false;
          newState.doc.nodesBetween(changedFrom, changedTo, (node, pos) => {
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
