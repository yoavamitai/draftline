// src/editor/ScreenplayEditor.tsx
import { useEditor, EditorContent } from '@tiptap/react'
import { Document } from '@tiptap/extension-document'
import { Text } from '@tiptap/extension-text'
import { History } from '@tiptap/extension-history'
import { useEffect } from 'react'
import { allNodes } from './extensions/nodes'
import { SmartKeymap } from './extensions/smartKeymap'
import { AutoDetect } from './extensions/autoDetect'
import { RevisionMark } from './extensions/revisionMark'
import { useAppStore } from '../store/useAppStore'

interface Props {
  onEditorReady?: (editor: any) => void
}

export function ScreenplayEditor({ onEditorReady }: Props) {
  const setDirty = useAppStore((s) => s.setDirty)

  const editor = useEditor({
    extensions: [
      Document,
      Text,
      History,
      ...allNodes,
      SmartKeymap,
      AutoDetect,
      RevisionMark,
    ],
    content: {
      type: 'doc',
      content: [{ type: 'action', content: [] }],
    },
    onUpdate: () => setDirty(true),
  })

  useEffect(() => {
    if (editor && onEditorReady) onEditorReady(editor)
  }, [editor])

  return (
    <div className="screenplay-page">
      <EditorContent editor={editor} />
    </div>
  )
}
