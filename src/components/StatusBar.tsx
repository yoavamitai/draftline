// src/components/StatusBar.tsx
import { useEffect, useState } from "react";
import { estimatePageCount, estimateWordCount } from "../lib/pageCount";

interface Props {
  editor: any;
}

export function StatusBar({ editor }: Props) {
  const [words, setWords] = useState(0);
  const [pages, setPages] = useState(1);
  const [sceneInfo, setSceneInfo] = useState("—");

  useEffect(() => {
    if (!editor) return;

    // Recalculate pages + words only when the document content changes.
    const onDocUpdate = () => {
      const doc = editor.getJSON();
      setWords(estimateWordCount(doc));
      setPages(estimatePageCount(doc));
    };

    // Recalculate current scene position on any selection or doc change.
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
    <div className="h-7 border-t flex items-center px-4 gap-4 text-xs text-muted-foreground shrink-0">
      <span>
        ~{pages} {pages === 1 ? "page" : "pages"}
      </span>
      <span className="text-border">|</span>
      <span>{words} words</span>
      <span className="text-border">|</span>
      <span>{sceneInfo}</span>
    </div>
  );
}
