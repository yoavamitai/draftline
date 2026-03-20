# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

## Project

A Tauri desktop screenwriting application with a WYSIWYG screenplay editor.

- **Spec:** `docs/superpowers/specs/2026-03-20-screenwriting-app-design.md`
- **Implementation plan:** `docs/superpowers/plans/2026-03-20-screenwriting-app.md`

## Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Tauri 2 (Rust) |
| Frontend | React 18 + TypeScript |
| UI components | shadcn/ui (Tailwind CSS + Radix UI) |
| Editor core | TipTap 2 (ProseMirror) |
| Fountain I/O | fountain-js |
| App state | Zustand |
| Tests | Vitest + React Testing Library |

## Key Conventions

- All screenplay block types are custom TipTap Node extensions in `src/editor/extensions/nodes.ts`
- Fountain serialization lives in `src/lib/fountain.ts` — do not use fountain-js directly elsewhere
- Tauri IPC commands (`read_file`, `write_file`) are in `src-tauri/src/main.rs`
- File I/O (open/save dialogs, auto-save) is in `src/lib/fileManager.ts`
- Use `@tauri-apps/api/core` for `invoke`, `@tauri-apps/plugin-dialog` for file dialogs (Tauri v2)
- shadcn/ui components live in `src/components/ui/` — do not hand-roll UI primitives

## Commands

```bash
npm run tauri dev       # start dev server + Tauri window
npm run tauri build     # production build
npx vitest run          # run all tests
npx vitest              # watch mode
```

## TDD

Write failing tests first, then implement. Tests live next to source files (`*.test.ts`).
Pure logic (fountain, pageCount, revision) must have unit tests.
Tauri IPC commands are tested manually via `npm run tauri dev`.

## Out of Scope (v1)

- Cloud sync or collaboration
- Final Draft (.fdx) import/export
- AI writing assistance
- Multiple simultaneous open scripts
- Cross-platform PDF (Windows-primary for v1)
