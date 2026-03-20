// src/components/Toolbar.tsx
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useAppStore } from '../store/useAppStore'
import { openFile, saveFile } from '../lib/fileManager'
import { Sun, Moon, PanelLeft, Save, GitBranch, FileDown } from 'lucide-react'
import { exportToPdf } from '../lib/pdf'

interface Props { editor: any }

export function Toolbar({ editor }: Props) {
  const { filePath, isDirty, theme, revisionMode,
          toggleTheme, toggleSidebar, toggleRevisionMode } = useAppStore()
  const name = filePath ? filePath.split(/[\\/]/).pop() : 'Untitled'

  return (
    <div className="h-10 border-b flex items-center px-3 gap-2 shrink-0">
      <Button variant="ghost" size="icon" onClick={toggleSidebar}>
        <PanelLeft className="h-4 w-4" />
      </Button>
      <Separator orientation="vertical" className="h-5" />
      <span className="text-sm font-medium truncate max-w-48">
        {name}{isDirty ? ' •' : ''}
      </span>
      <div className="flex-1" />
      <Button variant="ghost" size="sm" onClick={() => openFile(editor)}>Open</Button>
      <Button variant="ghost" size="icon" onClick={() => saveFile(editor)}>
        <Save className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="sm" onClick={() => saveFile(editor, true)}>Save As</Button>
      <Button variant="ghost" size="icon" onClick={() => exportToPdf(editor)}>
        <FileDown className="h-4 w-4" />
      </Button>
      <Separator orientation="vertical" className="h-5" />
      <Button variant={revisionMode ? 'secondary' : 'ghost'} size="sm"
              onClick={() => {
                if (!revisionMode) {
                  toggleRevisionMode()
                } else {
                  const name = window.prompt('Name for next revision draft (e.g. "Blue pages"):')
                  if (name) useAppStore.getState().nextRevisionDraft(name)
                }
              }}>
        <GitBranch className="h-4 w-4 mr-1" /> Revisions
      </Button>
      <Button variant="ghost" size="icon" onClick={toggleTheme}>
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
    </div>
  )
}
