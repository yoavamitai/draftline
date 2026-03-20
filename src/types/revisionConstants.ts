// src/types/revisionConstants.ts

import type { RevisionColor } from './screenplay'

export const REVISION_COLOR_SEQUENCE: RevisionColor[] = [
  'white', 'blue', 'pink', 'yellow', 'green', 'goldenrod',
]

export const REVISION_HEX: Record<RevisionColor, string> = {
  white:     '#ffffff',
  blue:      '#dbeafe',
  pink:      '#fce7f3',
  yellow:    '#fef9c3',
  green:     '#dcfce7',
  goldenrod: '#fef3c7',
}
