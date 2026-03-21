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

### `getSceneHeadingPrefixSuggestions(query, docEntries, excludePos)`

- Filters `SCENE_HEADING_PREFIXES` by prefix match against `query`
- Calls existing `filterSuggestions` for doc-derived entries
- Returns static matches first, then doc matches — deduplicated

### `getTimeOfDaySuggestions(query)`

- Filters `TIME_OF_DAY` by case-insensitive prefix match against `query`
- Returns matched items; empty array if nothing matches

## Plugin Changes (`src/editor/extensions/autoComplete.ts`)

When `blockType === 'sceneHeading'`:

**Prefix mode** (no ` - ` in block):
- Calls `getSceneHeadingPrefixSuggestions(currentText, entries, excludePos)`
- `select(text)` replaces the entire block text (existing behavior)

**Time mode** (block contains ` - `):
- Extracts query as text after last ` - `
- Calls `getTimeOfDaySuggestions(query)`
- `select(text)` replaces only the suffix — keeps text up to and including ` - `, appends the chosen time value

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
