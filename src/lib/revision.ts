import type { RevisionColor, RevisionOp } from '../types/screenplay'

export function encodeRevisionMark(color: RevisionColor, op: RevisionOp, text: string): string {
  return `[[REV:color=${color};op=${op}]]${text}[[/REV]]`
}

export function decodeRevisionMark(mark: string): { color: RevisionColor; op: RevisionOp; text: string } | null {
  const match = mark.match(/\[\[REV:color=(\w+);op=(\w+)\]\](.*?)\[\[\/REV\]\]/)
  if (!match) return null
  return { color: match[1] as RevisionColor, op: match[2] as RevisionOp, text: match[3] }
}
