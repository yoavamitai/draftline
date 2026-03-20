# Block Selector Design

**Date:** 2026-03-20
**Status:** Approved

## Overview

A Notion-style block type selector for the screenplay editor. Writers can change the type of any block via a `/` slash command at the keyboard or by clicking a hover gutter label with the mouse.

## Behaviour

### Slash command
- Typing `/` into an **empty block** (no other content) opens the block picker at the cursor.
- The `/` character stays in the document while the picker is open; it is deleted in either `command` or `onExit`, never in `onStart`.
- Selecting a type: `command` calls `deleteRange(range)` (removes the `/`) then `setNode(type)`.
- Dismiss (Escape / click-outside): `onExit` calls `deleteRange(range)` if `itemSelected === false`, cleaning up the `/`.
- `itemSelected` is a boolean in the `render` closure, set to `true` inside `command` before `onExit` fires, preventing any double-delete.

**Why empty blocks only?** The `allow` callback (`$position.parent.textContent.trim() === ''`) gates the trigger to genuinely empty blocks. AutoDetect only fires when text matches patterns (`INT.`/`EXT.` prefix or ALL-CAPS). An empty block produces no match, so AutoDetect will never override a picker selection made on an empty block. No separate mitigation for AutoDetect is needed; the empty-block constraint is sufficient.

**`startOfLine: true` is not used.** The `allow` callback is the authoritative guard. `startOfLine: true` tests whether `/` is the first character since the last hard break — a different and less reliable condition. Rely on `allow` alone.

### Gutter labels
- **Shown for full-width blocks only**: action, sceneHeading, transition. Character, dialogue, and parenthetical are excluded — they are centered/width-constrained and their left edges shift with container width, making consistent gutter placement unreliable without runtime positioning. Writers already navigate these types efficiently via Tab/Enter.
- CSS hover-only: `[data-type]:hover .gutter-label { opacity: 1 }`.
- Clicking the label opens the picker anchored to the label.
- Shows icon + abbreviated name + `▾`.

### Block picker menu
- 6 block types: Action, Scene Heading, Character, Dialogue, Parenthetical, Transition.
- Icon + name per row, no descriptions.
- Arrow keys navigate, Enter confirms, Escape closes.
- When `open`, a `document keydown` listener intercepts Up / Down / Enter / Escape with `preventDefault` + `stopPropagation` to prevent the editor's keymap from receiving them.
- `document mousedown` for click-outside detection.
- Instantiated inside `ScreenplayEditor`'s JSX (for state and prop locality) and portaled to `document.body` for DOM rendering. Anchor coordinates come from `getBoundingClientRect()` which returns viewport-space values; the picker uses `position: fixed`, so these are correct.

## Dependencies

Add to `package.json` as explicit direct dependencies:

- `@tiptap/suggestion@^3.20.4`
- `@tiptap/core@^3.20.4` (currently only transitive; must be pinned for version alignment)

## Architecture

### New files

| File | Purpose |
|------|---------|
| `src/editor/extensions/slashCommand.ts` | TipTap extension — slash trigger |
| `src/editor/extensions/gutterLabels.ts` | TipTap extension — ProseMirror decoration plugin |
| `src/components/BlockPicker.tsx` | React floating menu |

### Modified files

| File | Change |
|------|--------|
| `src/editor/ScreenplayEditor.tsx` | Add picker state + wiring. `onEditorReady` prop is unchanged. |
| `src/index.css` | Gutter label CSS |
| `package.json` | Add `@tiptap/suggestion`, `@tiptap/core` |

## Component details

### `slashCommand.ts`

```ts
Extension.create({
  addOptions() {
    return { onOpen: (_rect: DOMRect) => {}, onClose: () => {} }
  },
  addProseMirrorPlugins() {
    const { onOpen, onClose } = this.options
    // itemSelected is declared at Suggestion-options scope so both render() and command() share it
    let itemSelected = false
    return [Suggestion({
      editor: this.editor,
      char: '/',
      allowSpaces: false,
      allow: ({ $position }) => $position.parent.textContent.trim() === '',
      items: () => BLOCK_TYPES,   // constant 6-item array
      render() {
        return {
          onStart(props) { itemSelected = false; onOpen(props.clientRect?.() as DOMRect) },
          onExit(props)  { if (!itemSelected) props.editor.commands.deleteRange(props.range); onClose() },
        }
      },
      command({ editor, range, props }) {
        itemSelected = true
        editor.chain().focus().deleteRange(range).setNode(props.type).run()
        // onClose() is called by onExit which fires after command; no need to call it here
      },
    })]
  },
})
```

