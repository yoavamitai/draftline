# Title Page — Design Spec

**Date:** 2026-03-21
**Status:** Approved

---

## Overview

Add an editable screenplay title page that appears as the first rendered page of the document, above the script body. The title page fully supports the Fountain title page spec: arbitrary key-value pairs, multi-line indented values, and round-trip fidelity on file load and save.

---

## 1. Data Model

### Types

`TitlePageField` and `TitlePageData` are defined in `src/types/screenplay.ts` alongside existing domain types:

```ts
export interface TitlePageField {
  key: string;       // e.g. "Title", "Author", "Draft date", "WGA"
  values: string[];  // one newline-free string per line; multi-line = values.length > 1
}

export interface TitlePageData {
  fields: TitlePageField[];
}
```

Each entry in `values` is a single line — entries never contain embedded newlines. Multi-line means `values.length > 1`.

### Store Slice

Added to `AppStore` in `useAppStore.ts` (alongside existing actions, not in the serialized `AppState` — the file is the source of truth):

```ts
titlePage: TitlePageData;                                          // initial: { fields: [] }
setTitlePageFields: (fields: TitlePageField[]) => void;
updateTitlePageField: (index: number, field: TitlePageField) => void;
addTitlePageField: (field: TitlePageField) => void;
removeTitlePageField: (key: string) => void;                  // remove by key
clearTitlePage: () => void;                                        // resets to { fields: [] }
```

`titlePage` is **not** added to `partialize` — the file on disk is the source of truth, just like editor content.

### Standard Fountain keys (`Title`, `Credit`, `Author`/`Authors`, `Source`, `Draft date`, `Contact`) receive special layout treatment in the UI; all other keys are custom metadata displayed in the lower-left area.

`"Written by"` is the conventional value for `Credit`, not a fixed label — the user can edit it freely.

---

## 2. File Lifecycle

### New File

A `newFile()` function is added to `fileManager.ts`. It clears the editor content, calls `clearTitlePage()`, and resets `filePath` and `isDirty` in the store. The `<TitlePage />` renders with all fields empty (placeholder text shown).

### Open File

1. Call `invoke("read_file", ...)`.
2. If successful: parse the result in memory first (`fountainToTiptap`), then — only after a successful parse — call `clearTitlePage()`, `setTitlePageFields(parsedTitlePage.fields)`, and load the doc into the editor. This ensures the store is never left in a partially-cleared state if parsing throws.
3. If `read_file` or parsing throws: do not mutate `titlePage` or editor content.

---

## 3. TitlePage Component

### Placement

A `<TitlePage />` React component is rendered directly above `<ScreenplayEditor />` in the scrollable content area of `AppShell`. A visual page-break separator (matching the existing `PageBreaks` extension style) separates the title page from the first page of script.

`AppShell` passes the `editor` instance as a prop to `<TitlePage />` (it already holds the editor ref for `AppSidebar` and `StatusBar`).

### Layout

The component renders as a screenplay-sized page (matching `.screenplay-page` dimensions — US Letter, standard screenplay margins).

**Centered block (upper half):**
- `Title` values — one per line
- `Credit` value (e.g. "Written by")
- `Author`/`Authors` values — one per line
- `Source` values — one per line

**Lower-left block:**
- `Contact` values — one per line
- `Draft date` value
- Any custom/unknown fields — displayed as `Key: value` pairs

### Inline Editing

- Each field value is a `contenteditable` div. Clicking focuses it for editing.
- Empty fields display a dimmed placeholder label (e.g. `"Title..."`, `"Author..."`).
- Multi-value fields (e.g. `Title`, `Contact`) support multiple lines. Pressing Enter appends a new value line; Backspace on an empty line removes it.
- Every edit dispatches `setDirty(true)` so auto-save triggers. Note: for unsaved new files (`filePath === null`), auto-save silently skips — this is consistent with existing body-editor behavior; the user must manually save.
- A subtle `+ Add field` button at the bottom-left appends `{ key: "Custom", values: [""] }` and focuses the key label for renaming.

### Custom Field Key Editing

- The key label for custom fields is a `contenteditable` span.
- Changes are committed on blur or Enter.
- If the key is left empty or whitespace-only on commit, the field is removed.
- Duplicate keys are allowed (Fountain permits multiple entries for the same key).
- If the user never renames the default `"Custom"` key, it is saved to disk as `Custom:` — this is valid Fountain.

### Tab Order

Tab moves focus through title page fields in document order. At the last field, Tab moves focus into the TipTap editor body via `editor.commands.focus()`. Shift+Tab at the first title page field does nothing.

