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
- Calls `filterSuggestions(docEntries, query, excludePos, limit)` for doc-derived entries → `docMatches`
- Merges: `staticMatches` first, then any `docMatches` not already in `staticMatches` (dedup by case-insensitive exact string equality; when a collision occurs the static form is kept)
- Slices merged array to `limit` before returning

### `getTimeOfDaySuggestions(query)`

- Filters `TIME_OF_DAY` by case-insensitive prefix match against `query`
- If `query` is empty (user typed ` - ` and nothing after), returns the full `TIME_OF_DAY` list
- Returns empty array only when `query` is non-empty and nothing matches

## Plugin Changes (`src/editor/extensions/autoComplete.ts`)

When `blockType === 'sceneHeading'`:

**Prefix mode** (no ` - ` in block):
- Calls `getSceneHeadingPrefixSuggestions(currentText, entries, excludePos)`
- `select(text)` replaces the entire block text (existing behavior)

**Time mode** (block contains ` - `):
- Extracts query as text after last ` - ` (may be empty — see `getTimeOfDaySuggestions` above)
- The existing early-exit guard (`!currentText.trim()`) fires before mode detection; it is harmless in time mode because a block containing ` - ` is never empty
- Calls `getTimeOfDaySuggestions(query)`
- `select(text)` replaces only the suffix — keeps text up to and including ` - `, appends the chosen time value
- **The `select` closure must re-read `state` at call time** (not close over `currentText`). Inside the `command()` callback, read `$from.parent.textContent` fresh, then recompute the ` - ` split index from that freshly-read content before constructing the replacement string. Do not use any offset captured from `currentText` at `onOpen` time. This avoids stale closure bugs (see commit `88fb33e`).

`character` blocks continue to use `filterSuggestions` unchanged.

## Tests (`src/lib/autocomplete.test.ts`)

Unit tests for the two new pure functions:

- `getSceneHeadingPrefixSuggestions`: static prefixes appear before doc entries; both filtered by prefix; duplicates removed (static form wins)
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
