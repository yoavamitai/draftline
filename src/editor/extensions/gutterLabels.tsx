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

// Pre-render SVGs once at module load — not per decoration.
const GUTTER_SVGS: Record<string, string> = Object.fromEntries(
  Object.entries(GUTTER_BLOCKS).map(([type, { icon, text }]) => [
    type,
    `${renderToStaticMarkup(icon)} ${text} ▾`,
  ]),
);

function createLabel(type: string, onOpen: (rect: DOMRect) => void): HTMLElement {
  const span = document.createElement("span");
  span.className = "gutter-label";
  span.innerHTML = GUTTER_SVGS[type];
  span.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    onOpen(span.getBoundingClientRect());
  });
  return span;
}

function buildDecorations(doc: any, onOpen: (rect: DOMRect) => void): DecorationSet {
  const decos: Decoration[] = [];
  doc.forEach((node: any, pos: number) => {
    if (node.type.name in GUTTER_BLOCKS) {
      decos.push(
        Decoration.widget(pos + 1, () => createLabel(node.type.name, onOpen), { side: -1 }),
      );
    }
  });
  return DecorationSet.create(doc, decos);
}

const gutterLabelsKey = new PluginKey<DecorationSet>("gutterLabels");

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
        key: gutterLabelsKey,
        state: {
          init(_, { doc }) {
            return buildDecorations(doc, onOpen);
          },
          // Only rebuild when the document changes — selection changes are free.
          apply(tr, decorations) {
            return tr.docChanged ? buildDecorations(tr.doc, onOpen) : decorations;
          },
        },
        props: {
          decorations(state) {
            return gutterLabelsKey.getState(state) ?? DecorationSet.empty;
          },
        },
      }),
    ];
  },
});
