// src/components/AppSidebar.tsx
import { useRef, useState, useEffect } from "react";
import type { Editor } from "@tiptap/core";
import { Sidebar, SidebarContent, SidebarHeader } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { useAppStore } from "../store/useAppStore";
import { useShallow } from "zustand/react/shallow";
import { openFile, saveFile, renameScript } from "../lib/fileManager";
import { exportToPdf } from "../lib/pdf";
import { FolderOpen, Save, SaveAll, FileDown, GitBranch, Sun, Moon } from "lucide-react";
import { SceneNavigator } from "./SceneNavigator";

interface Props {
  editor: Editor | null;
}

export function AppSidebar({ editor }: Props) {
  const { filePath, scriptName, isDirty, theme, revisionMode, toggleTheme, toggleRevisionMode } =
    useAppStore(
      useShallow((s) => ({
        filePath: s.filePath,
        scriptName: s.scriptName,
        isDirty: s.isDirty,
        theme: s.theme,
        revisionMode: s.revisionMode,
        toggleTheme: s.toggleTheme,
        toggleRevisionMode: s.toggleRevisionMode,
      })),
    );

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
    if (e.key === "Enter") e.currentTarget.blur();
    else if (e.key === "Escape") setEditing(false);
  }

  function handleRevision() {
    if (!revisionMode) {
      toggleRevisionMode();
    } else {
      const name = window.prompt('Name for next revision draft (e.g. "Blue pages"):');
      if (name) useAppStore.getState().nextRevisionDraft(name);
    }
  }

  return (
    <Sidebar collapsible="offcanvas" variant="floating">
      <SidebarHeader className="gap-2 p-3">
        {editing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={onKeyDown}
            className="text-lg font-medium bg-transparent border-b border-border outline-none w-full truncate"
          />
        ) : (
          <span
            className="text-lg font-medium truncate cursor-text hover:opacity-70 transition-opacity"
            onClick={startEditing}
          >
            {displayName}
            {isDirty ? " •" : ""}
          </span>
        )}
        <div className="flex flex-wrap gap-1">
          <Button variant="ghost" size="icon" title="Open" onClick={() => openFile(editor)}>
            <FolderOpen className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" title="Save" onClick={() => saveFile(editor)}>
            <Save className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Save As"
            onClick={() => saveFile(editor, true)}
          >
            <SaveAll className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="Export PDF"
            onClick={() => exportToPdf(editor)}
          >
            <FileDown className="h-4 w-4" />
          </Button>
          <Button
            variant={revisionMode ? "secondary" : "ghost"}
            size="icon"
            title="Revisions"
            onClick={handleRevision}
          >
            <GitBranch className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title={theme === "dark" ? "Switch to light" : "Switch to dark"}
            onClick={toggleTheme}
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SceneNavigator editor={editor} />
      </SidebarContent>
    </Sidebar>
  );
}
