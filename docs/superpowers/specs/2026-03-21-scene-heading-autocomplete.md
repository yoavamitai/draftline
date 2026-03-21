# Scene Heading Autocomplete — Design Spec

**Date:** 2026-03-21
**Status:** Approved

## Overview

Extend the existing autocomplete system to give scene headings two context-aware suggestion modes: prefix suggestions (`INT.`, `EXT.`, etc.) and time-of-day suggestions (`DAY`, `NIGHT`, etc.). Character block autocomplete is unchanged.

## Context Detection

Scene headings follow the format `INT. LOCATION NAME - TIME OF DAY`. The plugin detects which mode applies by inspecting the current block text:

| Condition | Mode | Query |
|-----------|------|-------|
| No ` - ` in block text | Prefix mode | Full block text |
| Block contains ` - ` | Time mode | Text after last ` - ` |

## Static Data

```ts
SCENE_HEADING_PREFIXES = ['INT.', 'EXT.', 'INT./EXT.', 'EXT./INT.']

TIME_OF_DAY = ['DAY', 'NIGHT', 'DAWN', 'DUSK', 'CONTINUOUS', 'SAME', 'LATER', 'MOMENTS LATER']
```

## Pure Functions (`src/lib/autocomplete.ts`)

### `getSceneHeadingPrefixSuggestions(query, docEntries, excludePos, limit = 8)`

- Filters `SCENE_HEADING_PREFIXES` by case-insensitive prefix match against `query` → `staticMatches`
  - Because the filter checks whether a static candidate *starts with* the query, static suggestions only appear while the user is still typing the prefix itself (e.g. `I`, `IN`, `INT`, `INT.`). Once the user types a space after `INT.` and begins the location name, no static prefix will match — this is intentional.
- Calls `filterSuggestions(docEntries, query, excludePos, limit)` for doc-derived entries → `docMatches`
- Merges: `staticMatches` first, then any `docMatches` not already in `staticMatches`
  - Dedup uses case-insensitive exact string equality. In practice, collisions only occur when a doc entry consists solely of a bare prefix (e.g. `INT.` with no location). The static form is kept in that case.
- Slices merged array to `limit` before returning

### `getTimeOfDaySuggestions(query)`

- Filters `TIME_OF_DAY` by case-insensitive prefix match against `query`
- If `query` is empty (user typed ` - ` and nothing after), returns the full `TIME_OF_DAY` list
- Returns empty array only when `query` is non-empty and nothing matches

## Plugin Changes (`src/editor/extensions/autoComplete.ts`)

When `blockType === 'sceneHeading'`, **replace the existing `filterSuggestions` call and its surrounding guards with a branched block** that selects the mode and calls the appropriate function. The two existing plugin guards still apply:

- `!currentText.trim()` — operates on the full block text, not the sub-query. A block containing ` - ` is never blank, so this guard never fires in time mode. An empty query in time mode is valid and handled by `getTimeOfDaySuggestions`.
- `items.length === 0` — fires as usual whenever the active function returns no results.

**Prefix mode** (no ` - ` in block):
- Calls `getSceneHeadingPrefixSuggestions(currentText, entries, excludePos)`
- `limit` passed to `filterSuggestions` internally is the same `limit` (default 8); the outer slice to `limit` is the authoritative cap — the inner call may return up to `limit` before dedup, but the merged result is always sliced to `limit`.
- `select(text)` replaces the entire block text (existing behavior)

**Time mode** (block contains ` - `):
- Extracts query as text after last ` - ` (may be empty — see `getTimeOfDaySuggestions` above)
- Calls `getTimeOfDaySuggestions(query)`
- `select(text)` replaces only the suffix — keeps text up to and including ` - `, appends the chosen time value
- **The `select` closure must re-read `state` at call time** (not close over `currentText`). Inside the `command()` callback, read `$from.parent.textContent` fresh, then recompute the ` - ` split index from that freshly-read content before constructing the replacement string. Do not use any offset captured from `currentText` at `onOpen` time. This avoids stale closure bugs (see commit `88fb33e`).
- **Fallback**: if the freshly-read block text no longer contains ` - ` (user edited the block between `onOpen` and `select`), or if `$from.parent` is no longer a `sceneHeading` node, the command is a no-op — do not insert anything.

`character` blocks continue to use `filterSuggestions` unchanged.

## Tests (`src/lib/autocomplete.test.ts`)

Unit tests for the two new pure functions:

- `getSceneHeadingPrefixSuggestions`: static prefixes appear before doc entries; both filtered by prefix; duplicates removed (static form wins — including when a doc entry matches a static prefix case-insensitively, e.g. doc entry `int.` is dropped in favour of static `INT.`)
- `getSceneHeadingPrefixSuggestions`: returns only static matches when no doc entries match
- `getSceneHeadingPrefixSuggestions`: total result is capped at `limit`
- `getTimeOfDaySuggestions`: filters `TIME_OF_DAY` by prefix match (case-insensitive)
- `getTimeOfDaySuggestions`: returns the full `TIME_OF_DAY` list when query is empty
- `getTimeOfDaySuggestions`: returns empty array when query is non-empty and nothing matches

Plugin select behavior in time mode is verified manually via `npm run tauri dev`.

## Files Modified

| Action | Path |
|--------|------|
| Modify | `src/lib/autocomplete.ts` |
| Modify | `src/lib/autocomplete.test.ts` |
| Modify | `src/editor/extensions/autoComplete.ts` |
