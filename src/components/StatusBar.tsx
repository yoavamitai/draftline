// src/components/StatusBar.tsx
import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/core";
import { estimatePageCount, estimateWordCount } from "../lib/pageCount";
import { Badge } from "@/components/ui/badge";

interface Props {
  editor: Editor | null;
}

export function StatusBar({ editor }: Props) {
  const [words, setWords] = useState(0);
  const [pages, setPages] = useState(1);
  const [sceneInfo, setSceneInfo] = useState("—");

  useEffect(() => {
    if (!editor) return;

    const onDocUpdate = () => {
      const doc = editor.getJSON();
      setWords(estimateWordCount(doc));
      setPages(estimatePageCount(doc));
    };

    const onSelectionUpdate = () => {
      const { $from } = editor.state.selection;
      let currentScene = 0;
      let totalScenes = 0;
      editor.state.doc.descendants((node: any, pos: number) => {
        if (node.type.name === "sceneHeading") {
          totalScenes++;
          if (pos <= $from.pos) currentScene = totalScenes;
        }
      });
      setSceneInfo(totalScenes ? `Scene ${currentScene} of ${totalScenes}` : "—");
    };

    onDocUpdate();
    onSelectionUpdate();
    editor.on("update", onDocUpdate);
    editor.on("update", onSelectionUpdate);
    editor.on("selectionUpdate", onSelectionUpdate);
    return () => {
      editor.off("update", onDocUpdate);
      editor.off("update", onSelectionUpdate);
      editor.off("selectionUpdate", onSelectionUpdate);
    };
  }, [editor]);

  return (
    <div className="absolute bottom-4 right-4 z-10 flex gap-1.5">
      <Badge variant="secondary">
        ~{pages} {pages === 1 ? "page" : "pages"}
      </Badge>
      <Badge variant="secondary">{words} words</Badge>
      <Badge variant="secondary">{sceneInfo}</Badge>
    </div>
  );
}
