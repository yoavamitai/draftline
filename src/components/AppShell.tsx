// src/components/AppShell.tsx
import { useState, useEffect } from "react";
import type { Editor } from "@tiptap/core";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { StatusBar } from "./StatusBar";
import { TitleBar } from "./TitleBar";
import { ScreenplayEditor } from "../editor/ScreenplayEditor";
import { TitlePage } from "./TitlePage";
import { startAutoSave } from "../lib/fileManager";

export function AppShell() {
  const [editor, setEditor] = useState<Editor | null>(null);

  useEffect(() => {
    if (!editor) return;
    const interval = startAutoSave(editor);
    return () => clearInterval(interval);
  }, [editor]);

  return (
    <div className="flex flex-col h-full">
      <SidebarProvider className="flex-1 min-h-0">
        <AppSidebar editor={editor} />
        <SidebarInset className="relative flex flex-col overflow-hidden">
          <div
            className="flex items-center justify-between px-2 py-1 shrink-0"
            data-tauri-drag-region
          >
            <SidebarTrigger />
            <TitleBar />
          </div>
          <div className="flex-1 overflow-y-auto bg-background py-2">
            <TitlePage editor={editor} />
            <ScreenplayEditor onEditorReady={setEditor} />
          </div>
          <StatusBar editor={editor} />
        </SidebarInset>
      </SidebarProvider>
    </div>
  );
}
