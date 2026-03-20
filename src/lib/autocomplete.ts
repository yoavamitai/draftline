/** A single block entry collected from the document by the TipTap plugin. */
export interface DocEntry {
  text: string;
  /** ProseMirror start position of the block node (used to exclude the current block). */
  pos: number;
}

/**
 * Filter and rank document entries by prefix match against the user's current input.
 *
 * @param entries     All blocks of the relevant type collected by the plugin.
 * @param query       Text currently in the cursor's block (trimmed before matching).
 * @param excludePos  ProseMirror position of the cursor's block — always excluded.
 * @param limit       Max results to return. Default: 8.
 */
export function filterSuggestions(
  entries: DocEntry[],
  query: string,
  excludePos: number,
  limit = 8,
): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const frequency = new Map<string, number>();
  for (const { text, pos } of entries) {
    if (pos === excludePos) continue;
    const t = text.trim();
    if (!t) continue;
    frequency.set(t, (frequency.get(t) ?? 0) + 1);
  }

  return Array.from(frequency.entries())
    .filter(([text]) => text.toLowerCase().startsWith(q))
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([text]) => text);
}
