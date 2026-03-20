# Screenwriting App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Tauri desktop screenwriting app with a WYSIWYG screenplay editor, Fountain file I/O, PDF export, scene navigator, revision mode, and dark/light theme.

**Architecture:** A React + TypeScript frontend built on TipTap (ProseMirror) where each screenplay element is a custom block node. The Tauri Rust backend handles native file dialogs and disk I/O. The document lives in TipTap JSON in memory and serializes to `.fountain` on save.

**Tech Stack:** Tauri 2, React 18, TypeScript, TipTap 2, shadcn/ui, Tailwind CSS, Zustand, fountain-js, Vitest, React Testing Library

---

## File Map

| File | Responsibility |
|------|---------------|
| `src/types/screenplay.ts` | All shared TS types: block types, revision marks, app state shape |
| `src/store/useAppStore.ts` | Zustand store: document, filename, theme, revision mode, sidebar state |
| `src/lib/fountain.ts` | Fountain serialize (TipTap JSON → `.fountain`) and deserialize (`.fountain` → TipTap JSON) |
| `src/lib/pageCount.ts` | Estimate page count from TipTap document |
| `src/lib/revision.ts` | Revision color sequence, mark encoding/decoding for Fountain `[[REV:...]]` |
| `src/lib/pdf.ts` | Build HTML screenplay template from doc, invoke Tauri WebView print |
| `src/editor/extensions/nodes.ts` | All custom TipTap Node extensions: SceneHeading, Action, Character, Dialogue, Parenthetical, Transition, Section, ScreenplayNote |
| `src/editor/extensions/autoDetect.ts` | TipTap plugin: auto-promote INT./EXT. lines → SceneHeading, ALL CAPS → Character |
| `src/editor/extensions/smartKeymap.ts` | TipTap plugin: Tab/Enter smart navigation between block types |
| `src/editor/extensions/revisionMark.ts` | TipTap Mark extension for revision highlights and strikethroughs |
| `src/editor/ScreenplayEditor.tsx` | TipTap editor wrapper component; composes all extensions |
| `src/components/BlockTypePicker.tsx` | Context menu (right-click) to manually set block type — **deferred to v2** |
| `src/components/Toolbar.tsx` | Top bar: filename, toggle sidebar, save, export PDF, theme toggle, revision toggle |
| `src/components/SceneNavigator.tsx` | Collapsible left sidebar listing Scene Headings; click to scroll |
| `src/components/StatusBar.tsx` | Bottom bar: estimated page count, word count, current/total scenes |
| `src/components/AppShell.tsx` | Root layout: composes Toolbar + SceneNavigator + ScreenplayEditor + StatusBar |
| `src/App.tsx` | Root React component; theme provider, store init |
| `src/main.tsx` | React entry point |
| `src-tauri/src/main.rs` | Tauri commands: `read_file`, `write_file`, `show_open_dialog`, `show_save_dialog` |

---

## Task 1: Scaffold Project

**Files:**
- Create: `package.json`, `vite.config.ts`, `tailwind.config.ts`, `tsconfig.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src-tauri/tauri.conf.json`, `src-tauri/src/main.rs`

- [ ] **Step 1: Create Tauri app with React + TypeScript template**

```bash
cd C:/Users/yoavd/screenwriting
npm create tauri-app@latest . -- --template react-ts --manager npm --yes
```

Expected: project scaffold created with `src/`, `src-tauri/`, `package.json`.

- [ ] **Step 2: Install frontend dependencies**

```bash
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-document @tiptap/extension-text @tiptap/extension-paragraph @tiptap/extension-history zustand fountain-js
npm install -D vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

- [ ] **Step 3: Install shadcn/ui + Tailwind**

```bash
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npx shadcn@latest init --yes
```

When prompted by shadcn: choose default style, default base color (slate), yes to CSS variables.

- [ ] **Step 4: Add shadcn components we'll use**

```bash
npx shadcn@latest add button tooltip separator scroll-area
```

- [ ] **Step 5: Configure Vitest in `vite.config.ts`**

Add to the existing `vite.config.ts`:
```ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test-setup.ts',
  },
})
```

Create `src/test-setup.ts`:
```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 6: Verify dev server runs**

```bash
npm run tauri dev
```

Expected: Tauri window opens showing the default React scaffold. No errors in console.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: scaffold Tauri + React + TipTap + shadcn/ui project"
```

---

## Task 2: Types

**Files:**
- Create: `src/types/screenplay.ts`

- [ ] **Step 1: Write the types file**

```ts
// src/types/screenplay.ts

export type BlockType =
  | 'sceneHeading'
  | 'action'
  | 'character'
  | 'dialogue'
  | 'parenthetical'
  | 'transition'
  | 'section'
  | 'screenplayNote'

export type RevisionOp = 'insert' | 'delete'

export type RevisionColor =
  | 'white' | 'blue' | 'pink' | 'yellow' | 'green' | 'goldenrod'

export const REVISION_COLOR_SEQUENCE: RevisionColor[] = [
  'white', 'blue', 'pink', 'yellow', 'green', 'goldenrod',
]

