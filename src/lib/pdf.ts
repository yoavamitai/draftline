// src/lib/pdf.ts
import { useAppStore } from "../store/useAppStore";
import { type TDoc, nodeText } from "./nodeUtils";

function buildScreenplayHtml(fileTitle: string, doc: TDoc, hasRevisions: boolean): string {
  const titlePageHtml = `
<div class="title-page">
  <div class="title-block">
    <div class="script-title">${fileTitle}</div>
  </div>
</div>`;

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
  .title-page { text-align:center; padding-top:3.5in; page-break-after:always; }
  .script-title { font-size:14pt; font-weight:bold; text-transform:uppercase; }
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
</body></html>`;
}

export function exportToPdf(editor: any) {
  const { filePath, revisionMode } = useAppStore.getState();
  const fileTitle = filePath
    ? filePath.split(/[\\/]/).pop()!.replace(".fountain", "")
    : "Screenplay";
  const html = buildScreenplayHtml(fileTitle, editor.getJSON(), revisionMode);

  // Inject a hidden iframe into the current window and print from it.
  // This avoids file:// URL restrictions in WebView2.
  const frame = document.createElement("iframe");
  frame.style.cssText =
    "position:fixed;left:-9999px;top:0;width:850px;height:1100px;visibility:hidden";
  document.body.appendChild(frame);

  frame.addEventListener("load", async () => {
    // Wait for fonts (Courier Prime via Google Fonts) before printing
    await frame.contentDocument?.fonts?.ready;
    frame.contentWindow?.print();
    setTimeout(() => {
      if (frame.parentNode) document.body.removeChild(frame);
    }, 1000);
  });

  const frameDoc = frame.contentDocument!;
  frameDoc.open();
  frameDoc.write(html);
  frameDoc.close();
}
