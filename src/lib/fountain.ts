import { Fountain } from 'fountain-js'

type TNode = { type: string; content?: TNode[]; text?: string; attrs?: Record<string, any> }
type TDoc = { type: 'doc'; content: TNode[] }

function nodeText(node: TNode): string {
  if (node.text) return node.text
  return (node.content ?? []).map(nodeText).join('')
}

export function tiptapToFountain(doc: TDoc): string {
  const lines: string[] = []
  for (const node of doc.content) {
    const text = nodeText(node)
    switch (node.type) {
      case 'sceneHeading':
        lines.push('', text.toUpperCase(), '')
        break
      case 'action':
        lines.push(text, '')
        break
      case 'character':
        lines.push('', text.toUpperCase())
        break
      case 'dialogue':
        lines.push(text, '')
        break
      case 'parenthetical':
        lines.push(`(${text.replace(/^\(|\)$/g, '')})`)
        break
      case 'transition':
        lines.push('', `> ${text}`, '')
        break
      case 'section': {
        const level = node.attrs?.level ?? 1
        lines.push('#'.repeat(level) + ' ' + text)
        break
      }
      case 'screenplayNote':
        lines.push(`[[ ${text} ]]`)
        break
    }
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

export function fountainToTiptap(source: string): TDoc {
  const parsed = new Fountain().parse(source, true)
  const content: TNode[] = []

  for (const token of parsed.tokens ?? []) {
    const text = (token.text ?? '').replace(/<[^>]+>/g, '')
    switch (token.type) {
      case 'scene_heading':
        content.push({ type: 'sceneHeading', content: [{ type: 'text', text }] })
        break
      case 'action':
        content.push({ type: 'action', content: [{ type: 'text', text }] })
        break
      case 'character':
        content.push({ type: 'character', content: [{ type: 'text', text }] })
        break
      case 'dialogue':
        content.push({ type: 'dialogue', content: [{ type: 'text', text }] })
        break
      case 'parenthetical':
        content.push({ type: 'parenthetical', content: [{ type: 'text', text }] })
        break
      case 'transition':
        content.push({ type: 'transition', content: [{ type: 'text', text }] })
        break
      case 'section':
        content.push({ type: 'section', attrs: { level: token.depth ?? 1 }, content: [{ type: 'text', text }] })
        break
      case 'note':
        content.push({ type: 'screenplayNote', content: [{ type: 'text', text }] })
        break
    }
  }

  if (content.length === 0) {
    content.push({ type: 'action', content: [{ type: 'text', text: '' }] })
  }
  return { type: 'doc', content }
}
