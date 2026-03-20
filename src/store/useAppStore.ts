import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AppState, RevisionColor } from "../types/screenplay";
import { REVISION_COLOR_SEQUENCE } from "../types/screenplay";

interface AppStore extends AppState {
  setFilePath: (path: string | null) => void;
  setScriptName: (name: string) => void;
  setDirty: (dirty: boolean) => void;
  toggleTheme: () => void;
  toggleRevisionMode: () => void;
  nextRevisionDraft: (name: string) => void;
}

const initialState: AppState = {
  filePath: null,
  scriptName: "Untitled",
  isDirty: false,
  theme: "dark",
  revisionMode: false,
  revisionColor: "white",
  revisionDraftName: "White",
};

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      ...initialState,
      setFilePath: (filePath) => set({ filePath }),
      setScriptName: (scriptName) => set({ scriptName }),
      setDirty: (isDirty) => set({ isDirty }),
      toggleTheme: () => set((s) => ({ theme: s.theme === "dark" ? "light" : "dark" })),
      toggleRevisionMode: () => set((s) => ({ revisionMode: !s.revisionMode })),
      nextRevisionDraft: (name) => {
        const idx = REVISION_COLOR_SEQUENCE.indexOf(get().revisionColor);
        const next = REVISION_COLOR_SEQUENCE[
          (idx + 1) % REVISION_COLOR_SEQUENCE.length
        ] as RevisionColor;
        set({ revisionColor: next, revisionDraftName: name });
      },
    }),
    {
      name: "screenplay-app-store",
      partialize: (s) => ({ theme: s.theme }),
    },
  ),
);

export const getInitialState = (): AppState => initialState;
