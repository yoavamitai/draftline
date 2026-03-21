# Title Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an editable screenplay title page rendered as the first page of the document, with full Fountain title-page round-trip support.

**Architecture:** A standalone `TitlePage` React component renders above `ScreenplayEditor` in `AppShell`, using `<textarea>` elements for inline editing. Title page data lives in a Zustand slice (not persisted — the file is the source of truth). `fountainToTiptap` is extended to extract and return a title page block before passing the remainder to fountain-js; `tiptapToFountain` is extended to prepend the title block to the body output.

**Tech Stack:** React 18, Zustand, Vitest (unit tests for pure functions only)

**Spec:** `docs/superpowers/specs/2026-03-21-title-page-design.md`

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `src/types/screenplay.ts` | Add `TitlePageField`, `TitlePageData` types |
| Modify | `src/store/useAppStore.ts` | Add `titlePage` state + 5 actions |
| Modify | `src/lib/fountain.ts` | Update `fountainToTiptap` return type; extend `tiptapToFountain` |
| Modify | `src/lib/fountain.test.ts` | Fix broken call sites; add title page tests |
| Modify | `src/lib/fileManager.ts` | Update `openFile`, `saveFile`; add `newFile` |
| Create | `src/components/TitlePage.tsx` | Editable title page component |
| Modify | `src/components/AppShell.tsx` | Render `<TitlePage />` above the editor |

---

## Task 1: Add types

**Files:**
- Modify: `src/types/screenplay.ts`

- [ ] **Step 1: Add types**

Append to the bottom of `src/types/screenplay.ts`:

```ts
export interface TitlePageField {
  key: string;       // e.g. "Title", "Author", "Draft date"
  values: string[];  // one newline-free string per line
}

export interface TitlePageData {
  fields: TitlePageField[];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/screenplay.ts
git commit -m "feat: add TitlePageField and TitlePageData types"
```

---

## Task 2: Add Zustand store slice

**Files:**
- Modify: `src/store/useAppStore.ts`

- [ ] **Step 1: Extend `AppStore` interface**

Add to the `interface AppStore extends AppState` block (after the last existing action):

```ts
titlePage: TitlePageData;
setTitlePageField: (key: string, values: string[]) => void;  // upsert by key
setTitlePageFields: (fields: TitlePageField[]) => void;       // replace all (used on file open)
addTitlePageField: (field: TitlePageField) => void;           // append custom field
removeTitlePageField: (key: string) => void;                  // remove by key
clearTitlePage: () => void;                                   // reset to { fields: [] }
```

- [ ] **Step 2: Add import**

Add to the imports at the top of `useAppStore.ts`:

```ts
import type { AppState, RevisionColor, TitlePageField, TitlePageData } from "../types/screenplay";
```

- [ ] **Step 3: Add initial state and implementations**

`titlePage` is **not** in `AppState` (it is not persisted). Do not touch `initialState`. Instead, add the new fields directly inside the `create(...)` callback, **before** the `...initialState` spread. The full updated `create` call looks like:

```ts
export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      titlePage: { fields: [] } as TitlePageData,   // <-- add here, before ...initialState
      ...initialState,
      setFilePath: (filePath) => set({ filePath }),
      // ... rest of existing actions unchanged ...
```

Add the new action implementations after the existing actions:

```ts
titlePage: { fields: [] } as TitlePageData,
setTitlePageField: (key, values) =>
  set((s) => {
    const idx = s.titlePage.fields.findIndex(
      (f) => f.key.toLowerCase() === key.toLowerCase(),
    );
    if (idx === -1) {
      return { titlePage: { fields: [...s.titlePage.fields, { key, values }] } };
    }
    const updated = [...s.titlePage.fields];
    updated[idx] = { key, values };
    return { titlePage: { fields: updated } };
  }),
setTitlePageFields: (fields) => set({ titlePage: { fields } }),
addTitlePageField: (field) =>
  set((s) => ({ titlePage: { fields: [...s.titlePage.fields, field] } })),
removeTitlePageField: (key) =>
  set((s) => ({
    titlePage: {
      fields: s.titlePage.fields.filter(
        (f) => f.key.toLowerCase() !== key.toLowerCase(),
      ),
    },
  })),
clearTitlePage: () => set({ titlePage: { fields: [] } }),
```

- [ ] **Step 4: Commit**

