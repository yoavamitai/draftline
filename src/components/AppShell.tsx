// src/components/AppShell.tsx
import { useState, useEffect } from 'react'
import { Toolbar } from './Toolbar'
import { SceneNavigator } from './SceneNavigator'
import { StatusBar } from './StatusBar'
import { ScreenplayEditor } from '../editor/ScreenplayEditor'
import { useAppStore } from '../store/useAppStore'
import { startAutoSave } from '../lib/fileManager'

export function AppShell() {
  const sidebarOpen = useAppStore((s) => s.sidebarOpen)
  const [editor, setEditor] = useState<any>(null)

  useEffect(() => {
    if (!editor) return
    const interval = startAutoSave(editor)
    return () => clearInterval(interval)
  }, [editor])

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      <Toolbar editor={editor} />
      <div className="flex flex-1 overflow-hidden">
        {sidebarOpen && (
          <div className="w-52 border-r shrink-0 overflow-hidden">
            <SceneNavigator editor={editor} />
          </div>
        )}
        <div className="flex-1 overflow-y-auto bg-background">
          <ScreenplayEditor onEditorReady={setEditor} />
        </div>
      </div>
      <StatusBar editor={editor} />
    </div>
  )
}
