# Screenwriting App — Design Spec

**Date:** 2026-03-20
**Status:** Approved

---

## Overview

A focused desktop screenwriting application built with Tauri. The core purpose is a WYSIWYG screenplay editor that feels professional, saves to the open Fountain format, and exports industry-standard PDFs. No cloud, no subscription — a fast, offline-first native desktop tool.

---

## Platform & Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Tauri (Rust) |
| Frontend | React + TypeScript |
| UI components | shadcn/ui (Tailwind CSS + Radix UI) |
| Editor core | TipTap (ProseMirror-based) |
| Fountain I/O | fountain-js |
| App state | Zustand |
| PDF export | HTML screenplay template → PDF via Tauri WebView `print()` API (Windows-primary; cross-platform scope is v2) |

---

## Editor: WYSIWYG Block Model

The editor represents a screenplay as a sequence of typed blocks. Each block maps to a Fountain element. The document is stored in memory as TipTap JSON and serialized to `.fountain` on save.

### Screenplay Block Types

| Block | Fountain | Visual style |
|-------|----------|-------------|
| Scene Heading | `INT./EXT. LOCATION - TIME` | Full-width, bold, uppercase |
| Action | Plain paragraph | Full-width, normal weight |
| Character | `CHARACTER NAME` | Centered, uppercase, ~40% width margin |
| Dialogue | Dialogue text | Centered block, ~35% page width (~3.5" from left margin, matching industry standard) |
| Parenthetical | `(beat)` | Centered, narrower than dialogue |
| Transition | `CUT TO:` | Right-aligned, uppercase |
| Section | `# Act One` | Styled heading, hidden in PDF |
| Note | `[[ note ]]` | Highlighted inline, hidden in PDF |

### Smart Tab Flow

Keyboard navigation mirrors Final Draft conventions:

- **Scene Heading → Tab** → Action
- **Action → Tab** → Character; **Enter** → new Action
- **Character → Enter** → Dialogue; **Tab** → Parenthetical
- **Dialogue → Enter** → Action; **Tab** → new Character
- **Parenthetical → Enter** → Dialogue

Auto-detection rules:
- Lines starting with `INT.`, `EXT.`, `INT./EXT.`, or `I/E.` auto-promote to Scene Heading.
- A line auto-promotes to Character if **all** of the following are true: the entire line is uppercase, the line is ≤ 40 characters, it contains no sentence-ending punctuation (`.`, `?`, `!`), and it is not a Transition (does not end in `:`). Users can always manually override the block type via a right-click context menu or element picker.

---

## Application Layout

**Collapsible sidebar layout:**

```
┌─────────────────────────────────────────────────────┐
│  Toolbar: [File name]   [Toggle Scenes]  [Save] [Export PDF] [☀/☾] [Revision] │
├──────────────┬──────────────────────────────────────┤
│  Scene Nav   │                                      │
│  (collaps-   │         WYSIWYG Editor               │
│  ible)       │    (centered screenplay page)        │
│              │                                      │
│  ▸ Scene 1   │                                      │
│  ▸ Scene 2   │                                      │
│  ▸ Scene 3   │                                      │
├──────────────┴──────────────────────────────────────┤
│  Status bar: Pages: 12  │  Words: 4,203  │  Scene 3 of 18  │
└─────────────────────────────────────────────────────┘
```

- Sidebar toggles open/closed via toolbar button or keyboard shortcut
- Editor area always shows a centered "page" column (like a real screenplay page)
- Status bar always visible at bottom

---

## Features

### File Management
- Open `.fountain` files via native Tauri file dialog
- Save / Save As via native dialog
- Auto-save to disk every 30 seconds when a file is open
- New script creates an untitled document

### Scene Navigator
- Lists all Scene Headings in order
- Click to jump to scene
- Collapsible — persists open/closed state between sessions

### Word & Page Count
- Live count in status bar
- Page count estimated at ~55 lines per page — this is an approximation; actual PDF page count may differ slightly due to rendering. The status bar displays it as an estimate (e.g., "~12 pages").
- Scene count shown (current scene / total)

### Revision Mode
- Toggle on/off from toolbar
- When enabled: new/changed text highlighted in the current revision color
- Deleted text shown as strikethrough
- Revision colors follow WGA standard draft sequence: White → Blue → Pink → Yellow → Green → Goldenrod
- User can name each revision draft
- Revision marks stored as a custom Fountain note extension. Format: `[[REV:color=blue;op=insert]]…text…[[/REV]]` for insertions, `[[REV:color=blue;op=delete]]…text…[[/REV]]` for deletions. The `color` field maps to the WGA draft color name; `op` is `insert` or `delete`. This is a non-standard extension — plain Fountain parsers will render these as notes and ignore the markup.
- In PDF export: changed pages include a revision color asterisk (`*`) in the right margin (WGA industry standard). On-screen: insertions are highlighted in the draft color; deletions are shown as strikethrough.

### Theme
- Dark and light modes
- Toggle in toolbar
- Persists between sessions via local storage / Tauri store

### PDF Export
- Exports to standard Hollywood screenplay format:
  - Courier Prime 12pt
  - Margins: 1.5" left, 1" top/right/bottom
  - Page numbers top-right, starting page 2
  - Title page auto-generated from Fountain title metadata
- Revision marks reflected in PDF when revision mode is active
- Native save dialog for output path

---

## Data Flow

```
User types in TipTap
  → TipTap JSON (in-memory document)
  → On save: serialize blocks → Fountain text → write file via Tauri fs API
  → On PDF export: Fountain → HTML template → PDF via Tauri
  → On open: read .fountain file → parse via fountain-js → hydrate TipTap blocks
```

---

## File Format

`.fountain` is stored as plain UTF-8 text per the Fountain spec. Revision annotations use a custom note extension (see Revision Mode above). Plain Fountain parsers will treat revision notes as editorial notes and ignore the structured metadata; the app reads the metadata tags to restore revision state on open.

---

## Out of Scope (v1)

- Cloud sync or collaboration
- Final Draft (.fdx) import/export
- AI writing assistance
- Character / story breakdown database
- Mobile or web version
- Multiple simultaneous open scripts

---

## Verification

1. `npm run tauri dev` launches the app window
2. Create a new script, type a scene heading — confirm it auto-formats
3. Tab through Character → Dialogue flow
4. Save as `.fountain`, open file in a text editor and verify Fountain syntax
5. Open the saved file back — confirm round-trip fidelity
6. Export to PDF — verify Courier Prime font, margins, page numbers
7. Toggle dark/light mode — confirm persists after restart
8. Toggle scene navigator — confirm collapse/expand and scene jump
9. Enable revision mode, make edits — confirm highlights and strikethroughs
10. Enable revision mode, export to PDF — verify that changed pages show a `*` asterisk in the right margin