```bash
git add src/store/useAppStore.ts
git commit -m "feat: add titlePage slice to Zustand store"
```

---

## Task 3: Fountain parsing — tests first, then implementation

**Files:**
- Modify: `src/lib/fountain.ts`
- Modify: `src/lib/fountain.test.ts`

- [ ] **Step 1: Write failing tests**

Open `src/lib/fountain.test.ts`. The existing `fountainToTiptap` tests call `fountainToTiptap(fountain)` and use the result directly as a doc. After the return type change they must destructure `{ doc }`. **Update the existing tests first:**

```ts
describe("fountainToTiptap", () => {
  it("round-trips a simple document", () => {
    const fountain = tiptapToFountain(SIMPLE_DOC);
    const { doc } = fountainToTiptap(fountain);   // <-- destructure
    const types = doc.content.map((n: any) => n.type);
    expect(types).toContain("sceneHeading");
    expect(types).toContain("action");
    expect(types).toContain("character");
    expect(types).toContain("dialogue");
  });
});
```

Then add a new `describe` block for title page parsing:

```ts
import type { TitlePageField } from "../types/screenplay";

describe("title page — parsing (fountainToTiptap)", () => {
  it("returns empty fields for a file with no title block", () => {
    const source = "\nINT. COFFEE SHOP - DAY\n\nSarah sits.\n";
    const { titlePage } = fountainToTiptap(source);
    expect(titlePage.fields).toEqual([]);
  });

  it("does not treat scene heading with colon as a title key", () => {
    const source = "EXT. PLACE: DAY\n\nAction.\n";
    const { titlePage } = fountainToTiptap(source);
    expect(titlePage.fields).toEqual([]);
  });

  it("parses single-line inline value", () => {
    const source = "Credit: Written by\n\nAction.\n";
    const { titlePage } = fountainToTiptap(source);
    expect(titlePage.fields).toEqual([{ key: "Credit", values: ["Written by"] }]);
  });

  it("parses multi-line indented values (4-space)", () => {
    const source = "Contact:\n    123 Main St\n    LA, CA\n\nAction.\n";
    const { titlePage } = fountainToTiptap(source);
    expect(titlePage.fields).toContainEqual({ key: "Contact", values: ["123 Main St", "LA, CA"] });
  });

  it("parses multi-line indented values (3-space)", () => {
    const source = "Contact:\n   123 Main St\n   LA, CA\n\nAction.\n";
    const { titlePage } = fountainToTiptap(source);
    expect(titlePage.fields).toContainEqual({ key: "Contact", values: ["123 Main St", "LA, CA"] });
  });

  it("parses multi-line indented values (tab)", () => {
    const source = "Contact:\n\t123 Main St\n\tLA, CA\n\nAction.\n";
    const { titlePage } = fountainToTiptap(source);
    expect(titlePage.fields).toContainEqual({ key: "Contact", values: ["123 Main St", "LA, CA"] });
  });

  it("parses a full title block with all standard keys", () => {
    const source = [
      "Title:",
      "    MY SCREENPLAY",
      "Credit: Written by",
      "Author: Jane Smith",
      "Draft date: 3/21/2026",
      "Contact:",
      "    123 Main St",
      "    LA, CA",
      "",
      "INT. OFFICE - DAY",
    ].join("\n");
    const { titlePage, doc } = fountainToTiptap(source);
    expect(titlePage.fields.find((f) => f.key === "Title")?.values).toEqual(["MY SCREENPLAY"]);
    expect(titlePage.fields.find((f) => f.key === "Author")?.values).toEqual(["Jane Smith"]);
    expect(doc.content[0].type).toBe("sceneHeading");
  });

  it("preserves unknown custom keys", () => {
    const source = "Notes: WGA #12345\n\nAction.\n";
    const { titlePage } = fountainToTiptap(source);
    expect(titlePage.fields).toContainEqual({ key: "Notes", values: ["WGA #12345"] });
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

```bash
npx vitest run src/lib/fountain.test.ts
```

Expected: existing `fountainToTiptap` test fails (destructuring), new title page tests fail (function not returning `{ doc, titlePage }`).

- [ ] **Step 3: Implement the updated `fountainToTiptap`**

First, add an import at the top of `src/lib/fountain.ts` (with the existing imports):

```ts
import type { TitlePageData, TitlePageField } from "../types/screenplay";
```

Then replace the existing `fountainToTiptap` function with:

const TITLE_KEY_RE = /^([A-Za-z][A-Za-z0-9 ]*):(.*)$/;
const CONTINUATION_RE = /^(\t| {3,})(.*)/;

function extractTitlePage(source: string): { fields: TitlePageField[]; bodySource: string } {
  const lines = source.split("\n");
  const fields: TitlePageField[] = [];
  let i = 0;

  // Skip truly blank leading lines
  while (i < lines.length && lines[i] === "") i++;

  // If first non-blank line is not a key line, no title block
  if (i >= lines.length || !TITLE_KEY_RE.test(lines[i])) {
    return { fields: [], bodySource: source };
  }

  let currentField: TitlePageField | null = null;

  while (i < lines.length) {
    const line = lines[i];

    // Truly blank line terminates the title block
    if (line === "" || line === "\r") {
      i++;
      break;
    }

    const keyMatch = TITLE_KEY_RE.exec(line);
    const contMatch = CONTINUATION_RE.exec(line);

    if (keyMatch) {
      currentField = { key: keyMatch[1], values: [] };
      const inline = keyMatch[2].trim();
      if (inline) currentField.values.push(inline);
      fields.push(currentField);
    } else if (contMatch && currentField) {
      currentField.values.push(contMatch[2]);
    } else {
      // Non-key, non-continuation, non-blank: end of block
      break;
    }
    i++;
  }

  const bodySource = lines.slice(i).join("\n");
  return { fields, bodySource };
}

export function fountainToTiptap(source: string): { doc: TDoc; titlePage: TitlePageData } {
  const { fields, bodySource } = extractTitlePage(source);

  const parsed = new Fountain().parse(bodySource, true);
  const content: TNode[] = [];

  for (const token of parsed.tokens ?? []) {
    const text = (token.text ?? "").replace(/<[^>]+>/g, "");
    switch (token.type) {
      case "scene_heading":
        content.push({ type: "sceneHeading", content: [{ type: "text", text }] });
        break;
      case "action":
        content.push({ type: "action", content: [{ type: "text", text }] });
        break;
      case "character":
        content.push({ type: "character", content: [{ type: "text", text }] });
        break;
      case "dialogue":
        content.push({ type: "dialogue", content: [{ type: "text", text }] });
        break;
      case "parenthetical":
        content.push({ type: "parenthetical", content: [{ type: "text", text }] });
        break;
      case "transition":
        content.push({ type: "transition", content: [{ type: "text", text }] });
        break;
      case "section":
        content.push({
          type: "section",
          attrs: { level: token.depth ?? 1 },
          content: [{ type: "text", text }],
        });
        break;
      case "note":
        content.push({ type: "screenplayNote", content: [{ type: "text", text }] });
        break;
    }
  }

  if (content.length === 0) {
    content.push({ type: "action", content: [{ type: "text", text: "" }] });
  }

  return { doc: { type: "doc", content }, titlePage: { fields } };
}
```

