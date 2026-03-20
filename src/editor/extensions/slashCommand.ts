// src/editor/extensions/slashCommand.ts
import { Extension } from "@tiptap/core";
import Suggestion from "@tiptap/suggestion";
import type { BlockType } from "../../types/screenplay";

export interface BlockItem {
  type: BlockType;
  label: string;
}

export const BLOCK_TYPES: BlockItem[] = [
  { type: "action", label: "Action" },
  { type: "sceneHeading", label: "Scene Heading" },
  { type: "character", label: "Character" },
  { type: "dialogue", label: "Dialogue" },
  { type: "parenthetical", label: "Parenthetical" },
  { type: "transition", label: "Transition" },
];

export const SlashCommand = Extension.create({
  name: "slashCommand",

  addOptions() {
    return {
      // onOpen receives the anchor rect AND a select callback that properly
      // deletes the "/" and sets the node type via the suggestion's command.
      onOpen: (_rect: DOMRect, _select: (type: BlockType) => void) => {},
      onClose: () => {},
    };
  },

  addProseMirrorPlugins() {
    const { onOpen, onClose } = this.options;
    let itemSelected = false;

    return [
      Suggestion({
        editor: this.editor,
        char: "/",
        allowSpaces: false,
        allow: ({ state, range }) =>
          state.doc.resolve(range.from).parent.textContent.replace("/", "").trim() === "",
        items: () => BLOCK_TYPES,
        render() {
          return {
            onStart(props) {
              itemSelected = false;
              const rect = props.clientRect?.() ?? props.decorationNode?.getBoundingClientRect();
              if (rect) {
                // Pass a select callback that routes through the suggestion's own command,
                // which deletes the "/" and sets the node type atomically.
                onOpen(rect as DOMRect, (type: BlockType) => {
                  itemSelected = true;
                  props.command({ type } as BlockItem);
                });
              }
            },
            onExit(props) {
              if (!itemSelected) props.editor.commands.deleteRange(props.range);
              onClose();
            },
          };
        },
        command({ editor, range, props }) {
          itemSelected = true;
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .setNode((props as BlockItem).type)
            .run();
        },
      }),
    ];
  },
});
