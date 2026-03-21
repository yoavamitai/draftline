# Scene Heading Autocomplete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two context-aware suggestion modes to scene heading autocomplete — static prefix suggestions (`INT.`, `EXT.`, etc.) when typing the location prefix, and time-of-day suggestions (`DAY`, `NIGHT`, etc.) when typing after ` - `.

**Architecture:** Two new pure functions (`getSceneHeadingPrefixSuggestions`, `getTimeOfDaySuggestions`) are added to `src/lib/autocomplete.ts` alongside the existing `filterSuggestions`. The TipTap plugin in `src/editor/extensions/autoComplete.ts` is updated to branch on scene heading mode and build the appropriate `select` closure for each. Character block autocomplete is unchanged.

**Tech Stack:** TypeScript, TipTap 2 (ProseMirror plugin), Vitest

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/lib/autocomplete.ts` | Add `SCENE_HEADING_PREFIXES`, `TIME_OF_DAY` constants and two new pure functions |
| Modify | `src/lib/autocomplete.test.ts` | Unit tests for the two new functions |
| Modify | `src/editor/extensions/autoComplete.ts` | Branch scene heading handling; build mode-specific `select` closures |

---

## Task 1: Pure functions and unit tests

**Files:**
- Modify: `src/lib/autocomplete.ts`
- Modify: `src/lib/autocomplete.test.ts`

- [ ] **Step 1: Write failing tests**

Add these test cases to `src/lib/autocomplete.test.ts` (after the existing `filterSuggestions` describe block):

```ts
import {
  filterSuggestions,
  getSceneHeadingPrefixSuggestions,
  getTimeOfDaySuggestions,
  TIME_OF_DAY,
} from "./autocomplete";

// ... existing filterSuggestions tests ...

describe("getSceneHeadingPrefixSuggestions", () => {
  it("returns matching static prefixes before doc entries", () => {
    const entries: DocEntry[] = [
      { text: "INT. OFFICE - DAY", pos: 10 },
    ];
    const result = getSceneHeadingPrefixSuggestions("INT", entries, 999);
    expect(result[0]).toBe("INT.");
    expect(result).toContain("INT./EXT.");
    expect(result).toContain("INT. OFFICE - DAY");
    expect(result.indexOf("INT.")).toBeLessThan(result.indexOf("INT. OFFICE - DAY"));
  });

  it("returns only static matches when no doc entries match", () => {
    const entries: DocEntry[] = [
      { text: "EXT. PARK - DAY", pos: 10 },
    ];
    const result = getSceneHeadingPrefixSuggestions("INT", entries, 999);
    expect(result).toContain("INT.");
    expect(result).toContain("INT./EXT.");
    expect(result).not.toContain("EXT. PARK - DAY");
  });

  it("deduplicates case-insensitively, keeping static form", () => {
    // Doc entry 'int.' collides with static 'INT.' — static form wins
    const entries: DocEntry[] = [
      { text: "int.", pos: 10 },
    ];
    const result = getSceneHeadingPrefixSuggestions("INT", entries, 999);
    expect(result).toContain("INT.");
    expect(result).not.toContain("int.");
    // Should appear exactly once
    expect(result.filter(r => r.toLowerCase() === "int.")).toHaveLength(1);
  });

  it("caps total result at limit", () => {
    const entries: DocEntry[] = Array.from({ length: 20 }, (_, i) => ({
      text: `INT. ROOM_${i} - DAY`,
      pos: i * 10,
    }));
    const result = getSceneHeadingPrefixSuggestions("INT", entries, 999, 5);
    expect(result).toHaveLength(5);
  });

  it("returns empty when query does not match anything", () => {
    const entries: DocEntry[] = [{ text: "INT. OFFICE - DAY", pos: 10 }];
    expect(getSceneHeadingPrefixSuggestions("XYZ", entries, 999)).toEqual([]);
  });
});

