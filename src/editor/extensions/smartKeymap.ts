// src/editor/extensions/smartKeymap.ts
import { Extension } from "@tiptap/core";

const TAB_MAP: Record<string, string> = {
  sceneHeading: "action",
  action: "character",
  character: "parenthetical",
  dialogue: "character",
  parenthetical: "dialogue",
  transition: "action",
};

const ENTER_MAP: Record<string, string> = {
  character: "dialogue",
  dialogue: "action",
};

export const SmartKeymap = Extension.create({
  name: "smartKeymap",
  addKeyboardShortcuts() {
    return {
      Tab: ({ editor }) => {
        const { $from } = editor.state.selection;
        const nodeType = $from.parent.type.name;
        const next = TAB_MAP[nodeType];
        if (!next) return false;
        return editor.chain().focus().setNode(next).run();
      },
      Enter: ({ editor }) => {
        const { $from } = editor.state.selection;
        const nodeType = $from.parent.type.name;
        const next = ENTER_MAP[nodeType];
        if (!next) return false;
        return editor.chain().focus().splitBlock().setNode(next).run();
      },
    };
  },
});
