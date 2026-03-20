import { describe, it, expect } from 'vitest'
import { tiptapToFountain, fountainToTiptap } from './fountain'

const SIMPLE_DOC = {
  type: 'doc',
  content: [
    { type: 'sceneHeading', content: [{ type: 'text', text: 'INT. COFFEE SHOP - DAY' }] },
    { type: 'action', content: [{ type: 'text', text: 'Sarah sits alone.' }] },
    { type: 'character', content: [{ type: 'text', text: 'SARAH' }] },
    { type: 'dialogue', content: [{ type: 'text', text: "I've been waiting." }] },
    { type: 'transition', content: [{ type: 'text', text: 'CUT TO:' }] },
  ],
}

describe('tiptapToFountain', () => {
  it('serializes scene heading as-is', () => {
    expect(tiptapToFountain(SIMPLE_DOC)).toContain('INT. COFFEE SHOP - DAY')
  })

  it('serializes transition with > prefix', () => {
    expect(tiptapToFountain(SIMPLE_DOC)).toContain('> CUT TO:')
  })

  it('serializes dialogue after character', () => {
    const result = tiptapToFountain(SIMPLE_DOC)
    const lines = result.split('\n')
    const charIdx = lines.findIndex(l => l.trim() === 'SARAH')
    expect(lines[charIdx + 1]).toBe("I've been waiting.")
  })
})

describe('fountainToTiptap', () => {
  it('round-trips a simple document', () => {
    const fountain = tiptapToFountain(SIMPLE_DOC)
    const doc = fountainToTiptap(fountain)
    const types = doc.content.map((n: any) => n.type)
    expect(types).toContain('sceneHeading')
    expect(types).toContain('action')
    expect(types).toContain('character')
    expect(types).toContain('dialogue')
  })
})