describe("getTimeOfDaySuggestions", () => {
  it("filters TIME_OF_DAY by case-insensitive prefix match", () => {
    expect(getTimeOfDaySuggestions("D")).toContain("DAY");
    expect(getTimeOfDaySuggestions("D")).toContain("DAWN");
    expect(getTimeOfDaySuggestions("D")).not.toContain("NIGHT");
    expect(getTimeOfDaySuggestions("d")).toContain("DAY");
  });

  it("returns full TIME_OF_DAY list when query is empty", () => {
    expect(getTimeOfDaySuggestions("")).toEqual(TIME_OF_DAY);
  });

  it("returns full TIME_OF_DAY list when query is whitespace only", () => {
    expect(getTimeOfDaySuggestions("   ")).toEqual(TIME_OF_DAY);
  });

  it("returns empty array when non-empty query matches nothing", () => {
    expect(getTimeOfDaySuggestions("XYZ")).toEqual([]);
  });

  it("matches multi-word entries by prefix", () => {
    expect(getTimeOfDaySuggestions("MOM")).toContain("MOMENTS LATER");
    expect(getTimeOfDaySuggestions("moments")).toContain("MOMENTS LATER");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/lib/autocomplete.test.ts
```

Expected: failures like `getSceneHeadingPrefixSuggestions is not a function`.

- [ ] **Step 3: Implement the two new functions in `src/lib/autocomplete.ts`**

Add after the existing `filterSuggestions` function:

```ts
export const SCENE_HEADING_PREFIXES = ['INT.', 'EXT.', 'INT./EXT.', 'EXT./INT.'];

export const TIME_OF_DAY = ['DAY', 'NIGHT', 'DAWN', 'DUSK', 'CONTINUOUS', 'SAME', 'LATER', 'MOMENTS LATER'];

/**
 * Suggestions for the prefix portion of a scene heading (before ` - `).
 * Static prefixes come first; document entries follow, deduplicated.
 */
export function getSceneHeadingPrefixSuggestions(
  query: string,
  docEntries: DocEntry[],
  excludePos: number,
  limit = 8,
): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const staticMatches = SCENE_HEADING_PREFIXES.filter(p =>
    p.toLowerCase().startsWith(q)
  );

  const docMatches = filterSuggestions(docEntries, query, excludePos, limit);

  const seen = new Set(staticMatches.map(s => s.toLowerCase()));
  const merged = [...staticMatches];
  for (const doc of docMatches) {
    if (!seen.has(doc.toLowerCase())) {
      merged.push(doc);
      seen.add(doc.toLowerCase());
    }
  }

  return merged.slice(0, limit);
}

/**
 * Suggestions for the time-of-day portion of a scene heading (after ` - `).
 * Returns the full list when query is empty.
 */
export function getTimeOfDaySuggestions(query: string): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...TIME_OF_DAY];
  return TIME_OF_DAY.filter(t => t.toLowerCase().startsWith(q));
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/lib/autocomplete.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/autocomplete.ts src/lib/autocomplete.test.ts
git commit -m "feat: add getSceneHeadingPrefixSuggestions and getTimeOfDaySuggestions"
```

---

## Task 2: Update the plugin for scene heading mode branching

**Files:**
- Modify: `src/editor/extensions/autoComplete.ts`

**Context:** The current plugin (around lines 102–148) collects entries and calls `filterSuggestions`, then builds one `select` closure. The scene heading block must now branch into prefix mode or time mode, each with its own items and `select` logic.

- [ ] **Step 1: Update imports**

At the top of `src/editor/extensions/autoComplete.ts`, add the two new imports:

```ts
import {
  filterSuggestions,
  getSceneHeadingPrefixSuggestions,
  getTimeOfDaySuggestions,
} from "../../lib/autocomplete";
import type { DocEntry } from "../../lib/autocomplete";
```

- [ ] **Step 2: Replace the scene heading suggestion block in the plugin**

Locate this section in `autoComplete.ts` (inside the `update(view)` method, roughly lines 102–148):

```ts
// Collect all top-level nodes of the matching type.
const currentBlockStart = $from.start() - 1;
const entries: DocEntry[] = [];
state.doc.forEach((node, pos) => {
  if (node.type.name === blockType) {
    entries.push({ text: node.textContent, pos });
  }
});

const items = filterSuggestions(entries, currentText, currentBlockStart);

if (items.length === 0) {
  if (ext.storage.isOpen) {
    ext.storage.isOpen = false;
    ext.options.onClose();
  }
  return;
}

// Get the DOM element of the current block for positioning.
const domResult = view.domAtPos(currentBlockStart + 1);
const blockDom = domResult.node instanceof HTMLElement
  ? domResult.node
  : (domResult.node.parentElement as HTMLElement | null);
if (!blockDom) return;
const rect = blockDom.getBoundingClientRect();

// select replaces the current block's full text content.
const select = (text: string) => {
  ext.editor.chain().focus().command(({ tr, state }) => {
    const { $from: f } = state.selection;
    tr.insertText(text, f.start(), f.end());
    return true;
  }).run();
};

ext.storage.isOpen = true;
ext.options.onOpen(rect, items, select);
```

Replace it with:

```ts
// Collect all top-level nodes of the matching type.
const currentBlockStart = $from.start() - 1;
const entries: DocEntry[] = [];
state.doc.forEach((node, pos) => {
  if (node.type.name === blockType) {
    entries.push({ text: node.textContent, pos });
  }
});

// --- Mode branching for scene headings ---
let items: string[];
let select: (text: string) => void;

if (blockType === "sceneHeading" && currentText.includes(" - ")) {
  // TIME MODE: cursor is in the time-of-day portion (after " - ")
  const dashIdx = currentText.lastIndexOf(" - ");
  const timeQuery = currentText.slice(dashIdx + 3); // text after " - "
  items = getTimeOfDaySuggestions(timeQuery);

  // select replaces only the suffix (everything after " - "), re-reading state at call time.
  select = (text: string) => {
    ext.editor.chain().focus().command(({ tr, state }) => {
      const { $from: f } = state.selection;
      if (f.parent.type.name !== "sceneHeading") return false;
      const blockText = f.parent.textContent;
      const idx = blockText.lastIndexOf(" - ");
      if (idx === -1) return false; // block was edited — no-op
      const preserved = blockText.slice(0, idx + 3); // keep up to and including " - "
      tr.insertText(preserved + text, f.start(), f.end());
      return true;
    }).run();
  };
} else if (blockType === "sceneHeading") {
  // PREFIX MODE: cursor is in the prefix/location portion (no " - " yet)
  items = getSceneHeadingPrefixSuggestions(currentText, entries, currentBlockStart);

  // select replaces the full block text (existing behavior).
  select = (text: string) => {
    ext.editor.chain().focus().command(({ tr, state }) => {
      const { $from: f } = state.selection;
      tr.insertText(text, f.start(), f.end());
      return true;
    }).run();
  };
} else {
  // CHARACTER MODE (and any future block types): document-based suggestions only.
  items = filterSuggestions(entries, currentText, currentBlockStart);

  select = (text: string) => {
    ext.editor.chain().focus().command(({ tr, state }) => {
      const { $from: f } = state.selection;
      tr.insertText(text, f.start(), f.end());
      return true;
    }).run();
  };
}
// --- End mode branching ---

if (items.length === 0) {
  if (ext.storage.isOpen) {
    ext.storage.isOpen = false;
    ext.options.onClose();
  }
  return;
}

// Get the DOM element of the current block for positioning.
const domResult = view.domAtPos(currentBlockStart + 1);
const blockDom = domResult.node instanceof HTMLElement
  ? domResult.node
  : (domResult.node.parentElement as HTMLElement | null);
if (!blockDom) return;
const rect = blockDom.getBoundingClientRect();

ext.storage.isOpen = true;
ext.options.onOpen(rect, items, select);
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Manual smoke test**

Run `npm run tauri dev` and verify:

1. In a **scene heading** block, type `I` — dropdown shows `INT.` and `INT./EXT.` from the static list
2. Type `INT.` then press space — dropdown disappears (no static prefix starts with `INT. `)
3. Continue typing a location, add ` - ` — dropdown reappears with the full time-of-day list (`DAY`, `NIGHT`, `DAWN`, etc.)
4. Type `D` after ` - ` — dropdown filters to `DAY`, `DAWN`, `DUSK`
5. Select `DAY` via Tab/Enter — only the time portion is replaced; the location text before ` - ` is preserved
6. In a **character** block, autocomplete still works as before (document-based only)

- [ ] **Step 5: Commit**

```bash
git add src/editor/extensions/autoComplete.ts
git commit -m "feat: scene heading autocomplete — prefix and time-of-day modes"
```
