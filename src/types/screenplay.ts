// src/types/screenplay.ts

export type BlockType =
  | "sceneHeading"
  | "action"
  | "character"
  | "dialogue"
  | "parenthetical"
  | "transition"
  | "section"
  | "screenplayNote";

export type RevisionOp = "insert" | "delete";

export type RevisionColor = "white" | "blue" | "pink" | "yellow" | "green" | "goldenrod";

export const REVISION_COLOR_SEQUENCE: RevisionColor[] = [
  "white",
  "blue",
  "pink",
  "yellow",
  "green",
  "goldenrod",
];

export const REVISION_HEX: Record<RevisionColor, string> = {
  white: "#ffffff",
  blue: "#dbeafe",
  pink: "#fce7f3",
  yellow: "#fef9c3",
  green: "#dcfce7",
  goldenrod: "#fef3c7",
};

export interface AppState {
  filePath: string | null;
  scriptName: string;
  isDirty: boolean;
  theme: "dark" | "light";
  revisionMode: boolean;
  revisionColor: RevisionColor;
  revisionDraftName: string;
}
