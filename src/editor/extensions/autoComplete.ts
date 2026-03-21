// src/editor/extensions/autoComplete.ts
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import {
  filterSuggestions,
  getSceneHeadingPrefixSuggestions,
  getTimeOfDaySuggestions,
} from "../../lib/autocomplete";
import type { DocEntry } from "../../lib/autocomplete";

const autoCompleteKey = new PluginKey("autoComplete");

export interface AutoCompleteOptions {
  /** Called on every transaction when eligible. Supersedes any previous call — replace all state including `select` and reset `activeIndex` to 0. */
  onOpen: (rect: DOMRect, items: string[], select: (text: string) => void) => void;
  /** Called on open→closed transition only. Must be idempotent (no-op when already closed). */
  onClose: () => void;
  /** Tell React to move the active index. */
  onNavigate: (direction: "up" | "down") => void;
  /** Tell React to accept the currently active item. */
  onSelect: () => void;
}

export const AutoComplete = Extension.create<AutoCompleteOptions>({
  name: "autoComplete",

  addOptions() {
    return {
      onOpen: () => {},
      onClose: () => {},
      onNavigate: () => {},
      onSelect: () => {},
    };
  },

  // isOpen is shared between the ProseMirror plugin and keyboard shortcuts.
  addStorage() {
    return { isOpen: false };
  },

  // IMPORTANT: this extension must be registered BEFORE SmartKeymap in the
  // extensions array so that Tab/Enter have higher priority here.
  addKeyboardShortcuts() {
    return {
      Tab: () => {
        if (!this.storage.isOpen) return false;
        this.options.onSelect();
        return true;
      },
      Enter: () => {
        if (!this.storage.isOpen) return false;
        this.options.onSelect();
        return true;
      },
      Escape: () => {
        if (!this.storage.isOpen) return false;
        this.storage.isOpen = false; // set BEFORE onClose to guard against re-entry
        this.options.onClose();
        return true;
      },
      ArrowDown: () => {
        if (!this.storage.isOpen) return false;
        this.options.onNavigate("down");
        return true;
      },
      ArrowUp: () => {
        if (!this.storage.isOpen) return false;
        this.options.onNavigate("up");
        return true;
      },
    };
  },

  addProseMirrorPlugins() {
    // Capture extension instance so the plugin closure can access storage + options.
    const ext = this;

    return [
      new Plugin({
        key: autoCompleteKey,
        view() {
          return {
            update(view) {
              const { state } = view;
              const { $from } = state.selection;
              const blockType = $from.parent.type.name;

              // Only active in character and sceneHeading blocks.
              if (blockType !== "character" && blockType !== "sceneHeading") {
                if (ext.storage.isOpen) {
                  ext.storage.isOpen = false;
                  ext.options.onClose();
                }
                return;
              }

              const currentText = $from.parent.textContent;
              if (!currentText.trim()) {
                if (ext.storage.isOpen) {
                  ext.storage.isOpen = false;
                  ext.options.onClose();
                }
                return;
              }

              // Collect all top-level nodes of the matching type.
              // state.doc.forEach iterates direct children (all screenplay blocks
              // are flat children of the document node).
              const currentBlockStart = $from.start() - 1; // position of the block node itself
              const entries: DocEntry[] = [];
              state.doc.forEach((node, pos) => {
                if (node.type.name === blockType) {
                  entries.push({ text: node.textContent, pos });
                }
              });

              // --- Mode branching for scene headings ---
              let items: string[];
              let select: (text: string) => void;

              if (blockType === "sceneHeading" && currentText.includes(" - ")) {
                // TIME MODE: cursor is in the time-of-day portion (after " - ")
                const dashIdx = currentText.lastIndexOf(" - ");
                const timeQuery = currentText.slice(dashIdx + 3); // text after " - "
                items = getTimeOfDaySuggestions(timeQuery);

                // select replaces only the suffix (everything after " - "), re-reading state at call time.
                select = (text: string) => {
                  ext.editor
                    .chain()
                    .focus()
                    .command(({ tr, state }) => {
                      const { $from: f } = state.selection;
                      if (f.parent.type.name !== "sceneHeading") return false;
                      const blockText = f.parent.textContent;
                      const idx = blockText.lastIndexOf(" - ");
                      if (idx === -1) return false; // block was edited — no-op
                      const preserved = blockText.slice(0, idx + 3); // keep up to and including " - "
                      tr.insertText(preserved + text, f.start(), f.end());
                      return true;
                    })
                    .run();
                };
              } else if (blockType === "sceneHeading") {
                // PREFIX MODE: cursor is in the prefix/location portion (no " - " yet)
                items = getSceneHeadingPrefixSuggestions(currentText, entries, currentBlockStart);

                // select replaces the full block text (existing behavior).
                select = (text: string) => {
                  ext.editor
                    .chain()
                    .focus()
                    .command(({ tr, state }) => {
                      const { $from: f } = state.selection;
                      if (f.parent.type.name !== "sceneHeading") return false;
                      // Use $from.start() / $from.end() — NOT selection.from / selection.to.
                      tr.insertText(text, f.start(), f.end());
                      return true;
                    })
                    .run();
                };
              } else {
                // CHARACTER MODE (and any future block types): document-based suggestions only.
                items = filterSuggestions(entries, currentText, currentBlockStart);

                select = (text: string) => {
                  ext.editor
                    .chain()
                    .focus()
                    .command(({ tr, state }) => {
                      const { $from: f } = state.selection;
                      if (f.parent.type.name !== blockType) return false;
                      tr.insertText(text, f.start(), f.end());
                      return true;
                    })
                    .run();
                };
              }
              // --- End mode branching ---

              if (items.length === 0) {
                if (ext.storage.isOpen) {
                  ext.storage.isOpen = false;
                  ext.options.onClose();
                }
                return;
              }

              // Get the DOM element of the current block for positioning.
              // view.domAtPos(pos + 1) resolves to a position inside the node's content
              // and is more reliable than view.nodeDOM() for block-level elements.
              const domResult = view.domAtPos(currentBlockStart + 1);
              const blockDom =
                domResult.node instanceof HTMLElement
                  ? domResult.node
                  : (domResult.node.parentElement as HTMLElement | null);
              if (!blockDom) return;
              const rect = blockDom.getBoundingClientRect();

              ext.storage.isOpen = true;
              ext.options.onOpen(rect, items, select);
            },
          };
        },
      }),
    ];
  },
});
