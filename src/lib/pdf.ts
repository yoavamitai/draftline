// src/lib/pdf.ts
import { invoke } from "@tauri-apps/api/core";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { useAppStore } from "../store/useAppStore";
import { tempDir } from "@tauri-apps/api/path";

type TNode = { type: string; content?: TNode[]; text?: string; attrs?: Record<string, any> };

function nodeText(node: TNode): string {
  if (node.text) return node.text;
  return (node.content ?? []).map(nodeText).join("");
}

function buildScreenplayHtml(
  fileTitle: string,
  doc: { type: string; content: TNode[] },
  hasRevisions: boolean,
): string {
  const titlePageHtml = `
<div class="title-page">
  <div class="title-block">
    <div class="script-title">${fileTitle}</div>
  </div>
</div>
<div style="page-break-after:always"></div>`;

  const body = doc.content
    .map((node) => {
      const text = nodeText(node)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      const hasRev =
        hasRevisions &&
        (node.content ?? []).some((inline: any) =>
          (inline.marks ?? []).some((m: any) => m.type === "revision"),
        );
      const asterisk = hasRev ? '<span class="rev-asterisk">*</span>' : "";
      switch (node.type) {
        case "sceneHeading":
          return `<div class="scene-heading">${text}${asterisk}</div>`;
        case "action":
          return `<div class="action">${text}${asterisk}</div>`;
        case "character":
          return `<div class="character">${text}</div>`;
        case "dialogue":
          return `<div class="dialogue">${text}${asterisk}</div>`;
        case "parenthetical":
          return `<div class="parenthetical">${text}</div>`;
        case "transition":
          return `<div class="transition">${text}</div>`;
        case "section":
          return "";
        case "screenplayNote":
          return "";
        default:
          return `<div class="action">${text}</div>`;
      }
    })
    .join("\n");

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  @import url('https://fonts.googleapis.com/css2?family=Courier+Prime&display=swap');
  @page { size: letter; margin: 1in 1in 1in 1.5in; }
  body { font-family: 'Courier Prime', monospace; font-size: 12pt; line-height: 1.5; color: #000; }
  .title-page { display:flex; align-items:center; justify-content:center; min-height:9in; text-align:center; }
  .script-title { font-size:14pt; font-weight:bold; text-transform:uppercase; margin-bottom:2em; }
  .scene-heading  { font-weight: bold; text-transform: uppercase; margin: 1em 0 0.25em; position: relative; }
  .action         { margin: 0.25em 0; }
  .character      { margin: 1em 0 0; margin-left: 2.2in; text-transform: uppercase; }
  .dialogue       { margin: 0; margin-left: 1.5in; margin-right: 1.5in; position: relative; }
  .parenthetical  { margin: 0; margin-left: 1.8in; margin-right: 1.8in; }
  .transition     { text-align: right; text-transform: uppercase; margin: 0.5em 0; }
  .rev-asterisk   { position: absolute; right: -0.4in; }
  @media print { body { -webkit-print-color-adjust: exact; } }
</style>
<title>${fileTitle}</title>
</head><body>
${titlePageHtml}
${body}
<script>window.onload = () => { window.print(); window.close(); }</script>
</body></html>`;
}

export async function exportToPdf(editor: any) {
  const { filePath, revisionMode } = useAppStore.getState();
  const fileTitle = filePath
    ? filePath.split(/[\\/]/).pop()!.replace(".fountain", "")
    : "Screenplay";
  const html = buildScreenplayHtml(fileTitle, editor.getJSON(), revisionMode);

  const tmp = await tempDir();
  const tmpPath = `${tmp}screenplay-print.html`;
  await invoke("write_file", { path: tmpPath, content: html });

  const printWindow = new WebviewWindow("pdf-print", {
    url: `file://${tmpPath}`,
    title: "Print Screenplay",
    width: 850,
    height: 1100,
    visible: true,
  });
  printWindow.once("tauri://error", (e) => console.error("PDF window error:", e));
}
