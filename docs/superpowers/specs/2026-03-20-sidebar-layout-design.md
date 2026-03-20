# Sidebar Layout Redesign

**Date:** 2026-03-20

## Goal

Replace the top toolbar and bottom status bar with a single collapsible sidebar, using the shadcn/ui `Sidebar` component. The screenplay editor fills the remaining space. Stats (pages, words, scene) remain pinned at the bottom of the main area and are always visible regardless of sidebar state.

## Layout

```
┌──────────────────────────────────────────────┐
│ [Sidebar]          │ [≡] (SidebarTrigger)    │
│                    │  screenplay editor       │
│  Header            │                          │
│    script name •   │                          │
│    📂 💾 📋 ⬇ 🌿 🌙 │                          │
│                    │                          │
│  Content           │                          │
│    scene list      │                          │
│    ...             │                          │
│                    │                          │
│                    ├──────────────────────────│
│                    │ ~12 pages · 2,340 words  │
│                    │ Scene 1 of 4             │
└──────────────────────────────────────────────┘
```

When the sidebar collapses (`offcanvas` variant), it slides fully off-screen. `SidebarTrigger` is **always visible** at the top-left of the main area (shadcn default behaviour) — not conditionally rendered. The stats strip at the bottom is always visible.

## Components

### `AppShell.tsx` (rewritten)

Wraps everything in `SidebarProvider` (default open). Renders:
- `<AppSidebar editor={editor} />` — the sidebar
- Main content div: `SidebarTrigger` + `ScreenplayEditor` + `StatusBar`

`editor` is still instantiated via `useState<Editor | null>(null)` in `AppShell` and threaded down as a prop, matching the existing pattern.

### `AppSidebar.tsx` (new, replaces `Toolbar.tsx`)

Props: `{ editor: Editor | null }`

Uses shadcn `Sidebar`, `SidebarHeader`, `SidebarContent` (no `SidebarFooter` needed).

**`SidebarHeader`:**
- Script name, inline-editable (same logic as current `Toolbar` input/span toggle, dirty indicator `•`)
- Row of icon buttons:
  - Open (`FolderOpen`) → `openFile(editor)`
  - Save (`Save`) → `saveFile(editor)`
  - Save As (`SaveAll`) → `saveFile(editor, true)`
  - Export PDF (`FileDown`) → `exportToPdf(editor)`
  - Revisions (`GitBranch`, `variant="secondary"` when active) — two-click interaction:
    - First click (revision mode off): calls `toggleRevisionMode()`
    - Second click (revision mode on): calls `window.prompt(...)` for draft name, then `nextRevisionDraft(name)` — identical to current Toolbar logic
  - Theme toggle (`Sun`/`Moon`) → `toggleTheme()`

**`SidebarContent`:**
- `<SceneNavigator editor={editor} />` — component is unchanged

### `StatusBar.tsx` (unchanged)

No logic changes. Moves from `AppShell`'s flex column into the main content area, always rendered below the editor.

### `SceneNavigator.tsx` (unchanged)

No changes needed — it already works with a scroll area internally.

### `Toolbar.tsx` (deleted)

### `src/components/ui/sidebar.tsx` (new, installed via shadcn)

Install: `npx shadcn@latest add sidebar`

## Store changes (`useAppStore.ts` + `src/types/screenplay.ts`)

`SidebarProvider` manages open/close state internally (in its own localStorage key, separate from the app store). Remove:

- `sidebarOpen: boolean` from `AppState` interface in `src/types/screenplay.ts`
- `sidebarOpen` and `toggleSidebar` from `useAppStore.ts` (state, action, and `partialize`)

**Persistence note:** The old `sidebarOpen` key will be silently ignored by Zustand on next load (no migration needed). The `SidebarProvider` defaults to open, which is the correct initial state.

## Test changes (`src/store/useAppStore.test.ts`)

Delete the `"toggles sidebar"` test — `sidebarOpen` and `toggleSidebar` no longer exist in the store.

## Files changed summary

| File | Change |
|------|--------|
| `src/components/AppShell.tsx` | Rewritten to use `SidebarProvider` |
| `src/components/AppSidebar.tsx` | New — sidebar header + scene navigator |
| `src/components/Toolbar.tsx` | Deleted |
| `src/components/ui/sidebar.tsx` | New — installed via shadcn |
| `src/types/screenplay.ts` | Remove `sidebarOpen` from `AppState` |
| `src/store/useAppStore.ts` | Remove `sidebarOpen` + `toggleSidebar` |
| `src/store/useAppStore.test.ts` | Delete `"toggles sidebar"` test |

## Out of scope

- Sidebar width customization
- Keyboard shortcut for sidebar toggle (beyond shadcn's built-in)
- Any change to editor or status bar logic
