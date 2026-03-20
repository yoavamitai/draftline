// src/editor/extensions/gutterLabels.tsx
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { renderToStaticMarkup } from "react-dom/server";
import { Pilcrow, Clapperboard, ArrowRight } from "lucide-react";
import type { ReactElement } from "react";

const GUTTER_BLOCKS: Record<string, { icon: ReactElement; text: string }> = {
  action: { icon: <Pilcrow size={12} />, text: "ACTION" },
  sceneHeading: { icon: <Clapperboard size={12} />, text: "SCENE" },
  transition: { icon: <ArrowRight size={12} />, text: "TRANS" },
};

function createLabel(type: string, onOpen: (rect: DOMRect) => void): HTMLElement {
  const span = document.createElement("span");
  span.className = "gutter-label";
  const { icon, text } = GUTTER_BLOCKS[type];
  span.innerHTML = `${renderToStaticMarkup(icon)} ${text} ▾`;
  span.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    onOpen(span.getBoundingClientRect());
  });
  return span;
}

export const GutterLabels = Extension.create({
  name: "gutterLabels",

  addOptions() {
    return {
      onOpen: (_rect: DOMRect) => {},
    };
  },

  addProseMirrorPlugins() {
    const { onOpen } = this.options;

    return [
      new Plugin({
        key: new PluginKey("gutterLabels"),
        props: {
          decorations(state) {
            const decos: Decoration[] = [];
            state.doc.forEach((node, pos) => {
              if (node.type.name in GUTTER_BLOCKS) {
                decos.push(
                  Decoration.widget(pos + 1, () => createLabel(node.type.name, onOpen), {
                    side: -1,
                  }),
                );
              }
            });
            return DecorationSet.create(state.doc, decos);
          },
        },
      }),
    ];
  },
});