export const REVISION_HEX: Record<RevisionColor, string> = {
  white:     '#ffffff',
  blue:      '#dbeafe',
  pink:      '#fce7f3',
  yellow:    '#fef9c3',
  green:     '#dcfce7',
  goldenrod: '#fef3c7',
}

export interface AppState {
  filePath: string | null
  isDirty: boolean
  theme: 'dark' | 'light'
  sidebarOpen: boolean
  revisionMode: boolean
  revisionColor: RevisionColor
  revisionDraftName: string
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/screenplay.ts
git commit -m "feat: add screenplay TypeScript types"
```

---

## Task 3: Zustand Store

**Files:**
- Create: `src/store/useAppStore.ts`
- Test: `src/store/useAppStore.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/store/useAppStore.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useAppStore } from './useAppStore'

describe('useAppStore', () => {
  beforeEach(() => {
    useAppStore.setState(useAppStore.getInitialState())
  })

  it('starts with no file, clean, dark theme', () => {
    const { result } = renderHook(() => useAppStore())
    expect(result.current.filePath).toBeNull()
    expect(result.current.isDirty).toBe(false)
    expect(result.current.theme).toBe('dark')
  })

  it('toggles theme', () => {
    const { result } = renderHook(() => useAppStore())
    act(() => result.current.toggleTheme())
    expect(result.current.theme).toBe('light')
    act(() => result.current.toggleTheme())
    expect(result.current.theme).toBe('dark')
  })

  it('toggles sidebar', () => {
    const { result } = renderHook(() => useAppStore())
    act(() => result.current.toggleSidebar())
    expect(result.current.sidebarOpen).toBe(false) // starts true
  })

  it('advances revision color in WGA sequence', () => {
    const { result } = renderHook(() => useAppStore())
    act(() => result.current.nextRevisionDraft('Blue pages'))
    expect(result.current.revisionColor).toBe('blue')
    expect(result.current.revisionDraftName).toBe('Blue pages')
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run src/store/useAppStore.test.ts
```

Expected: FAIL — `useAppStore` not found.

- [ ] **Step 3: Implement the store**

```ts
// src/store/useAppStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  AppState, RevisionColor, REVISION_COLOR_SEQUENCE,
} from '../types/screenplay'

interface AppStore extends AppState {
  setFilePath: (path: string | null) => void
  setDirty: (dirty: boolean) => void
  toggleTheme: () => void
  toggleSidebar: () => void
  toggleRevisionMode: () => void
  nextRevisionDraft: (name: string) => void
  getInitialState: () => AppState
}

const initialState: AppState = {
  filePath: null,
  isDirty: false,
  theme: 'dark',
  sidebarOpen: true,
  revisionMode: false,
  revisionColor: 'white',
  revisionDraftName: 'White',
}

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      ...initialState,
      getInitialState: () => initialState,
      setFilePath: (filePath) => set({ filePath }),
      setDirty: (isDirty) => set({ isDirty }),
      toggleTheme: () =>
        set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
      toggleSidebar: () =>
        set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      toggleRevisionMode: () =>
        set((s) => ({ revisionMode: !s.revisionMode })),
      nextRevisionDraft: (name) => {
        const idx = REVISION_COLOR_SEQUENCE.indexOf(get().revisionColor)
        const next = REVISION_COLOR_SEQUENCE[
          (idx + 1) % REVISION_COLOR_SEQUENCE.length
        ] as RevisionColor
        set({ revisionColor: next, revisionDraftName: name })
      },
    }),
    { name: 'screenplay-app-store', partialize: (s) => ({ theme: s.theme, sidebarOpen: s.sidebarOpen }) }
  )
)
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run src/store/useAppStore.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/store/useAppStore.ts src/store/useAppStore.test.ts
git commit -m "feat: add Zustand app store with theme, sidebar, revision state"
```

---

## Task 4: Fountain Library (serialize / deserialize)

**Files:**
- Create: `src/lib/fountain.ts`
- Test: `src/lib/fountain.test.ts`

The Fountain format rules this code must handle:
- Scene headings: line starting with `INT.`, `EXT.`, `INT./EXT.`, `I/E.` OR forced with `.`
- Action: plain paragraphs
- Character: ALL CAPS line before dialogue (we emit as-is; uppercase = character)
- Dialogue: line after character
- Parenthetical: `(text)` line inside dialogue block
- Transition: ends with `:` and is right-aligned (we force with `>`)
- Section: `#`, `##`, `###`
- Note: `[[ text ]]`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/fountain.test.ts
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
  it('serializes scene heading as-is (all caps = auto-detected by Fountain)', () => {
    const result = tiptapToFountain(SIMPLE_DOC)
    expect(result).toContain('INT. COFFEE SHOP - DAY')
  })

  it('serializes transition with > prefix', () => {
    const result = tiptapToFountain(SIMPLE_DOC)
    expect(result).toContain('> CUT TO:')
  })

  it('serializes dialogue after character with blank line separation', () => {
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
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run src/lib/fountain.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement fountain.ts**

```ts
// src/lib/fountain.ts
// fountain-js handles parsing; we handle serialization manually for full control.
import Fountain from 'fountain-js'

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

  // Ensure at least one action block so editor is never empty
  if (content.length === 0) {
    content.push({ type: 'action', content: [{ type: 'text', text: '' }] })
  }
  return { type: 'doc', content }
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run src/lib/fountain.test.ts
```

Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/fountain.ts src/lib/fountain.test.ts
git commit -m "feat: Fountain serialize/deserialize (TipTap JSON ↔ .fountain)"
```

---

## Task 5: Page Count & Revision Helpers

**Files:**
- Create: `src/lib/pageCount.ts`
- Create: `src/lib/revision.ts`
- Test: `src/lib/pageCount.test.ts`
- Test: `src/lib/revision.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// src/lib/pageCount.test.ts
import { describe, it, expect } from 'vitest'
import { estimatePageCount, estimateWordCount } from './pageCount'

describe('estimatePageCount', () => {
  it('returns 1 for a short doc', () => {
    const doc = { type: 'doc', content: [
      { type: 'sceneHeading', content: [{ type: 'text', text: 'INT. ROOM - DAY' }] },
      { type: 'action', content: [{ type: 'text', text: 'Short scene.' }] },
    ]}
    expect(estimatePageCount(doc as any)).toBe(1)
  })
})

describe('estimateWordCount', () => {
  it('counts words across all blocks', () => {
    const doc = { type: 'doc', content: [
      { type: 'action', content: [{ type: 'text', text: 'Hello world' }] },
      { type: 'dialogue', content: [{ type: 'text', text: 'How are you' }] },
    ]}
    expect(estimateWordCount(doc as any)).toBe(5)
  })
})
```

```ts
// src/lib/revision.test.ts
import { describe, it, expect } from 'vitest'
import { encodeRevisionMark, decodeRevisionMark } from './revision'

describe('revision mark encoding', () => {
  it('encodes an insert mark', () => {
    const mark = encodeRevisionMark('blue', 'insert', 'hello')
    expect(mark).toBe('[[REV:color=blue;op=insert]]hello[[/REV]]')
  })

  it('decodes a mark back', () => {
    const mark = '[[REV:color=pink;op=delete]]goodbye[[/REV]]'
    const result = decodeRevisionMark(mark)
    expect(result).toEqual({ color: 'pink', op: 'delete', text: 'goodbye' })
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run src/lib/pageCount.test.ts src/lib/revision.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement pageCount.ts**

```ts
// src/lib/pageCount.ts
type TNode = { type: string; content?: TNode[]; text?: string }
type TDoc = { type: 'doc'; content: TNode[] }

const LINES_PER_PAGE = 55

function nodeText(node: TNode): string {
  if (node.text) return node.text
  return (node.content ?? []).map(nodeText).join('')
}

function blockLines(node: TNode): number {
  const text = nodeText(node)
  const charPerLine = 60
  return Math.max(1, Math.ceil(text.length / charPerLine)) + 1 // +1 for blank line between blocks
}

export function estimatePageCount(doc: TDoc): number {
  const totalLines = doc.content.reduce((sum, n) => sum + blockLines(n), 0)
  return Math.max(1, Math.ceil(totalLines / LINES_PER_PAGE))
}

export function estimateWordCount(doc: TDoc): number {
  const text = doc.content.map(nodeText).join(' ')
  return text.trim().split(/\s+/).filter(Boolean).length
}
```

- [ ] **Step 4: Implement revision.ts**

```ts
// src/lib/revision.ts
import type { RevisionColor, RevisionOp } from '../types/screenplay'

export function encodeRevisionMark(
  color: RevisionColor,
  op: RevisionOp,
  text: string
): string {
  return `[[REV:color=${color};op=${op}]]${text}[[/REV]]`
}

export function decodeRevisionMark(
  mark: string
): { color: RevisionColor; op: RevisionOp; text: string } | null {
  const match = mark.match(/\[\[REV:color=(\w+);op=(\w+)\]\](.*?)\[\[\/REV\]\]/)
  if (!match) return null
  return {
    color: match[1] as RevisionColor,
    op: match[2] as RevisionOp,
    text: match[3],
  }
}
```

- [ ] **Step 5: Run tests — verify they pass**

```bash
npx vitest run src/lib/pageCount.test.ts src/lib/revision.test.ts
```

Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/pageCount.ts src/lib/pageCount.test.ts src/lib/revision.ts src/lib/revision.test.ts
git commit -m "feat: page count estimator and revision mark encode/decode"
```

---

## Task 6: TipTap Node Extensions

**Files:**
- Create: `src/editor/extensions/nodes.ts`

Each screenplay block is a custom TipTap block node (replacing ProseMirror's default paragraph). They all behave like paragraphs but render with screenplay-appropriate CSS classes.

- [ ] **Step 1: Create nodes.ts**

```ts
// src/editor/extensions/nodes.ts
import { Node, mergeAttributes } from '@tiptap/core'
import type { BlockType } from '../../types/screenplay'

function makeScreenplayNode(name: BlockType, tag = 'p') {
  return Node.create({
    name,
    group: 'block',
    content: 'inline*',
    parseHTML() {
      return [{ tag: `${tag}[data-type="${name}"]` }]
    },
    renderHTML({ HTMLAttributes }) {
      return [tag, mergeAttributes(HTMLAttributes, { 'data-type': name, class: `sp-${name}` }), 0]
    },
    addCommands() {
      return {
        [`set${name.charAt(0).toUpperCase() + name.slice(1)}`]:
          () =>
          ({ commands }: any) =>
            commands.setNode(name),
      } as any
    },
  })
}

export const SceneHeading    = makeScreenplayNode('sceneHeading')
export const Action          = makeScreenplayNode('action')
export const Character       = makeScreenplayNode('character')
export const Dialogue        = makeScreenplayNode('dialogue')
export const Parenthetical   = makeScreenplayNode('parenthetical')
export const Transition      = makeScreenplayNode('transition')
export const ScreenplayNote  = makeScreenplayNode('screenplayNote')

// Section needs a `level` attribute (1–3 for #, ##, ###)
export const Section = Node.create({
  name: 'section',
  group: 'block',
  content: 'inline*',
  addAttributes() {
    return { level: { default: 1 } }
  },
  parseHTML() {
    return [{ tag: 'p[data-type="section"]' }]
  },
  renderHTML({ HTMLAttributes }) {
    return ['p', mergeAttributes(HTMLAttributes, { 'data-type': 'section', class: 'sp-section' }), 0]
  },
  addCommands() {
    return {
      setSection: (attrs?: { level: number }) => ({ commands }: any) =>
        commands.setNode('section', attrs),
    } as any
  },
})

export const allNodes = [
  SceneHeading, Action, Character, Dialogue,
  Parenthetical, Transition, Section, ScreenplayNote,
]
```

- [ ] **Step 2: Commit**

```bash
git add src/editor/extensions/nodes.ts
git commit -m "feat: TipTap custom node extensions for all screenplay block types"
```

---

## Task 7: Smart Tab Keymap + Auto-Detection

**Files:**
- Create: `src/editor/extensions/smartKeymap.ts`
- Create: `src/editor/extensions/autoDetect.ts`

- [ ] **Step 1: Create smartKeymap.ts**

The Tab key advances to the next logical block type per the spec. Enter from Character goes to Dialogue.

```ts
// src/editor/extensions/smartKeymap.ts
import { Extension } from '@tiptap/core'

const TAB_MAP: Record<string, string> = {
  sceneHeading:  'action',
  action:        'character',
  character:     'parenthetical',
  dialogue:      'character',
  parenthetical: 'dialogue',
  transition:    'action',
}

const ENTER_MAP: Record<string, string> = {
  character: 'dialogue',
  dialogue:  'action',
}

export const SmartKeymap = Extension.create({
  name: 'smartKeymap',
  addKeyboardShortcuts() {
    return {
      Tab: ({ editor }) => {
        const { $from } = editor.state.selection
        const nodeType = $from.parent.type.name
        const next = TAB_MAP[nodeType]
        if (!next) return false
        return editor.chain().focus().setNode(next).run()
      },
      Enter: ({ editor }) => {
        const { $from } = editor.state.selection
        const nodeType = $from.parent.type.name
        const next = ENTER_MAP[nodeType]
        if (!next) return false
        // Split the block, then set new block type
        return editor.chain().focus().splitBlock().setNode(next).run()
      },
    }
  },
})
```

- [ ] **Step 2: Create autoDetect.ts**

```ts
// src/editor/extensions/autoDetect.ts
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

const SCENE_HEADING_RE = /^(INT\.|EXT\.|INT\.\/EXT\.|I\/E\.)/i
// Character: all uppercase, ≤40 chars, no sentence-ending punctuation, doesn't end with ':'
const CHARACTER_RE = /^[A-Z][A-Z0-9 '\-()]{0,38}$/

export const AutoDetect = Extension.create({
  name: 'autoDetect',
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('autoDetect'),
        appendTransaction(transactions, _oldState, newState) {
          if (!transactions.some((tr) => tr.docChanged)) return null
          const tr = newState.tr
          let changed = false
          newState.doc.descendants((node, pos) => {
            const text = node.textContent.trim()
            if (!node.isBlock || !text) return
            const currentType = node.type.name
            if (SCENE_HEADING_RE.test(text) && currentType !== 'sceneHeading') {
              tr.setNodeMarkup(pos, newState.schema.nodes.sceneHeading)
              changed = true
            } else if (
              CHARACTER_RE.test(text) &&
              !text.endsWith(':') &&
              !/[.?!]/.test(text) &&
              currentType === 'action'
            ) {
              tr.setNodeMarkup(pos, newState.schema.nodes.character)
              changed = true
            }
          })
          return changed ? tr : null
        },
      }),
    ]
  },
})
```

- [ ] **Step 3: Commit**

```bash
git add src/editor/extensions/smartKeymap.ts src/editor/extensions/autoDetect.ts
git commit -m "feat: smart Tab/Enter keymap and auto-detection for scene headings and characters"
```

---

## Task 8: Revision Mark Extension

**Files:**
- Create: `src/editor/extensions/revisionMark.ts`

- [ ] **Step 1: Create revisionMark.ts**

```ts
// src/editor/extensions/revisionMark.ts
import { Mark, mergeAttributes } from '@tiptap/core'
import type { RevisionColor, RevisionOp } from '../../types/screenplay'
import { REVISION_HEX } from '../../types/screenplay'

export const RevisionMark = Mark.create({
  name: 'revision',
  addAttributes() {
    return {
      color: { default: 'blue' },
      op: { default: 'insert' },
    }
  },
  parseHTML() {
    return [{ tag: 'span[data-revision]' }]
  },
  renderHTML({ HTMLAttributes }) {
    const { color, op } = HTMLAttributes as { color: RevisionColor; op: RevisionOp }
    const bg = REVISION_HEX[color] ?? '#dbeafe'
    const style =
      op === 'delete'
        ? `text-decoration:line-through;opacity:0.6;background:${bg}`
        : `background:${bg}`
    return ['span', mergeAttributes(HTMLAttributes, { 'data-revision': true, style }), 0]
  },
})
```

- [ ] **Step 2: Commit**

```bash
git add src/editor/extensions/revisionMark.ts
git commit -m "feat: TipTap revision mark extension with color highlight and strikethrough"
```

---

## Task 9: ScreenplayEditor Component

**Files:**
- Create: `src/editor/ScreenplayEditor.tsx`

This is the TipTap editor wrapper that composes all extensions, wires up the store, and provides the editor context for other components.

- [ ] **Step 1: Create ScreenplayEditor.tsx**

```tsx
// src/editor/ScreenplayEditor.tsx
import { useEditor, EditorContent } from '@tiptap/react'
import { Document } from '@tiptap/extension-document'
import { Text } from '@tiptap/extension-text'
import { History } from '@tiptap/extension-history'
import { allNodes } from './extensions/nodes'
import { SmartKeymap } from './extensions/smartKeymap'
import { AutoDetect } from './extensions/autoDetect'
import { RevisionMark } from './extensions/revisionMark'
import { useAppStore } from '../store/useAppStore'
import { useEffect, useRef } from 'react'

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
```

- [ ] **Step 2: Add screenplay CSS to `src/index.css`** (after Tailwind directives)

```css
/* Screenplay page container */
.screenplay-page {
  max-width: 680px;
  margin: 0 auto;
  padding: 48px 64px;
  font-family: 'Courier Prime', 'Courier New', monospace;
  font-size: 12pt;
  line-height: 1.6;
  min-height: 100%;
}

/* Block styles */
.sp-sceneHeading  { font-weight: bold; text-transform: uppercase; margin: 1em 0 0.25em; }
.sp-action        { margin: 0.25em 0; }
.sp-character     { text-align: center; text-transform: uppercase; margin: 1em auto 0; width: 60%; }
.sp-dialogue      { margin: 0 auto; width: 65%; }
.sp-parenthetical { text-align: center; width: 50%; margin: 0 auto; }
.sp-transition    { text-align: right; text-transform: uppercase; margin: 1em 0; }
.sp-section       { color: #6366f1; font-style: italic; }
.sp-screenplayNote{ color: #9ca3af; font-size: 0.85em; }
```

- [ ] **Step 3: Install Courier Prime font**

Add to `index.html` `<head>`:
```html
<link href="https://fonts.googleapis.com/css2?family=Courier+Prime:ital,wght@0,400;0,700;1,400&display=swap" rel="stylesheet">
```

- [ ] **Step 4: Commit**

```bash
git add src/editor/ScreenplayEditor.tsx src/index.css index.html
git commit -m "feat: ScreenplayEditor component with all TipTap extensions"
```

---

## Task 10: Tauri File Commands

**Files:**
- Modify: `src-tauri/src/main.rs`

- [ ] **Step 1: Add Tauri v2 fs and dialog plugins to Cargo.toml**

In `src-tauri/Cargo.toml`, add to `[dependencies]`:
```toml
tauri-plugin-fs = "2"
tauri-plugin-dialog = "2"
```

- [ ] **Step 2: Register plugins and add commands to main.rs**

Replace the contents of `src-tauri/src/main.rs` with:

```rust
// src-tauri/src/main.rs
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[tauri::command]
async fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
async fn write_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content).map_err(|e| e.to_string())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![read_file, write_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 3: Install JS plugin packages**

```bash
npm install @tauri-apps/plugin-fs @tauri-apps/plugin-dialog @tauri-apps/api
```

- [ ] **Step 4: Update fileManager.ts imports**

In `src/lib/fileManager.ts`, change:
```ts
// Old (Tauri v1):
import { open, save } from '@tauri-apps/api/dialog'
// New (Tauri v2):
import { open, save } from '@tauri-apps/plugin-dialog'
```

- [ ] **Step 5: Verify Tauri builds**

```bash
npm run tauri build -- --debug 2>&1 | tail -5
```

Expected: Exits with code 0, no Rust compile errors.

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/main.rs src-tauri/Cargo.toml
git commit -m "feat: Tauri v2 plugins (fs, dialog) and read_file/write_file commands"
```

---

## Task 11: File Management Hook

**Files:**
- Create: `src/lib/fileManager.ts`
- Test: (integration — test manually, no unit test needed for Tauri IPC)

- [ ] **Step 1: Create fileManager.ts**

```ts
// src/lib/fileManager.ts
import { invoke } from '@tauri-apps/api/core'
import { open, save } from '@tauri-apps/plugin-dialog'
import { fountainToTiptap, tiptapToFountain } from './fountain'
import { useAppStore } from '../store/useAppStore'

export async function openFile(editor: any) {
  const selected = await open({
    filters: [{ name: 'Fountain', extensions: ['fountain'] }],
    multiple: false,
  })
  if (!selected || Array.isArray(selected)) return
  const content = await invoke<string>('read_file', { path: selected })
  const doc = fountainToTiptap(content)
  editor.commands.setContent(doc)
  useAppStore.getState().setFilePath(selected)
  useAppStore.getState().setDirty(false)
}

export async function saveFile(editor: any, forceSaveAs = false) {
  const store = useAppStore.getState()
  let filePath = store.filePath
  if (!filePath || forceSaveAs) {
    const selected = await save({
      filters: [{ name: 'Fountain', extensions: ['fountain'] }],
      defaultPath: 'Untitled.fountain',
    })
    if (!selected) return
    filePath = selected
    store.setFilePath(filePath)
  }
  const content = tiptapToFountain(editor.getJSON())
  await invoke('write_file', { path: filePath, content })
  store.setDirty(false)
}

export function startAutoSave(editor: any) {
  return setInterval(async () => {
    const { filePath, isDirty } = useAppStore.getState()
    if (filePath && isDirty) await saveFile(editor)
  }, 30_000)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/fileManager.ts
git commit -m "feat: file open/save/auto-save via Tauri IPC and native dialogs"
```

---

## Task 12: App Layout Components

**Files:**
- Create: `src/components/Toolbar.tsx`
- Create: `src/components/SceneNavigator.tsx`
- Create: `src/components/StatusBar.tsx`
- Create: `src/components/AppShell.tsx`

- [ ] **Step 1: Create Toolbar.tsx**

```tsx
// src/components/Toolbar.tsx
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useAppStore } from '../store/useAppStore'
import { openFile, saveFile } from '../lib/fileManager'
import { Sun, Moon, PanelLeft, Save, FileDown, GitBranch } from 'lucide-react'

interface Props { editor: any }

export function Toolbar({ editor }: Props) {
  const { filePath, isDirty, theme, sidebarOpen, revisionMode,
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
      <Separator orientation="vertical" className="h-5" />
      <Button variant={revisionMode ? 'secondary' : 'ghost'} size="sm"
              onClick={toggleRevisionMode}>
        <GitBranch className="h-4 w-4 mr-1" /> Revisions
      </Button>
      <Button variant="ghost" size="icon" onClick={toggleTheme}>
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
    </div>
  )
}
```

- [ ] **Step 2: Install lucide-react**

```bash
npm install lucide-react
```

- [ ] **Step 3: Create SceneNavigator.tsx**

```tsx
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
        {scenes.map((s, i) => (
          <button
            key={i}
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
```

- [ ] **Step 4: Create StatusBar.tsx**

```tsx
// src/components/StatusBar.tsx
import { useEffect, useState } from 'react'
import { estimatePageCount, estimateWordCount } from '../lib/pageCount'

interface Props { editor: any }

export function StatusBar({ editor }: Props) {
  const [words, setWords] = useState(0)
  const [pages, setPages] = useState(1)
  const [sceneInfo, setSceneInfo] = useState('—')

  useEffect(() => {
    if (!editor) return
    const update = () => {
      const doc = editor.getJSON()
      setWords(estimateWordCount(doc))
      setPages(estimatePageCount(doc))

      // Current scene
      const { $from } = editor.state.selection
      let currentScene = 0
      let totalScenes = 0
      editor.state.doc.descendants((node: any, pos: number) => {
        if (node.type.name === 'sceneHeading') {
          totalScenes++
          if (pos <= $from.pos) currentScene = totalScenes
        }
      })
      setSceneInfo(totalScenes ? `Scene ${currentScene} of ${totalScenes}` : '—')
    }
    update()
    editor.on('update', update)
    editor.on('selectionUpdate', update)
    return () => { editor.off('update', update); editor.off('selectionUpdate', update) }
  }, [editor])

  return (
    <div className="h-7 border-t flex items-center px-4 gap-4 text-xs text-muted-foreground shrink-0">
      <span>~{pages} {pages === 1 ? 'page' : 'pages'}</span>
      <span className="text-border">|</span>
      <span>{words} words</span>
      <span className="text-border">|</span>
      <span>{sceneInfo}</span>
    </div>
  )
}
```

- [ ] **Step 5: Create AppShell.tsx**

```tsx
// src/components/AppShell.tsx
import { useRef, useState, useEffect } from 'react'
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
```

- [ ] **Step 6: Wire into App.tsx**

```tsx
// src/App.tsx
import { useEffect } from 'react'
import { AppShell } from './components/AppShell'
import { useAppStore } from './store/useAppStore'

export default function App() {
  const theme = useAppStore((s) => s.theme)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  return <AppShell />
}
```

- [ ] **Step 7: Run dev and verify layout**

```bash
npm run tauri dev
```

Expected: App opens with toolbar, collapsible sidebar, editor area, status bar. Theme toggle switches between dark/light.

- [ ] **Step 8: Commit**

```bash
git add src/components/ src/App.tsx
git commit -m "feat: app layout — toolbar, collapsible scene navigator, editor, status bar"
```

---

## Task 13: PDF Export

**Files:**
- Create: `src/lib/pdf.ts`

PDF is generated by injecting a formatted HTML screenplay template into a hidden Tauri WebView window and calling `window.print()`. The user gets the system print dialog pre-configured to print to PDF.

- [ ] **Step 1: Create pdf.ts**

Use `fountainToTiptap` to get structured blocks, then render each block type to properly formatted HTML with industry-standard margins.

```ts
// src/lib/pdf.ts
import { invoke } from '@tauri-apps/api/core'
import { WebviewWindow } from '@tauri-apps/api/webviewWindow'
import { useAppStore } from '../store/useAppStore'
import { tempDir } from '@tauri-apps/api/path'

type TNode = { type: string; content?: TNode[]; text?: string; attrs?: Record<string, any> }

function nodeText(node: TNode): string {
  if (node.text) return node.text
  return (node.content ?? []).map(nodeText).join('')
}

// Extract Fountain title metadata from first screenplayNote block tagged as title,
// or fall back to filename. Fountain title block: first non-blank line of the doc
// that precedes the first scene heading.
function extractTitleBlock(doc: { content: TNode[] }): { title: string; author: string } {
  // Fountain metadata: key:value pairs at start of file — look for first action blocks
  // We store them as screenplayNote with attrs.metaKey
  let title = 'Untitled'
  let author = ''
  for (const node of doc.content) {
    if (node.type === 'sceneHeading') break
    if (node.type === 'screenplayNote' && node.attrs?.metaKey === 'title') {
      title = nodeText(node)
    }
    if (node.type === 'screenplayNote' && node.attrs?.metaKey === 'author') {
      author = nodeText(node)
    }
  }
  return { title, author }
}

function buildScreenplayHtml(
  fileTitle: string,
  doc: { type: string; content: TNode[] },
  hasRevisions: boolean
): string {
  const { title, author } = extractTitleBlock(doc)
  const displayTitle = title !== 'Untitled' ? title : fileTitle

  const titlePageHtml = `
<div class="title-page">
  <div class="title-block">
    <div class="script-title">${displayTitle}</div>
    ${author ? `<div class="script-author">Written by<br>${author}</div>` : ''}
  </div>
</div>
<div style="page-break-after:always"></div>`

  const body = doc.content.map(node => {
    const text = nodeText(node).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // Revision asterisk: check if any inline node in this block carries a 'revision' mark
    const hasRev = hasRevisions && (node.content ?? []).some(
      (inline: any) => (inline.marks ?? []).some((m: any) => m.type === 'revision')
    )
    const asterisk = hasRev ? '<span class="rev-asterisk">*</span>' : ''
    switch (node.type) {
      case 'sceneHeading':   return `<div class="scene-heading">${text}${asterisk}</div>`
      case 'action':         return `<div class="action">${text}${asterisk}</div>`
      case 'character':      return `<div class="character">${text}</div>`
      case 'dialogue':       return `<div class="dialogue">${text}${asterisk}</div>`
      case 'parenthetical':  return `<div class="parenthetical">${text}</div>`
      case 'transition':     return `<div class="transition">${text}</div>`
      case 'section':        return '' // hidden in PDF
      case 'screenplayNote': return '' // hidden in PDF
      default:               return `<div class="action">${text}</div>`
    }
  }).join('\n')

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Courier+Prime&display=swap');
  @page { size: letter; margin: 1in 1in 1in 1.5in; }
  @page :first { margin: 1.5in; } /* title page */
  body { font-family: 'Courier Prime', monospace; font-size: 12pt; line-height: 1.5; color: #000; counter-reset: page 1; }
  /* Page numbers: top-right, starting page 2 */
  @page :not(:first) {
    @top-right { content: counter(page) "."; font-family: 'Courier Prime', monospace; font-size: 12pt; }
  }
  .title-page { display:flex; align-items:center; justify-content:center; min-height:9in; text-align:center; }
  .script-title { font-size:14pt; font-weight:bold; text-transform:uppercase; margin-bottom:2em; }
  .script-author { font-size:12pt; }
  .scene-heading  { font-weight: bold; text-transform: uppercase; margin: 1em 0 0.25em; position: relative; }
  .action         { margin: 0.25em 0; }
  .character      { margin: 1em 0 0; margin-left: 2.2in; text-transform: uppercase; }
  .dialogue       { margin: 0; margin-left: 1.5in; margin-right: 1.5in; position: relative; }
  .parenthetical  { margin: 0; margin-left: 1.8in; margin-right: 1.8in; }
  .transition     { text-align: right; text-transform: uppercase; margin: 0.5em 0; }
  .rev-asterisk   { position: absolute; right: -0.4in; }
  @media print { body { -webkit-print-color-adjust: exact; } }
</style>
<title>${displayTitle}</title>
</head><body>
${titlePageHtml}
${body}
<script>window.onload = () => { window.print(); window.close(); }<\/script>
</body></html>`
}

export async function exportToPdf(editor: any) {
  const { filePath, revisionMode } = useAppStore.getState()
  const fileTitle = filePath ? filePath.split(/[\\/]/).pop()!.replace('.fountain', '') : 'Screenplay'
  const html = buildScreenplayHtml(fileTitle, editor.getJSON(), revisionMode)

  // Write HTML to a temp file so Tauri WebviewWindow can load it as file://
  const tmp = await tempDir()
  const tmpPath = `${tmp}screenplay-print.html`
  await invoke('write_file', { path: tmpPath, content: html })

  const printWindow = new WebviewWindow('pdf-print', {
    url: `file://${tmpPath}`,
    title: 'Print Screenplay',
    width: 850,
    height: 1100,
    visible: true,
  })
  printWindow.once('tauri://error', (e) => console.error('PDF window error:', e))
}
```

- [ ] **Step 2: Add Export PDF button to Toolbar.tsx**

In `Toolbar.tsx`, import `exportToPdf` and wire up the `FileDown` button:
```tsx
import { exportToPdf } from '../lib/pdf'
// In JSX:
<Button variant="ghost" size="icon" onClick={() => exportToPdf(editor)}>
  <FileDown className="h-4 w-4" />
</Button>
```

- [ ] **Step 3: Test PDF export manually**

Run `npm run tauri dev`, open or create a script with a few scenes, click the export button. Expected: system print dialog appears; print to PDF produces a correctly formatted document with Courier Prime font.

> **Note on page numbers:** The `@page @top-right` CSS named string is a CSS Paged Media feature with limited Chromium/WebView support. If page numbers don't appear in the print preview, replace with a JavaScript approach: inject `<div class="page-number"></div>` elements using `window.onbeforeprint` or use a JS library like `pagedjs` polyfill.

- [ ] **Step 4: Commit**

```bash
git add src/lib/pdf.ts src/components/Toolbar.tsx
git commit -m "feat: PDF export via Tauri WebView print"
```

---

## Task 14: Revision Mode — Wire Up

**Files:**
- Modify: `src/editor/ScreenplayEditor.tsx`
- Modify: `src/components/Toolbar.tsx`

- [ ] **Step 1: Apply revision marks on typing when revision mode is on**

In `ScreenplayEditor.tsx`, add an `onUpdate` handler that wraps newly inserted text in a `revision` mark when `revisionMode` is active:

```tsx
// Add to ScreenplayEditor.tsx imports
import { useAppStore } from '../store/useAppStore'

// Inside useEditor({ ... })
onUpdate({ editor, transaction }) {
  setDirty(true)
  const { revisionMode, revisionColor } = useAppStore.getState()
  if (!revisionMode || !transaction.docChanged) return
  // Apply revision insert mark to newly typed ranges
  transaction.steps.forEach((step: any) => {
    if (step.slice?.content?.size > 0) {
      const from = step.from
      const to = step.from + step.slice.content.size
      editor.chain()
        .setTextSelection({ from, to })
        .setMark('revision', { color: revisionColor, op: 'insert' })
        .setTextSelection(to)
        .run()
    }
  })
}
```

- [ ] **Step 2: Add "Next Draft" dialog to Toolbar**

When user clicks the Revisions button while already in revision mode, prompt for the next draft name:
```tsx
// In Toolbar.tsx — update the Revisions button onClick
onClick={() => {
  if (!revisionMode) {
    toggleRevisionMode()
  } else {
    const name = window.prompt('Name for next revision draft (e.g. "Blue pages"):')
    if (name) useAppStore.getState().nextRevisionDraft(name)
  }
}}
```

- [ ] **Step 3: Test revision mode manually**

Run `npm run tauri dev`. Toggle revision mode on (button highlights). Type new text — verify it appears highlighted in the revision color. Type more text with revision off — verify no highlight.

- [ ] **Step 4: Commit**

```bash
git add src/editor/ScreenplayEditor.tsx src/components/Toolbar.tsx
git commit -m "feat: revision mode marks new insertions with draft color"
```

---

## Task 15: End-to-End Verification

Run through the verification checklist from the spec:

- [ ] `npm run tauri dev` — app window opens
- [ ] Type `INT. COFFEE SHOP - DAY` — auto-formats as Scene Heading
- [ ] Tab from action → Character; Enter from Character → Dialogue
- [ ] Save as `.fountain`, open file in text editor — verify Fountain syntax
- [ ] Re-open saved file — confirm round-trip (content looks the same)
- [ ] Export PDF — verify Courier Prime, correct margins, page numbers
- [ ] Toggle dark/light — restart app and confirm theme persists
- [ ] Toggle sidebar — confirm collapse/expand and scene jump works
- [ ] Enable revision mode, type — confirm highlights appear
- [ ] Export PDF with revision mode on — verify `*` or colored text appears on changed content
- [ ] Run full test suite:

```bash
npx vitest run
```

Expected: All tests pass.

- [ ] **Final commit**

```bash
git add -A
git commit -m "feat: complete screenwriting app v1"
```

---

## .gitignore additions

Ensure `.gitignore` includes:
```
.superpowers/
node_modules/
dist/
src-tauri/target/
```
