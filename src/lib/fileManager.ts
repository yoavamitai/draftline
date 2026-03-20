// src/lib/fileManager.ts
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { fountainToTiptap, tiptapToFountain } from "./fountain";
import { useAppStore } from "../store/useAppStore";

export async function openFile(editor: any): Promise<boolean> {
  const selected = await open({
    filters: [{ name: "Fountain", extensions: ["fountain"] }],
    multiple: false,
  });
  if (!selected || Array.isArray(selected)) return false;
  try {
    const content = await invoke<string>("read_file", { path: selected });
    const doc = fountainToTiptap(content);
    const name = selected.split(/[\\/]/).pop()!.replace(/\.fountain$/i, '')
    editor.commands.setContent(doc);
    useAppStore.getState().setFilePath(selected);
    useAppStore.getState().setScriptName(name);
    useAppStore.getState().setDirty(false);
    return true;
  } catch (err) {
    alert(`Failed to open file: ${err}`);
    return false;
  }
}

export async function saveFile(editor: any, forceSaveAs = false): Promise<boolean> {
  const store = useAppStore.getState();
  let filePath = store.filePath;
  if (!filePath || forceSaveAs) {
    const selected = await save({
      filters: [{ name: "Fountain", extensions: ["fountain"] }],
      defaultPath: `${store.scriptName}.fountain`,
    });
    if (!selected) return false;
    filePath = selected;
  }
  try {
    const content = tiptapToFountain(editor.getJSON());
    const savedName = filePath.split(/[\\/]/).pop()!.replace(/\.fountain$/i, '')
    await invoke("write_file", { path: filePath, content });
    store.setFilePath(filePath);
    store.setScriptName(savedName);
    store.setDirty(false);
    return true;
  } catch (err) {
    alert(`Failed to save file: ${err}`);
    return false;
  }
}

export async function renameScript(newName: string): Promise<void> {
  const store = useAppStore.getState()
  store.setScriptName(newName)
  if (!store.filePath) return
  const dir = store.filePath.replace(/[\\/][^\\/]+$/, '')
  const newPath = `${dir}/${newName}.fountain`
  await invoke('rename_file', { oldPath: store.filePath, newPath })
  store.setFilePath(newPath)
}

export function startAutoSave(editor: any) {
  return setInterval(async () => {
    const { filePath, isDirty } = useAppStore.getState();
    if (filePath && isDirty) {
      try {
        await saveFile(editor);
      } catch (err) {
        console.error("Auto-save failed:", err);
      }
    }
  }, 30_000);
}
