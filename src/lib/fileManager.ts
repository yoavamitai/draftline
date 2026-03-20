// src/lib/fileManager.ts
import { invoke } from '@tauri-apps/api/core'
import { open, save } from '@tauri-apps/plugin-dialog'
import { fountainToTiptap, tiptapToFountain } from './fountain'
import { useAppStore } from '../store/useAppStore'

export async function openFile(editor: any) {
  const selected = await open({
    filters: [{ name: 'Fountain', extensions: ['fountain'] }],
    multiple: false,
  })
  if (!selected || Array.isArray(selected)) return
  const content = await invoke<string>('read_file', { path: selected })
  const doc = fountainToTiptap(content)
  editor.commands.setContent(doc)
  useAppStore.getState().setFilePath(selected)
  useAppStore.getState().setDirty(false)
}

export async function saveFile(editor: any, forceSaveAs = false) {
  const store = useAppStore.getState()
  let filePath = store.filePath
  if (!filePath || forceSaveAs) {
    const selected = await save({
      filters: [{ name: 'Fountain', extensions: ['fountain'] }],
      defaultPath: 'Untitled.fountain',
    })
    if (!selected) return
    filePath = selected
    store.setFilePath(filePath)
  }
  const content = tiptapToFountain(editor.getJSON())
  await invoke('write_file', { path: filePath, content })
  store.setDirty(false)
}

export function startAutoSave(editor: any) {
  return setInterval(async () => {
    const { filePath, isDirty } = useAppStore.getState()
    if (filePath && isDirty) await saveFile(editor)
  }, 30_000)
}
