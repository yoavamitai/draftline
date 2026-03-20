# Autocomplete — Design Spec

**Date:** 2026-03-21
**Status:** Approved

---

## Overview

Context-aware autocomplete for `character` and `sceneHeading` blocks. When the cursor is in one of these block types and the current text prefix-matches an existing entry in the document, a dropdown appears with suggestions. Accepting a suggestion replaces the block's full text content.

---

## Architecture

| File | Role |
|------|------|
| `src/editor/extensions/autoComplete.ts` | TipTap Extension — ProseMirror plugin, data collection, callback interface |
| `src/editor/ScreenplayEditor.tsx` | Renders the dropdown as a React portal; handles keyboard navigation |

The extension is the brain; React is the display layer. This mirrors the existing `SlashCommand` ↔ block picker pattern exactly.

---

## The Extension (`autoComplete.ts`)

### Options interface

```ts
interface AutoCompleteOptions {
  onOpen: (rect: DOMRect, items: string[], select: (text: string) => void) => void;
  onClose: () => void;
}
```

### Plugin behaviour

A ProseMirror plugin fires on every transaction. On each run it:

1. Resolves the cursor position to find the current block node type.
2. If the block type is **not** `character` or `sceneHeading`, calls `onClose()` and exits.
3. Walks the full document to collect all unique text values from nodes of the matching type, counting occurrences. Excludes the current node's own content.
4. Filters the collected list to entries that **start with** the current block's text (case-insensitive). Sorts by frequency descending. Caps at **8 items**.
5. If the current block text is empty or no matches remain, calls `onClose()`.
6. Otherwise, obtains the DOM rect of the current block node via `view.domAtPos()` and calls `onOpen(rect, items, select)`.

### `select(text)` callback

Replaces the entire content of the current block with `text`:

```ts
editor.chain().focus().command(({ tr, state }) => {
  const { $from } = state.selection;
  const start = $from.start();
  const end = $from.end();
  tr.insertText(text, start, end);
  return true;
}).run();
```

---

## Dropdown component (in `ScreenplayEditor.tsx`)

State managed in `ScreenplayEditor`:

```ts
type AutoCompleteState = {
  rect: DOMRect;
  items: string[];
  select: (text: string) => void;
  activeIndex: number;
} | null;
```

### Positioning

The dropdown is a fixed-position `div` rendered via `ReactDOM.createPortal` into `document.body`. Position is set from `rect`:

```
top:  rect.bottom + 4px
left: rect.left
```

If the dropdown would overflow the bottom of the viewport, flip it above the block instead.

### Keyboard handling

A `keydown` listener is added to the editor's DOM element when the dropdown is open:

| Key | Action |
|-----|--------|
| `ArrowDown` | Increment `activeIndex` (wraps) |
| `ArrowUp` | Decrement `activeIndex` (wraps) |
| `Enter` / `Tab` | Call `select(items[activeIndex])`; close |
| `Escape` | Close without selecting |

The listener calls `preventDefault()` on all the above to prevent default editor behaviour.

### Visual style

- Uses the same `.block-picker` / `.block-picker-item` CSS classes already defined in `index.css` — no new styles needed.
- Active item uses `.block-picker-item.active`.
- Max height capped at ~200px with scroll if more than 8 items somehow appear.

---

## Data collection detail

**Character names:**
- Walk every node in `state.doc`
- Collect `node.textContent` for all nodes where `node.type.name === "character"`
- Deduplicate, count frequency, exclude the text currently in the active node

**Scene headings:**
- Same, but `node.type.name === "sceneHeading"`
- Full prefix match on the entire heading string (e.g. typing "INT." suggests "INT. APARTMENT - DAY", "INT. OFFICE - NIGHT")

---

## Edge cases

| Case | Behaviour |
|------|-----------|
| Only one script with no prior characters | No suggestions (nothing to match) |
| Current text matches no entries | Dropdown closes |
| User deletes all text in block | Dropdown closes (empty text → no filtering) |
| Mouse click outside dropdown | Dropdown closes (blur / click-away listener) |
| Tab key normally moves to next block type | When dropdown is open, Tab accepts suggestion instead; normal Tab behaviour resumes after close |

---

## Out of scope

- Fuzzy matching (prefix match only for v1)
- Suggestions from external sources (other scripts, character databases)
- Parenthetical or transition autocomplete
