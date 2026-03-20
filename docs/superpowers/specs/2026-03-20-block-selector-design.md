# Block Selector Design

**Date:** 2026-03-20
**Status:** Approved

## Overview

A Notion-style block type selector for the screenplay editor. Writers can change the type of any block (action, scene heading, character, etc.) via a `/` slash command at the keyboard or by clicking a hover gutter label with the mouse.

## Behaviour

### Slash command
- Typing `/` at the **start of a line** (no preceding text on the line) opens the block picker menu positioned at the cursor.
- The `/` is removed from the document when the picker opens (it is a trigger, not content).
- Selecting a block type converts the current block and closes the menu.
- Pressing Escape closes the menu without changing the block type; the `/` is also removed.

### Gutter labels
- Each block line shows a short type label (e.g. `ACTION ▾`, `SCENE ▾`) in the left margin **only when the cursor hovers over that line**.
- Visibility is controlled entirely by CSS (`:hover` → `opacity: 1`). No JavaScript event listeners needed for show/hide.
- Clicking the label opens the block picker menu anchored to the label position.
- The `▾` caret signals interactivity.

### Block picker menu
- Lists 6 block types: Action, Scene Heading, Character, Dialogue, Parenthetical, Transition.
- Each row shows a small icon + name. No descriptions.
- Keyboard navigation: arrow keys move selection, Enter confirms, Escape closes.
- Click-outside closes the menu.
- Rendered via `ReactDOM.createPortal` into `document.body` to avoid clipping from overflow-hidden ancestors.

## Architecture

### New files

| File | Purpose |
|------|---------|
| `src/editor/extensions/slashCommand.ts` | TipTap extension — detects `/` trigger, fires `onOpen` callback |
| `src/editor/extensions/gutterLabels.ts` | TipTap extension — ProseMirror decoration plugin for gutter labels |
| `src/components/BlockPicker.tsx` | React floating menu component |

### Modified files

| File | Change |
|------|--------|
| `src/editor/ScreenplayEditor.tsx` | Add picker state, wire extensions, render `BlockPicker` |
| `src/index.css` | Gutter label CSS (positioning, hover transition) |

### Dependencies

`@tiptap/suggestion` — already a transitive dependency of `@tiptap/core`, no new package required.

## Component details

### `slashCommand.ts`

Built on `@tiptap/suggestion`. Configuration:
- `char: '/'`
- `allowSpaces: false`
- `startOfLine: true` — only triggers when `/` is the first character on the line
- `items`: returns the full block type list (no filtering; the menu is always the same 6 items)
- `render`: returns an object with `onStart`, `onUpdate`, `onExit` callbacks that call the provided `onOpen` / `onClose` callbacks with the current DOM rect of the suggestion decoration

The extension receives an `onOpen: (rect: DOMRect) => void` option from `ScreenplayEditor`.

### `gutterLabels.ts`

A TipTap extension containing a ProseMirror plugin. On each document update the plugin rebuilds a `DecorationSet` by iterating all top-level nodes and inserting a `Decoration.widget` at the start of each block. The widget is a `<span class="gutter-label">` element containing the icon character and abbreviated block name. A click handler on each widget calls `onOpen(element.getBoundingClientRect())`.

Block type → label mapping:
| Type | Icon | Label |
|------|------|-------|
| action | ¶ | ACTION |
| sceneHeading | 🎬 | SCENE |
| character | @ | CHAR |
| dialogue | " | DIALO |
| parenthetical | () | PAREN |
| transition | → | TRANS |

### `BlockPicker.tsx`

Props:
```ts
interface BlockPickerProps {
  open: boolean
  anchor: { x: number; y: number } | null
  onSelect: (type: BlockType) => void
  onClose: () => void
}
```

Renders via `createPortal`. Positioned with `position: fixed` using `anchor.x` / `anchor.y` adjusted to stay within the viewport. Uses a `useEffect` to attach a `mousedown` listener on `document` for click-outside detection. Arrow key navigation tracked with local `useState`.

### `ScreenplayEditor.tsx` wiring

```ts
const [pickerAnchor, setPickerAnchor] = useState<{ x: number; y: number } | null>(null)

const handleOpen = useCallback((rect: DOMRect) => {
  setPickerAnchor({ x: rect.left, y: rect.bottom + 4 })
}, [])

const handleSelect = useCallback((type: BlockType) => {
  editor?.chain().focus().setNode(type).run()
  setPickerAnchor(null)
}, [editor])
```

Both `SlashCommand` and `GutterLabels` extensions receive `handleOpen` as an option. `BlockPicker` is rendered as a sibling of `EditorContent` inside `ScreenplayEditor`.

## CSS — gutter labels

```css
/* All block elements need relative positioning for the widget */
.ProseMirror [data-type] {
  position: relative;
}

.gutter-label {
  position: absolute;
  right: calc(100% + 8px);
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

## Block type conversion

`editor.chain().focus().setNode(type).run()` — TipTap's built-in `setNode` command replaces the current node type. All existing screenplay node types are already registered, so no additional commands are needed.

## Out of scope

- Filtering/search within the picker (the list is short enough to scan visually)
- Drag-and-drop block reordering
- Keyboard shortcut to open picker without typing `/`
