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
| `src/editor/extensions/autoComplete.ts` | TipTap Extension — ProseMirror plugin, data collection, keyboard shortcuts, callback interface |
| `src/editor/ScreenplayEditor.tsx` | Renders the dropdown as a React portal; handles mouse interaction and visual keyboard state |

The extension is the brain; React is the display layer. This mirrors the existing `SlashCommand` ↔ block picker pattern exactly.

---

## The Extension (`autoComplete.ts`)

### Plugin behaviour

A ProseMirror plugin fires on every transaction. Each run:

1. Resolves the cursor position to find the current block's node type and its document start/end positions.
2. If the block type is **not** `character` or `sceneHeading`, and the dropdown is currently open, calls `onClose()` and marks internal state as closed. If already closed, does nothing (no redundant `onClose` calls).
3. Walks the full document, collecting `node.textContent` for all nodes of the matching type **whose start position differs from the current block's start position** (exclusion by position, not text value — so duplicate names like two `JOHN` blocks are handled correctly).
4. Deduplicates, counts frequency, sorts descending.
5. Filters to entries that start with the current block's text (case-insensitive, trimmed). Caps at 8 items.
6. If the current block text is empty or no matches remain: if dropdown is open, calls `onClose()` and marks closed. Otherwise does nothing.
7. Otherwise, obtains the DOM rect of the current block's DOM node via `view.domAtPos(blockStart + 1).node` and calls `onOpen(rect, items, select)`. Marks internal state as open. **Each `onOpen` call supersedes the previous one entirely** — React must replace all of `{ rect, items, select, activeIndex }` on every call.

### `select(text)` callback

Replaces the entire inline content of the current block:

```ts
editor.chain().focus().command(({ tr, state }) => {
  const { $from } = state.selection;
  const start = $from.start(); // start of block's text content (not selection.from)
  const end = $from.end();     // end of block's text content (not selection.to)
  // NOTE: do NOT use selection.from/selection.to — those reflect cursor position
  // within the block, not the full block range.
  tr.insertText(text, start, end);
  return true;
}).run();
```

### Keyboard shortcut interception — `addKeyboardShortcuts()`

Tab and Enter must be intercepted **inside the TipTap extension** via `addKeyboardShortcuts()`, not via a DOM `keydown` listener. This is critical because `SmartKeymap` already handles Tab and Enter for `character` and `sceneHeading` blocks via its own `addKeyboardShortcuts()`. TipTap resolves shortcut conflicts by extension priority order.

`AutoComplete` must be registered **before** `SmartKeymap` in the extensions array (earlier = higher priority in TipTap's keybinding resolution):

```ts
// In ScreenplayEditor extensions array:
AutoComplete.configure({ ... }),
SmartKeymap,   // lower priority — only fires if AutoComplete didn't consume
```

The extension's shortcut handlers:

```ts
addKeyboardShortcuts() {
  return {
    Tab: () => {
      if (!dropdownOpen) return false; // let SmartKeymap handle it
      selectActive();
      return true;
    },
    Enter: () => {
      if (!dropdownOpen) return false;
      selectActive();
      return true;
    },
    Escape: () => {
      if (!dropdownOpen) return false;
      dropdownOpen = false;       // set before onClose — guard against re-entry
      this.options.onClose();
      return true;
    },
    ArrowDown: () => {
      if (!dropdownOpen) return false;
      this.options.onNavigate('down');
      return true;
    },
    ArrowUp: () => {
      if (!dropdownOpen) return false;
      this.options.onNavigate('up');
      return true;
    },
  };
}
```

`dropdownOpen` is a closure variable within the extension (not ProseMirror state). The `Escape` handler sets `dropdownOpen = false` **before** calling `onClose()` to keep the idempotency guard intact. The React `onClose` handler must also be safe to call when the dropdown is already closed (treat as a no-op if state is already `null`).

`selectActive()` calls `this.options.onSelect()` which the React side wires to call `select(items[activeIndex])`.
`onNavigate` is an additional option callback that tells React to increment/decrement `activeIndex`.

### Options interface

```ts
interface AutoCompleteOptions {
  onOpen:     (rect: DOMRect, items: string[], select: (text: string) => void) => void;
  onClose:    () => void;  // must be idempotent — safe to call when already closed
  onNavigate: (direction: 'up' | 'down') => void;
  onSelect:   () => void;
}
```

---

## Dropdown component (in `ScreenplayEditor.tsx`)

State:

```ts
type AutoCompleteState = {
  rect: DOMRect;
  items: string[];
  select: (text: string) => void;
  activeIndex: number;
} | null;
```

`onOpen` fully replaces this state (including `select` and `activeIndex` reset to 0) on every call.

### Positioning

Fixed-position `div` via `ReactDOM.createPortal` into `document.body`:

```
top:  rect.bottom + 4px   (or rect.top - dropdownHeight - 4px if bottom overflows viewport)
left: rect.left
```

Horizontal overflow (right edge of viewport) is **out of scope for v1** — the dropdown may clip on very narrow windows.

### Visual style

Uses existing `.block-picker` / `.block-picker-item` / `.block-picker-item.active` CSS classes. No new styles needed. Max height ~200px with scroll.

Click on an item calls `select(item)` and closes.

Click-outside closes the dropdown (mousedown listener on `document`).

---

## Data collection detail

**Character names:** collect `node.textContent` from all `character` nodes whose `pos !== currentBlockStart`.

**Scene headings:** same, from `sceneHeading` nodes. Full prefix match on the entire heading string (e.g. typing `"INT."` suggests `"INT. APARTMENT - DAY"`, `"INT. OFFICE - NIGHT"`).

---

## Edge cases

| Case | Behaviour |
|------|-----------|
| No prior entries of that type | No suggestions shown |
| Current text matches nothing | Dropdown closes |
| Empty block | Dropdown closes |
| Two blocks with identical text (e.g. two `JOHN` blocks) | Both count toward frequency; exclusion is by position so `JOHN` still appears as a suggestion from the other block |
| Tab / Enter when dropdown open | AutoComplete extension intercepts (higher priority than SmartKeymap); SmartKeymap does not fire |
| Tab / Enter when dropdown closed | AutoComplete passes (`return false`); SmartKeymap fires normally |
| Mouse click outside dropdown | `mousedown` listener closes dropdown |
| `onClose` called when already closed | Suppressed — extension only calls `onClose` on open→closed transition |

---

## Out of scope

- Fuzzy matching (prefix only for v1)
- Horizontal viewport overflow clipping
- Suggestions from external sources or other scripts
- Parenthetical or transition autocomplete