- [ ] **Step 4: Run tests — expect passing**

```bash
npx vitest run src/lib/fountain.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/fountain.ts src/lib/fountain.test.ts
git commit -m "feat: fountainToTiptap extracts and returns title page block"
```

---

## Task 4: Fountain serialization — tests first, then implementation

**Files:**
- Modify: `src/lib/fountain.ts`
- Modify: `src/lib/fountain.test.ts`

- [ ] **Step 1: Write failing tests**

Add a new `describe` block to `src/lib/fountain.test.ts`:

```ts
describe("title page — serialization (tiptapToFountain)", () => {
  const EMPTY_DOC = {
    type: "doc" as const,
    content: [{ type: "action", content: [{ type: "text", text: "Action line." }] }],
  };

  it("produces no title block when titlePage is omitted", () => {
    const result = tiptapToFountain(EMPTY_DOC);
    expect(result).not.toContain("Title:");
    expect(result.trimStart()[0]).not.toBe(" ");
  });

  it("produces no title block when titlePage has empty fields", () => {
    const result = tiptapToFountain(EMPTY_DOC, { fields: [] });
    expect(result).not.toContain("Title:");
  });

  it("produces no title block when all field values are whitespace-only", () => {
    const result = tiptapToFountain(EMPTY_DOC, {
      fields: [{ key: "Title", values: ["   "] }],
    });
    expect(result).not.toContain("Title:");
  });

  it("serializes a single-value field inline", () => {
    const result = tiptapToFountain(EMPTY_DOC, {
      fields: [{ key: "Credit", values: ["Written by"] }],
    });
    expect(result).toContain("Credit: Written by");
  });

  it("serializes a multi-value field with 4-space indentation", () => {
    const result = tiptapToFountain(EMPTY_DOC, {
      fields: [{ key: "Contact", values: ["123 Main St", "LA, CA"] }],
    });
    expect(result).toContain("Contact:");
    expect(result).toContain("    123 Main St");
    expect(result).toContain("    LA, CA");
  });

  it("separates title block from body with exactly one blank line", () => {
    // titleBlock ends with "\n\n"; body is trimmed so starts with "Action line."
    // Final output: "Title: MY FILM\n\nAction line." (one blank line between)
    const result = tiptapToFountain(EMPTY_DOC, {
      fields: [{ key: "Title", values: ["MY FILM"] }],
    });
    expect(result).toContain("Title: MY FILM\n\nAction line.");
    // Must not have more than one blank line (i.e. not \n\n\n)
    expect(result).not.toContain("MY FILM\n\n\n");
  });

  it("preserves key casing (Author vs Authors)", () => {
    const result = tiptapToFountain(EMPTY_DOC, {
      fields: [{ key: "Authors", values: ["Jane Smith"] }],
    });
    expect(result).toContain("Authors: Jane Smith");
    expect(result).not.toContain("Author: Jane Smith");
  });

  it("round-trips title page: parse → serialize → parse produces identical fields", () => {
    const source = [
      "Title:",
      "    _**MY SCREENPLAY**_",
      "Credit: Written by",
      "Author: Jane Smith",
      "Draft date: 3/21/2026",
      "Contact:",
      "    123 Main St",
      "    LA, CA",
      "",
      "INT. OFFICE - DAY",
      "",
      "Action.",
    ].join("\n");
    const { doc, titlePage } = fountainToTiptap(source);
    const serialized = tiptapToFountain(doc, titlePage);
    const { titlePage: roundTripped } = fountainToTiptap(serialized);
    expect(roundTripped.fields.map((f) => f.key)).toEqual(titlePage.fields.map((f) => f.key));
    expect(roundTripped.fields.map((f) => f.values)).toEqual(
      titlePage.fields.map((f) => f.values),
    );
  });

  it("round-trip normalizes 3-space indent to 4-space on output", () => {
    // Input uses 3-space indentation (valid Fountain)
    const source = "Contact:\n   123 Main St\n   LA, CA\n\nAction.\n";
    const { doc, titlePage } = fountainToTiptap(source);
    // Values must be preserved
    expect(titlePage.fields[0].values).toEqual(["123 Main St", "LA, CA"]);
    const serialized = tiptapToFountain(doc, titlePage);
    // Output must use 4-space indentation
    expect(serialized).toContain("    123 Main St");
    expect(serialized).toContain("    LA, CA");
    // 3-space form must NOT appear
    expect(serialized).not.toMatch(/^ {3}[^ ]/m);
  });
});
```