### Fountain Inline Formatting

Values are stored and edited as raw text. Fountain inline emphasis (`_italics_`, `**bold**`, `_**both**_`) is preserved on disk but not rendered in the editor — the user sees and edits the raw markup.

---

## 4. Fountain Serialization

### Writing (tiptapToFountain)

```ts
export function tiptapToFountain(doc: TDoc, titlePage?: TitlePageData): string
```

The second argument is optional and defaults to `{ fields: [] }`. `saveFile` in `fileManager.ts` passes `useAppStore.getState().titlePage` as the second argument.

**Empty field definition:** A field is empty if every entry in `values` is an empty or whitespace-only string. A `TitlePageData` is empty if `fields` is empty or all fields are empty. If the entire title page is empty, no title block is written.

**Serialization rules:**
- Single-value fields: `Key: value`
- Multi-value fields (`values.length > 1`): key alone on its line, each value indented with 4 spaces
- Keys are preserved exactly as stored — `Author` and `Authors` are not normalized to each other; round-trip fidelity takes priority.

The title block string is assembled independently of the script body string. The existing `.trim()` and `\n{3,}` normalization in `tiptapToFountain` applies only to the body portion. The final output is `titleBlock + "\n\n" + body.trim()` — the two-blank-line separator is appended after the title block, not subject to collapse.

```
Title:
    _**MY SCREENPLAY**_
Credit: Written by
Author: Jane Smith
Draft date: 3/21/2026
Contact:
    123 Main St
    Los Angeles, CA 90001
    jane@example.com

```

(Two blank lines follow the title block before the first script line.)

### Reading (fountainToTiptap)

**Return type change** (breaking — all call sites must be updated):

```ts
// Before
export function fountainToTiptap(source: string): TDoc

// After
export function fountainToTiptap(source: string): { doc: TDoc; titlePage: TitlePageData }
```

Known call sites to update: `fileManager.ts` (`openFile`), and any existing tests in `fountain.test.ts`. `startAutoSave` calls `saveFile(editor)` which internally reads from the store — no change needed to `startAutoSave`.

**Title block extraction** is a manual pre-pass before calling fountain-js, because fountain-js token handling for title pages is not relied upon. The algorithm:

1. Split the source into lines.
2. Read lines from the top. A **key line** matches `/^([A-Za-z][A-Za-z0-9 ]*):(.*)$/` — a word-only key (letters, digits, spaces only) ending in `:`. This deliberately excludes scene headings like `EXT. PLACE: DAY` (which contain `.` before the `:`). It also excludes hyphenated keys like `Co-author` — this is a conscious trade-off for simplicity; such keys in third-party files will be treated as script body, not title-page fields.
3. A **continuation line** starts with 3+ spaces or a tab.
4. Stop at the first truly blank line (zero characters or only a newline). A line with only spaces or a tab is treated as a continuation line and produces an empty string entry in `values[]`, not a stop.
5. If the first non-blank line is not a key line, there is no title block — return `fields: []` and pass the full source to fountain-js.
6. Otherwise collect all key/continuation pairs into `TitlePageField[]`.

The remainder of the source (from the first blank line onward) is passed to `new Fountain().parse()` unchanged.

**Indentation:** Read accepts 3+ spaces or tab; write emits 4 spaces. Files with 3-space indentation are normalized to 4-space on the first save — this is intentional and acceptable.

---

## 5. Testing

Unit tests in `src/lib/fountain.test.ts` (new `describe` block for title page):

| Scenario | Expected |
|---|---|
| Parse full title block (all standard keys, multi-line Contact) | Correct `TitlePageField[]` |
| Parse file with no title block | `fields: []`; script body parsed normally |
| Parse multi-line indented values (3-space, 4-space, tab) | Multiple entries in `values[]` |
| Parse single-line inline value | `values: ["value"]` |
| Parse unknown/custom key | Preserved in `fields` array |
| First line is `EXT. PLACE: DAY` (scene heading with colon) | No title block detected |
| Serialize full `TitlePageData` | Correct Fountain key-value format |
| Serialize with all-whitespace field values | Field omitted from output |
| Serialize empty `TitlePageData` (no second arg) | No title block prepended |
| Round-trip: parse → serialize → parse | Identical `fields` result |
| Round-trip: 3-space indented input | Values preserved; output uses 4-space indent |

The `TitlePage` React component is exercised manually via `npm run tauri dev`.

---

## 6. Out of Scope

- Rendering Fountain inline emphasis (`_**bold italic**_`) as formatted text in the editor
- Printing or PDF export of the title page
- Per-field character limits or validation
