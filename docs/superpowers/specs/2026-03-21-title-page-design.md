# Title Page — Design Spec

**Date:** 2026-03-21
**Status:** Approved

---

## Overview

Add an editable screenplay title page that appears as the first rendered page of the document, above the script body. The title page fully supports the Fountain title page spec: arbitrary key-value pairs, multi-line indented values, and round-trip fidelity on file load and save.

---

## 1. Data Model

Title page data lives in a `titlePage` slice of the Zustand store.

```ts
interface TitlePageField {
  key: string;       // e.g. "Title", "Author", "Draft date", "WGA"
  values: string[];  // one entry per line (supports multi-line values)
}

interface TitlePageData {
  fields: TitlePageField[];
}
```

Fields are stored as an ordered array to preserve round-trip ordering. The standard Fountain keys (`Title`, `Credit`, `Author`/`Authors`, `Source`, `Draft date`, `Contact`) receive special layout treatment in the UI; all other keys are treated as custom metadata and displayed in the lower-left area.

`"Written by"` is the conventional value for `Credit`, not a fixed label — the user can edit it freely.

---

## 2. TitlePage Component

### Placement

A `<TitlePage />` React component is rendered directly above `<ScreenplayEditor />` in the scrollable content area of `AppShell`. A visual page-break separator (matching the existing `PageBreaks` extension style) separates the title page from the first page of script.

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
- Multi-value fields (e.g. `Title`, `Contact`) support multiple lines. Pressing Enter within a multi-value field appends a new value line; pressing Backspace on an empty line removes it.
- A subtle `+ Add field` button at the bottom-left lets the user add a custom Fountain key. Clicking it appends a new `{ key: "Custom", values: [""] }` entry and focuses the key label for renaming.
- Tab moves focus between fields in document order.

### Fountain Inline Formatting

Values are stored and edited as raw text. Fountain inline emphasis (`_italics_`, `**bold**`, `_**both**_`) is preserved on disk but not rendered in the editor — the user sees and edits the raw markup.

---

## 3. Fountain Serialization

### Writing (tiptapToFountain)

`tiptapToFountain` is extended to accept the `TitlePageData` store value as a second argument and prepend the title block.

**Serialization rules:**
- If all `fields` are empty (or `fields` is empty), no title block is written — the file starts directly with the script content.
- Single-line values are written inline: `Key: value`
- Multi-line values: the key appears alone on its first line; each value is indented with 4 spaces:

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

- Two blank lines separate the title block from the first line of script content (Fountain's implicit page break).

### Reading (fountainToTiptap)

`fountainToTiptap` is extended to parse and return the title page separately from the script body.

**Parsing rules:**
- The title block is the leading sequence of `Key: value` lines before the first blank line, where each key ends with a colon.
- Indented lines (3+ spaces or a tab) following a key are additional values for that key.
- Parsed fields are returned as `TitlePageField[]` and loaded into the Zustand store. The remainder of the source is parsed as the script body as before.
- If no title block is detected, `fields` is set to `[]`.

**Return type change:**

```ts
// Before
export function fountainToTiptap(source: string): TDoc

// After
export function fountainToTiptap(source: string): { doc: TDoc; titlePage: TitlePageData }
```

---

## 4. Testing

Unit tests in `src/lib/fountain.test.ts`:

| Scenario | Expected |
|---|---|
| Parse full title block (all standard keys, multi-line Contact) | Correct `TitlePageField[]` with values arrays |
| Parse file with no title block | `fields: []` |
| Parse multi-line indented values | Multiple entries in `values[]` |
| Parse single-line value inline | `values: ["value"]` |
| Parse unknown/custom key | Preserved in `fields` array |
| Serialize full `TitlePageData` | Correct Fountain key-value format |
| Serialize empty `TitlePageData` | No title block prepended |
| Round-trip: parse → serialize → parse | Identical `fields` result |

The `TitlePage` React component is exercised manually via `npm run tauri dev`.

---

## 5. Out of Scope

- Rendering Fountain inline emphasis (`_**bold italic**_`) as formatted text in the editor
- Printing or PDF export of the title page
- Per-field character limits or validation
