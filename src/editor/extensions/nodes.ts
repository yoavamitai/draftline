// src/editor/extensions/nodes.ts
import { Node, mergeAttributes } from "@tiptap/core";
import type { BlockType } from "../../types/screenplay";

function makeScreenplayNode(name: BlockType, tag = "p") {
  return Node.create({
    name,
    group: "block",
    content: "inline*",
    parseHTML() {
      return [{ tag: `${tag}[data-type="${name}"]` }];
    },
    renderHTML({ HTMLAttributes }) {
      return [tag, mergeAttributes(HTMLAttributes, { "data-type": name, class: `sp-${name}` }), 0];
    },
    addCommands() {
      return {
        [`set${name.charAt(0).toUpperCase() + name.slice(1)}`]:
          () =>
          ({ commands }: any) =>
            commands.setNode(name),
      } as any;
    },
  });
}

export const SceneHeading = makeScreenplayNode("sceneHeading");
export const Action = makeScreenplayNode("action");
export const Character = makeScreenplayNode("character");
export const Dialogue = makeScreenplayNode("dialogue");
export const Parenthetical = makeScreenplayNode("parenthetical");
export const Transition = makeScreenplayNode("transition");
export const ScreenplayNote = makeScreenplayNode("screenplayNote");

// Section needs a level attribute (1–3 for #, ##, ###)
export const Section = Node.create({
  name: "section",
  group: "block",
  content: "inline*",
  addAttributes() {
    return { level: { default: 1 } };
  },
  parseHTML() {
    return [{ tag: 'p[data-type="section"]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "p",
      mergeAttributes(HTMLAttributes, { "data-type": "section", class: "sp-section" }),
      0,
    ];
  },
  addCommands() {
    return {
      setSection:
        (attrs?: { level: number }) =>
        ({ commands }: any) =>
          commands.setNode("section", attrs),
    } as any;
  },
});

export const allNodes = [
  SceneHeading,
  Action,
  Character,
  Dialogue,
  Parenthetical,
  Transition,
  Section,
  ScreenplayNote,
];
