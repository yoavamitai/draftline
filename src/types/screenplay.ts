// src/types/screenplay.ts

export type BlockType =
  | 'sceneHeading'
  | 'action'
  | 'character'
  | 'dialogue'
  | 'parenthetical'
  | 'transition'
  | 'section'
  | 'screenplayNote'

export type RevisionOp = 'insert' | 'delete'

export type RevisionColor =
  | 'white' | 'blue' | 'pink' | 'yellow' | 'green' | 'goldenrod'

export interface AppState {
  filePath: string | null
  isDirty: boolean
  theme: 'dark' | 'light'
  sidebarOpen: boolean
  revisionMode: boolean
  revisionColor: RevisionColor
  revisionDraftName: string
}
