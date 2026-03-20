import type { RevisionColor, RevisionOp } from "../types/screenplay";
import { REVISION_COLOR_SEQUENCE } from "../types/screenplay";

const VALID_OPS: RevisionOp[] = ["insert", "delete"];

export function encodeRevisionMark(color: RevisionColor, op: RevisionOp, text: string): string {
  return `[[REV:color=${color};op=${op}]]${text}[[/REV]]`;
}

export function decodeRevisionMark(
  mark: string,
): { color: RevisionColor; op: RevisionOp; text: string } | null {
  const match = mark.match(/\[\[REV:color=(\w+);op=(\w+)\]\](.*?)\[\[\/REV\]\]/);
  if (!match) return null;
  const color = match[1] as RevisionColor;
  const op = match[2] as RevisionOp;
  if (!REVISION_COLOR_SEQUENCE.includes(color)) return null;
  if (!VALID_OPS.includes(op)) return null;
  return { color, op, text: match[3] };
}
