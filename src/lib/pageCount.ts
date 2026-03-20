import { type TNode, type TDoc, nodeText } from './nodeUtils'

const LINES_PER_PAGE = 55

function blockLines(node: TNode): number {
  const text = nodeText(node)
  const charPerLine = 60
  return Math.max(1, Math.ceil(text.length / charPerLine)) + 1
}

export function estimatePageCount(doc: TDoc): number {
  const totalLines = doc.content.reduce((sum, n) => sum + blockLines(n), 0)
  return Math.max(1, Math.ceil(totalLines / LINES_PER_PAGE))
}

export function estimateWordCount(doc: TDoc): number {
  const text = doc.content.map(nodeText).join(' ')
  return text.trim().split(/\s+/).filter(Boolean).length
}
