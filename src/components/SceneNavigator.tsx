// src/components/SceneNavigator.tsx
import { useEffect, useState } from 'react'
import { ScrollArea } from '@/components/ui/scroll-area'

interface Props { editor: any }

interface Scene { title: string; pos: number }

export function SceneNavigator({ editor }: Props) {
  const [scenes, setScenes] = useState<Scene[]>([])

  useEffect(() => {
    if (!editor) return
    const update = () => {
      const found: Scene[] = []
      editor.state.doc.descendants((node: any, pos: number) => {
        if (node.type.name === 'sceneHeading') {
          found.push({ title: node.textContent, pos })
        }
      })
      setScenes(found)
    }
    update()
    editor.on('update', update)
    return () => editor.off('update', update)
  }, [editor])

  const jumpTo = (pos: number) => {
    editor.chain().focus().setTextSelection(pos + 1).run()
    const dom = editor.view.domAtPos(pos + 1)?.node as HTMLElement
    dom?.scrollIntoView?.({ behavior: 'smooth', block: 'center' })
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-2 space-y-0.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1">
          Scenes
        </p>
        {scenes.length === 0 && (
          <p className="text-xs text-muted-foreground px-2 py-1">No scenes yet</p>
        )}
        {scenes.map((s) => (
          <button
            key={`${s.title}-${s.pos}`}
            onClick={() => jumpTo(s.pos)}
            className="w-full text-left text-xs px-2 py-1 rounded hover:bg-accent truncate"
          >
            {s.title}
          </button>
        ))}
      </div>
    </ScrollArea>
  )
}
