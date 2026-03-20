// src/editor/extensions/pageBreaks.ts
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

const LINES_PER_PAGE = 55;

function blockLineCount(textLength: number): number {
  const charPerLine = 60;
  return Math.max(1, Math.ceil(textLength / charPerLine)) + 1;
}

const pageBreaksKey = new PluginKey("pageBreaks");

export const PageBreaks = Extension.create({
  name: "pageBreaks",

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: pageBreaksKey,
        props: {
          decorations(state) {
            const decorations: Decoration[] = [];
            let lineCount = 0;

            state.doc.forEach((node, offset) => {
              const lines = blockLineCount(node.textContent.length);
              const pageBefore = Math.floor(lineCount / LINES_PER_PAGE);
              const pageAfter = Math.floor((lineCount + lines) / LINES_PER_PAGE);

              if (pageAfter > pageBefore) {
                const pageNumber = pageAfter + 1;
                const widget = document.createElement("div");
                widget.className = "page-break-marker";
                const label = document.createElement("span");
                label.textContent = `PAGE ${pageNumber}`;
                widget.appendChild(label);
                decorations.push(
                  Decoration.widget(offset, widget, {
                    side: -1,
                    key: `pb-${pageAfter}`,
                  }),
                );
              }

              lineCount += lines;
            });

            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});
