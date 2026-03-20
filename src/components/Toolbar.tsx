// src/components/Toolbar.tsx
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAppStore } from "../store/useAppStore";
import { openFile, saveFile, renameScript } from "../lib/fileManager";
import { Sun, Moon, PanelLeft, Save, SaveAll, FolderOpen, GitBranch, FileDown } from "lucide-react";
import { exportToPdf } from "../lib/pdf";
import { useState, useRef, useEffect } from "react";

interface Props {
  editor: any;
}

export function Toolbar({ editor }: Props) {
  const {
    filePath,
    scriptName,
    isDirty,
    theme,
    revisionMode,
    toggleTheme,
    toggleSidebar,
    toggleRevisionMode,
  } = useAppStore();
  const displayName = filePath
    ? filePath
        .split(/[\\/]/)
        .pop()!
        .replace(/\.fountain$/i, "")
    : scriptName;

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  function startEditing() {
    setDraft(displayName);
    setEditing(true);
  }

  useEffect(() => {
    if (editing) inputRef.current?.select();
  }, [editing]);

  async function commitEdit() {
    setEditing(false);
    const name = draft.trim();
    if (name && name !== displayName) await renameScript(name);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.currentTarget.blur();
    } else if (e.key === "Escape") {
      setEditing(false);
    }
  }

  return (
    <div className="h-10 border-b flex items-center px-3 gap-2 shrink-0">
      <Button variant="ghost" size="icon" onClick={toggleSidebar}>
        <PanelLeft className="h-4 w-4" />
      </Button>
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={onKeyDown}
          className="text-sm font-medium bg-transparent border-b border-border outline-none max-w-48 truncate"
        />
      ) : (
        <span
          className="text-sm font-medium truncate max-w-48 cursor-text hover:opacity-70 transition-opacity"
          onClick={startEditing}
        >
          {displayName}
          {isDirty ? " •" : ""}
        </span>
      )}
      <div className="flex-1" />
      <Button variant="ghost" size="icon" title="Open" onClick={() => openFile(editor)}>
        <FolderOpen className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" title="Save" onClick={() => saveFile(editor)}>
        <Save className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" title="Save As" onClick={() => saveFile(editor, true)}>
        <SaveAll className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" title="Export PDF" onClick={() => exportToPdf(editor)}>
        <FileDown className="h-4 w-4" />
      </Button>
      <Separator orientation="vertical" className="h-full" />
      <Button
        variant={revisionMode ? "secondary" : "ghost"}
        size="icon"
        title="Revisions"
        onClick={() => {
          if (!revisionMode) {
            toggleRevisionMode();
          } else {
            const name = window.prompt('Name for next revision draft (e.g. "Blue pages"):');
            if (name) useAppStore.getState().nextRevisionDraft(name);
          }
        }}
      >
        <GitBranch className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={toggleTheme}>
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
    </div>
  );
}