### `gutterLabels.ts`

```ts
Extension.create({
  addOptions() { return { onOpen: (_rect: DOMRect) => {} } },
  addProseMirrorPlugins() {
    const { onOpen } = this.options
    return [new Plugin({
      props: {
        decorations(state) {
          const decos: Decoration[] = []
          state.doc.forEach((node, pos) => {
            const type = node.type.name
            if (['action', 'sceneHeading', 'transition'].includes(type)) {
              decos.push(Decoration.widget(pos + 1, () => createLabel(type, onOpen), { side: -1 }))
            }
          })
          return DecorationSet.create(state.doc, decos)
        }
      }
    })]
  },
})
```

`createLabel(type, onOpen)` returns a `<span class="gutter-label">` with icon + abbreviated name. Its `click` handler calls `onOpen(span.getBoundingClientRect())`.

Block type → label (full-width blocks only):

| Type | Icon | Text |
|------|------|------|
| action | ¶ | ACTION |
| sceneHeading | 🎬 | SCENE |
| transition | → | TRANS |

### `BlockPicker.tsx`

```ts
interface BlockPickerProps {
  open: boolean
  anchor: { x: number; y: number } | null
  onSelect: (type: BlockType) => void
  onClose: () => void
}
```

- React component instantiated in `ScreenplayEditor`'s JSX, portaled to `document.body` via `createPortal`.
- `position: fixed` at `anchor.x / anchor.y`. Clamp: if `anchor.y + menuHeight > window.innerHeight`, flip above.
- `useEffect` (when `open`): attach `document keydown` — Up/Down adjust `activeIndex`, Enter calls `onSelect(BLOCK_TYPES[activeIndex].type)`, Escape calls `onClose`. All `preventDefault` + `stopPropagation`. Detach on cleanup.
- `useEffect` (when `open`): attach `document mousedown` — close if click target is not inside the picker element. Detach on cleanup.
- `useState(0)` for `activeIndex`, reset to `0` in a `useEffect` on `open` changing to `true`.
- All 6 block types always shown; the `allow` callback in `slashCommand.ts` ensures the trigger only fires on empty blocks where any type is valid.

### `ScreenplayEditor.tsx` wiring

```ts
const [pickerAnchor, setPickerAnchor] = useState<{ x: number; y: number } | null>(null)

const handleOpen = useCallback((rect: DOMRect) => {
  setPickerAnchor({ x: rect.left, y: rect.bottom + 4 })
}, [])

const handleClose = useCallback(() => setPickerAnchor(null), [])

// handleSelect is called only from the gutter-label path: the user clicks a gutter label,
// the picker opens, they pick a type, BlockPicker calls onSelect → handleSelect → setNode.
// The slash-command path never calls handleSelect — it completes entirely inside slashCommand's
// `command` callback (deleteRange + setNode), then fires onClose → handleClose.
const handleSelect = useCallback((type: BlockType) => {
  editor?.chain().focus().setNode(type).run()
  setPickerAnchor(null)
}, [editor])
```

Extensions added to the array (after existing extensions):
```ts
SlashCommand.configure({ onOpen: handleOpen, onClose: handleClose }),
GutterLabels.configure({ onOpen: handleOpen }),
```

JSX (`onEditorReady` prop and all existing logic unchanged):
```tsx
<div className="screenplay-page">
  <EditorContent editor={editor} />
  <BlockPicker
    open={pickerAnchor !== null}
    anchor={pickerAnchor}
    onSelect={handleSelect}
    onClose={handleClose}
  />
</div>
```

## CSS — gutter labels

Full-width blocks only (`action`, `sceneHeading`, `transition`). Their left edge is always flush with the content area, so `left: -56px` reliably places the label in the 64px left padding.

```css
/* Positioning context */
.ProseMirror [data-type] {
  position: relative;
}

.gutter-label {
  position: absolute;
  left: -56px;
  top: 0;
  font-size: 9px;
  font-family: var(--font-sans);
  color: var(--muted-foreground);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.12s;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
}

.ProseMirror [data-type]:hover .gutter-label {
  opacity: 1;
  pointer-events: auto;
}
```

## Out of scope

- Gutter labels for centered blocks (character, dialogue, parenthetical) — deferred until a runtime positioning approach is designed
- Filtering/search within the picker
- Drag-and-drop block reordering
- Keyboard shortcut to open picker without typing `/`
