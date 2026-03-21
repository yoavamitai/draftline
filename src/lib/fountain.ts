import { Fountain } from "fountain-js";
import { type TNode, type TDoc, nodeText } from "./nodeUtils";
import type { TitlePageData, TitlePageField } from "../types/screenplay";

export function tiptapToFountain(doc: TDoc, titlePage?: TitlePageData): string {
  // Build title block
  let titleBlock = "";
  if (titlePage && titlePage.fields.length > 0) {
    const lines: string[] = [];
    for (const field of titlePage.fields) {
      const nonEmpty = field.values.filter((v) => v.trim() !== "");
      if (nonEmpty.length === 0) continue;
      if (nonEmpty.length === 1) {
        lines.push(`${field.key}: ${nonEmpty[0]}`);
      } else {
        lines.push(`${field.key}:`);
        for (const v of nonEmpty) {
          lines.push(`    ${v}`);
        }
      }
    }
    if (lines.length > 0) {
      titleBlock = lines.join("\n") + "\n\n";
    }
  }

  // Build script body (existing logic unchanged, .trim() applied to body only)
  const bodyLines: string[] = [];
  for (const node of doc.content) {
    const text = nodeText(node);
    switch (node.type) {
      case "sceneHeading":
        bodyLines.push("", text.toUpperCase(), "");
        break;
      case "action":
        bodyLines.push(text, "");
        break;
      case "character":
        bodyLines.push("", text.toUpperCase());
        break;
      case "dialogue":
        bodyLines.push(text, "");
        break;
      case "parenthetical":
        bodyLines.push(`(${text.replace(/^\(|\)$/g, "")})`);
        break;
      case "transition":
        bodyLines.push("", `> ${text}`, "");
        break;
      case "section": {
        const level = node.attrs?.level ?? 1;
        bodyLines.push("#".repeat(level) + " " + text);
        break;
      }
      case "screenplayNote":
        bodyLines.push(`[[ ${text} ]]`);
        break;
    }
  }
  const body = bodyLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();

  return titleBlock + body;
}

const TITLE_KEY_RE = /^([A-Za-z][A-Za-z0-9 ]*):(.*)$/;
const CONTINUATION_RE = /^(\t| {3,})(.*)/;

function extractTitlePage(source: string): { fields: TitlePageField[]; bodySource: string } {
  const lines = source.split("\n");
  const fields: TitlePageField[] = [];
  let i = 0;

  // Skip truly blank leading lines
  while (i < lines.length && lines[i] === "") i++;

  // If first non-blank line is not a key line, no title block
  if (i >= lines.length || !TITLE_KEY_RE.test(lines[i])) {
    return { fields: [], bodySource: source };
  }

  let currentField: TitlePageField | null = null;

  while (i < lines.length) {
    const line = lines[i];

    // Truly blank line terminates the title block
    if (line === "" || line === "\r") {
      i++;
      break;
    }

    const keyMatch = TITLE_KEY_RE.exec(line);
    const contMatch = CONTINUATION_RE.exec(line);

    if (keyMatch) {
      currentField = { key: keyMatch[1], values: [] };
      const inline = keyMatch[2].trim();
      if (inline) currentField.values.push(inline);
      fields.push(currentField);
    } else if (contMatch && currentField) {
      currentField.values.push(contMatch[2]);
    } else {
      // Non-key, non-continuation, non-blank: end of block
      break;
    }
    i++;
  }

  const bodySource = lines.slice(i).join("\n");
  return { fields, bodySource };
}

export function fountainToTiptap(source: string): { doc: TDoc; titlePage: TitlePageData } {
  const { fields, bodySource } = extractTitlePage(source);

  const parsed = new Fountain().parse(bodySource, true);
  const content: TNode[] = [];

  for (const token of parsed.tokens ?? []) {
    const text = (token.text ?? "").replace(/<[^>]+>/g, "");
    switch (token.type) {
      case "scene_heading":
        content.push({ type: "sceneHeading", content: [{ type: "text", text }] });
        break;
      case "action":
        content.push({ type: "action", content: [{ type: "text", text }] });
        break;
      case "character":
        content.push({ type: "character", content: [{ type: "text", text }] });
        break;
      case "dialogue":
        content.push({ type: "dialogue", content: [{ type: "text", text }] });
        break;
      case "parenthetical":
        content.push({ type: "parenthetical", content: [{ type: "text", text }] });
        break;
      case "transition":
        content.push({ type: "transition", content: [{ type: "text", text }] });
        break;
      case "section":
        content.push({
          type: "section",
          attrs: { level: token.depth ?? 1 },
          content: [{ type: "text", text }],
        });
        break;
      case "note":
        content.push({ type: "screenplayNote", content: [{ type: "text", text }] });
        break;
    }
  }

  if (content.length === 0) {
    content.push({ type: "action", content: [{ type: "text", text: "" }] });
  }

  return { doc: { type: "doc", content }, titlePage: { fields } };
}