- [ ] **Step 2: Run tests — expect failures**

```bash
npx vitest run src/lib/fountain.test.ts
```

Expected: new serialization tests FAIL (`tiptapToFountain` doesn't accept second argument yet).

- [ ] **Step 3: Update `tiptapToFountain`**

Update the signature and prepend logic in `src/lib/fountain.ts`. Replace the existing `tiptapToFountain` function:

```ts
export function tiptapToFountain(doc: TDoc, titlePage?: TitlePageData): string {
  // Build title block
  let titleBlock = "";
  if (titlePage && titlePage.fields.length > 0) {
    const lines: string[] = [];
    for (const field of titlePage.fields) {
      const nonEmpty = field.values.filter((v) => v.trim() !== "");
      if (nonEmpty.length === 0) continue;
      if (nonEmpty.length === 1) {
        lines.push(`${field.key}: ${nonEmpty[0]}`);
      } else {
        lines.push(`${field.key}:`);
        for (const v of nonEmpty) {
          lines.push(`    ${v}`);
        }
      }
    }
    if (lines.length > 0) {
      titleBlock = lines.join("\n") + "\n\n";
    }
  }

  // Build script body (existing logic unchanged, .trim() applied to body only)
  const bodyLines: string[] = [];
  for (const node of doc.content) {
    const text = nodeText(node);
    switch (node.type) {
      case "sceneHeading":
        bodyLines.push("", text.toUpperCase(), "");
        break;
      case "action":
        bodyLines.push(text, "");
        break;
      case "character":
        bodyLines.push("", text.toUpperCase());
        break;
      case "dialogue":
        bodyLines.push(text, "");
        break;
      case "parenthetical":
        bodyLines.push(`(${text.replace(/^\(|\)$/g, "")})`);
        break;
      case "transition":
        bodyLines.push("", `> ${text}`, "");
        break;
      case "section": {
        const level = node.attrs?.level ?? 1;
        bodyLines.push("#".repeat(level) + " " + text);
        break;
      }
      case "screenplayNote":
        bodyLines.push(`[[ ${text} ]]`);
        break;
    }
  }
  const body = bodyLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();

  return titleBlock + body;
}
```

- [ ] **Step 4: Run tests — expect passing**

```bash
npx vitest run src/lib/fountain.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/fountain.ts src/lib/fountain.test.ts
git commit -m "feat: tiptapToFountain prepends Fountain title page block"
```

---

## Task 5: Update fileManager.ts

**Files:**
- Modify: `src/lib/fileManager.ts`

- [ ] **Step 1: Update `openFile`**

Replace the existing `openFile` function:

```ts
export async function openFile(editor: any): Promise<boolean> {
  const selected = await open({
    filters: [{ name: "Fountain", extensions: ["fountain"] }],
    multiple: false,
  });
  if (!selected || Array.isArray(selected)) return false;
  try {
    const content = await invoke<string>("read_file", { path: selected });
    // Parse first, mutate store only on success
    const { doc, titlePage } = fountainToTiptap(content);
    const name = selected
      .split(/[\\/]/)
      .pop()!
      .replace(/\.fountain$/i, "");
    editor.commands.setContent(doc);
    const store = useAppStore.getState();
    store.clearTitlePage();
    store.setTitlePageFields(titlePage.fields);
    store.setFilePath(selected);
    store.setScriptName(name);
    store.setDirty(false);
    return true;
  } catch (err) {
    alert(`Failed to open file: ${err}`);
    return false;
  }
}
```

- [ ] **Step 2: Update `saveFile`**

Change line 43 from:
```ts
const content = tiptapToFountain(editor.getJSON());
```
to:
```ts
const content = tiptapToFountain(editor.getJSON(), useAppStore.getState().titlePage);
```

- [ ] **Step 3: Add `newFile`**

Add after `renameScript`:

```ts
export function newFile(editor: any): void {
  editor.commands.setContent({
    type: "doc",
    content: [{ type: "action", content: [] }],
  });
  const store = useAppStore.getState();
  store.clearTitlePage();
  store.setFilePath(null);
  store.setScriptName("Untitled");
  store.setDirty(false);
}
```

- [ ] **Step 4: Export `newFile` from AppSidebar**

In `src/components/AppSidebar.tsx`, add a "New" button that calls `newFile(editor)`. Import `newFile` from `fileManager`:

```ts
import { openFile, saveFile, renameScript, newFile } from "../lib/fileManager";
```

Add a button to the button row (e.g., a `FilePlus` icon from lucide):

```tsx
import { FolderOpen, Save, SaveAll, FileDown, GitBranch, Sun, Moon, FilePlus } from "lucide-react";

// In the button row:
<Button variant="ghost" size="icon" title="New" onClick={() => newFile(editor)}>
  <FilePlus className="h-4 w-4" />
</Button>
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/fileManager.ts src/components/AppSidebar.tsx
git commit -m "feat: wire title page into openFile/saveFile; add newFile"
```

---

## Task 6: Build TitlePage component

**Files:**
- Create: `src/components/TitlePage.tsx`

- [ ] **Step 1: Create the component**

Create `src/components/TitlePage.tsx`:

```tsx
// src/components/TitlePage.tsx
import { useRef, useEffect, useCallback } from "react";
import type { Editor } from "@tiptap/core";
import { useAppStore } from "../store/useAppStore";

// Standard fields always rendered in fixed positions
const STANDARD_CENTERED = [
  { key: "Title", placeholder: "Title..." },
  { key: "Credit", placeholder: "Written by..." },
  { key: "Author", placeholder: "Author..." },
  { key: "Source", placeholder: "Source..." },
];

const STANDARD_LOWER_LEFT = [
  { key: "Draft date", placeholder: "Draft date..." },
  { key: "Contact", placeholder: "Contact..." },
];

const STANDARD_KEYS = new Set(
  [...STANDARD_CENTERED, ...STANDARD_LOWER_LEFT].map((s) => s.key.toLowerCase()),
);

interface FieldProps {
  label: string;
  placeholder: string;
  values: string[];
  centered: boolean;
  isCustom?: boolean;
  tabIndex: number;
  textareaRef: (el: HTMLTextAreaElement | null) => void;
  onCommit: (values: string[]) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onRemoveKey?: () => void;
}

function TitleField({
  label,
  placeholder,
  values,
  centered,
  isCustom,
  tabIndex,
  textareaRef,
  onCommit,
  onKeyDown,
  onRemoveKey,
}: FieldProps) {
  const setDirty = useAppStore((s) => s.setDirty);
  const innerRef = useRef<HTMLTextAreaElement | null>(null);

  function setRef(el: HTMLTextAreaElement | null) {
    innerRef.current = el;
    textareaRef(el);
  }

  // Auto-resize textarea to content
  function autoResize() {
    const el = innerRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }

  useEffect(() => {
    if (innerRef.current) {
      innerRef.current.value = values.join("\n");
      autoResize();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Uncontrolled: only initialize on mount

  return (
    <div style={{ marginBottom: "0.25rem" }}>
      {!centered && (
        <div style={{ opacity: 0.5, fontSize: "0.75rem" }}>
          {isCustom ? (
            <span
              contentEditable
              suppressContentEditableWarning
              style={{ outline: "none" }}
              onBlur={(e) => {
                const k = e.currentTarget.textContent?.trim() ?? "";
                if (!k) onRemoveKey?.();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
              }}
            >
              {label}
            </span>
          ) : (
            <span>{label}</span>
          )}
          <span>:</span>
        </div>
      )}
      <textarea
        ref={setRef}
        rows={1}
        defaultValue={values.join("\n")}
        placeholder={placeholder}
        tabIndex={tabIndex}
        onInput={autoResize}
        onChange={() => setDirty(true)}
        onBlur={(e) => {
          const text = e.currentTarget.value;
          onCommit(text === "" ? [""] : text.split("\n"));
        }}
        onKeyDown={onKeyDown}
        style={{
          display: "block",
          width: centered ? "100%" : "auto",
          textAlign: centered ? "center" : "left",
          resize: "none",
          overflow: "hidden",
          background: "transparent",
          border: "none",
          outline: "none",
          fontFamily: "inherit",
          fontSize: "inherit",
          color: "inherit",
          minHeight: "1.5em",
          padding: 0,
        }}
      />
    </div>
  );
}

export function TitlePage({ editor }: { editor: Editor | null }) {
  const fields = useAppStore((s) => s.titlePage.fields);
  const setTitlePageField = useAppStore((s) => s.setTitlePageField);
  const setTitlePageFields = useAppStore((s) => s.setTitlePageFields);
  const addTitlePageField = useAppStore((s) => s.addTitlePageField);
  const removeTitlePageField = useAppStore((s) => s.removeTitlePageField);
  const setDirty = useAppStore((s) => s.setDirty);

  const fieldMap = new Map(fields.map((f) => [f.key.toLowerCase(), f]));
  const customFields = fields.filter((f) => !STANDARD_KEYS.has(f.key.toLowerCase()));

  // All fields in tab order: centered standard, lower-left standard, custom
  const allFields = [
    ...STANDARD_CENTERED.map((s) => ({ ...s, centered: true, custom: false })),
    ...STANDARD_LOWER_LEFT.map((s) => ({ ...s, centered: false, custom: false })),
    ...customFields.map((f) => ({ key: f.key, placeholder: `${f.key}...`, centered: false, custom: true })),
  ];

  // Refs for all textareas, indexed by their position in allFields
  const textareaRefs = useRef<(HTMLTextAreaElement | null)[]>([]);

  const makeTextareaRef = useCallback(
    (i: number) => (el: HTMLTextAreaElement | null) => {
      textareaRefs.current[i] = el;
    },
    [],
  );

  function handleKeyDown(i: number) {
    return (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key !== "Tab") return;
      e.preventDefault();
      if (!e.shiftKey) {
        if (i < allFields.length - 1) {
          textareaRefs.current[i + 1]?.focus();
        } else {
          editor?.commands.focus();
        }
      } else {
        if (i > 0) {
          textareaRefs.current[i - 1]?.focus();
        }
        // Shift+Tab on first field: do nothing
      }
    };
  }

  function getValues(key: string): string[] {
    return fieldMap.get(key.toLowerCase())?.values ?? [""];
  }

  function handleCommit(key: string) {
    return (values: string[]) => {
      setTitlePageField(key, values);
      setDirty(true);
    };
  }

  return (
    <div
      className="screenplay-page"
      style={{ position: "relative", minHeight: "11in" }}
    >
      {/* Centered upper block */}
      <div
        style={{
          paddingTop: "3.5in",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {STANDARD_CENTERED.map((s, i) => (
          <TitleField
            key={s.key}
            label={s.key}
            placeholder={s.placeholder}
            values={getValues(s.key)}
            centered
            tabIndex={i + 1}
            textareaRef={makeTextareaRef(i)}
            onCommit={handleCommit(s.key)}
            onKeyDown={handleKeyDown(i)}
          />
        ))}
      </div>

      {/* Lower-left block */}
      <div style={{ position: "absolute", bottom: "1in", left: "0" }}>
        {STANDARD_LOWER_LEFT.map((s, i) => {
          const globalIdx = STANDARD_CENTERED.length + i;
          return (
            <TitleField
              key={s.key}
              label={s.key}
              placeholder={s.placeholder}
              values={getValues(s.key)}
              centered={false}
              tabIndex={globalIdx + 1}
              textareaRef={makeTextareaRef(globalIdx)}
              onCommit={handleCommit(s.key)}
              onKeyDown={handleKeyDown(globalIdx)}
            />
          );
        })}
        {customFields.map((f, i) => {
          const globalIdx = STANDARD_CENTERED.length + STANDARD_LOWER_LEFT.length + i;
          return (
            <TitleField
              key={f.key}
              label={f.key}
              placeholder={`${f.key}...`}
              values={f.values}
              centered={false}
              isCustom
              tabIndex={globalIdx + 1}
              textareaRef={makeTextareaRef(globalIdx)}
              onCommit={(values) => {
                const updated = fields.map((field) =>
                  field.key === f.key ? { ...field, values } : field,
                );
                setTitlePageFields(updated);
                setDirty(true);
              }}
              onKeyDown={handleKeyDown(globalIdx)}
              onRemoveKey={() => {
                removeTitlePageField(f.key);
                setDirty(true);
              }}
            />
          );
        })}
        <button
          onClick={() => {
            addTitlePageField({ key: "Custom", values: [""] });
            setDirty(true);
          }}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            opacity: 0.4,
            fontSize: "0.75rem",
            padding: 0,
            color: "inherit",
            display: "block",
            marginTop: "0.5rem",
          }}
        >
          + Add field
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/TitlePage.tsx
git commit -m "feat: add TitlePage component with inline contenteditable fields"
```

---

## Task 7: Wire TitlePage into AppShell

**Files:**
- Modify: `src/components/AppShell.tsx`

- [ ] **Step 1: Import and render TitlePage**

In `src/components/AppShell.tsx`, add the import:

```ts
import { TitlePage } from "./TitlePage";
```

In the JSX, add `<TitlePage />` directly above `<ScreenplayEditor>` inside the scrollable `div`:

```tsx
<div className="flex-1 overflow-y-auto bg-background py-2">
  <TitlePage editor={editor} />
  <ScreenplayEditor onEditorReady={setEditor} />
</div>
```

- [ ] **Step 2: Run all tests**

```bash
npx vitest run
```

Expected: all tests PASS.

- [ ] **Step 3: Manual smoke test**

```bash
npm run tauri dev
```

Verify:
- Title page renders above the script with a page-break separator
- Clicking a field focuses it; typing changes value
- Tab moves between fields; Tab from last field focuses the editor
- Shift+Tab on first field does nothing
- Open a `.fountain` file with a title block — fields populate correctly
- Save the file — title block is written to disk with correct Fountain syntax
- New file (sidebar button) — title page clears
- Open a file with no title block — title page shows empty placeholder fields

- [ ] **Step 4: Final commit**

```bash
git add src/components/AppShell.tsx
git commit -m "feat: render TitlePage above ScreenplayEditor in AppShell"
```

---

## Done

All tasks complete. The title page is fully functional with Fountain round-trip support.
