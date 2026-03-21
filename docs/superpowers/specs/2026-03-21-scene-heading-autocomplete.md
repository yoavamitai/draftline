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

- Filters `SCENE_HEADING_PREFIXES` by case-insensitive prefix match against `query`
- Calls existing `filterSuggestions(docEntries, query, excludePos, limit)` for doc-derived entries
- Returns static matches first, then doc matches — deduplicated by case-insensitive exact string equality
- Total result is capped at `limit` (default 8), applied after merging both sources

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
- Calls `getTimeOfDaySuggestions(query)`
- `select(text)` replaces only the suffix — keeps text up to and including ` - `, appends the chosen time value
- **The `select` closure must re-read `state` at call time** (not close over `currentText`). Use the same pattern as the existing `select` in the plugin — read `$from.parent.textContent` inside the `command()` callback — to avoid stale closure bugs (see commit `88fb33e`).

`character` blocks continue to use `filterSuggestions` unchanged.

## Tests (`src/lib/autocomplete.test.ts`)

Unit tests for the two new pure functions:

- `getSceneHeadingPrefixSuggestions`: static prefixes appear before doc entries; both filtered by prefix; duplicates removed
- `getSceneHeadingPrefixSuggestions`: returns only static matches when no doc entries match
- `getTimeOfDaySuggestions`: filters `TIME_OF_DAY` by prefix match (case-insensitive)
- `getTimeOfDaySuggestions`: returns empty array when nothing matches

Plugin select behavior in time mode is verified manually via `npm run tauri dev`.

## Files Modified

| Action | Path |
|--------|------|
| Modify | `src/lib/autocomplete.ts` |
| Modify | `src/lib/autocomplete.test.ts` |
| Modify | `src/editor/extensions/autoComplete.ts` |
