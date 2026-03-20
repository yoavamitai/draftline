// src/editor/ScreenplayEditor.tsx
import { useEditor, EditorContent } from "@tiptap/react";
import { Document } from "@tiptap/extension-document";
import { Text } from "@tiptap/extension-text";
import { History } from "@tiptap/extension-history";
import { Placeholder } from "@tiptap/extension-placeholder";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import { allNodes } from "./extensions/nodes";
import { SmartKeymap } from "./extensions/smartKeymap";
import { AutoDetect } from "./extensions/autoDetect";
import { RevisionMark } from "./extensions/revisionMark";
import { SlashCommand } from "./extensions/slashCommand";
import { GutterLabels } from "./extensions/gutterLabels";
import { PageBreaks } from "./extensions/pageBreaks";
import { BlockPicker } from "../components/BlockPicker";
import { useAppStore } from "../store/useAppStore";
import type { BlockType } from "../types/screenplay";

interface Props {
  onEditorReady?: (editor: Editor) => void;
}

export function ScreenplayEditor({ onEditorReady }: Props) {
  const setDirty = useAppStore((s) => s.setDirty);
  const [pickerAnchor, setPickerAnchor] = useState<{ x: number; y: number } | null>(null);
  // When the picker is opened via slash command, this ref holds the suggestion's
  // select callback (which deletes "/" and sets the node). Null when opened via gutter label.
  const slashSelectRef = useRef<((type: BlockType) => void) | null>(null);

  const handleOpen = useCallback((rect: DOMRect, slashSelect?: (type: BlockType) => void) => {
    slashSelectRef.current = slashSelect ?? null;
    setPickerAnchor({ x: rect.left, y: rect.bottom + 4 });
  }, []);

  const handleClose = useCallback(() => {
    slashSelectRef.current = null;
    setPickerAnchor(null);
  }, []);

  const editor = useEditor({
    extensions: [
      Document,
      Text,
      History,
      ...allNodes,
      SmartKeymap,
      AutoDetect,
      RevisionMark,
      Placeholder.configure({ placeholder: "Start your script…" }),
      SlashCommand.configure({ onOpen: handleOpen, onClose: handleClose }),
      GutterLabels.configure({ onOpen: handleOpen }),
      PageBreaks,
    ],
    content: {
      type: "doc",
      content: [{ type: "action", content: [] }],
    },
    onUpdate({ editor, transaction }) {
      setDirty(true);
      const { revisionMode, revisionColor } = useAppStore.getState();
      if (!revisionMode || !transaction.docChanged) return;
      transaction.steps.forEach((step: any) => {
        if (step.slice?.content?.size > 0) {
          const from = step.from;
          const to = step.from + step.slice.content.size;
          editor
            .chain()
            .setTextSelection({ from, to })
            .setMark("revision", { color: revisionColor, op: "insert" })
            .setTextSelection(to)
            .run();
        }
      });
    },
  });

  const handleSelect = useCallback(
    (type: BlockType) => {
      if (slashSelectRef.current) {
        // Slash path: suggestion's command deletes "/" and sets the node type.
        slashSelectRef.current(type);
        slashSelectRef.current = null;
      } else {
        // Gutter label path: just change the node type, no "/" to clean up.
        editor?.chain().focus().setNode(type).run();
      }
      setPickerAnchor(null);
    },
    [editor],
  );

  const editorRef = useRef<Editor | null>(null);
  editorRef.current = editor ?? null;

  useEffect(() => {
    if (editor && onEditorReady) onEditorReady(editor);
  }, [editor, onEditorReady]);

  return (
    <div className="screenplay-page">
      <EditorContent editor={editor} />
      <BlockPicker
        open={pickerAnchor !== null}
        anchor={pickerAnchor}
        onSelect={handleSelect}
        onClose={handleClose}
      />
    </div>
  );
}
