export type TNode = { type: string; content?: TNode[]; text?: string; attrs?: Record<string, any> };
export type TDoc = { type: "doc"; content: TNode[] };

export function nodeText(node: TNode): string {
  if (node.text) return node.text;
  return (node.content ?? []).map(nodeText).join("");
}
