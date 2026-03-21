import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AppState, RevisionColor, TitlePageField, TitlePageData } from "../types/screenplay";
import { REVISION_COLOR_SEQUENCE } from "../types/screenplay";

interface AppStore extends AppState {
  setFilePath: (path: string | null) => void;
  setScriptName: (name: string) => void;
  setDirty: (dirty: boolean) => void;
  toggleTheme: () => void;
  toggleRevisionMode: () => void;
  nextRevisionDraft: (name: string) => void;
  titlePage: TitlePageData;
  setTitlePageField: (key: string, values: string[]) => void;
  setTitlePageFields: (fields: TitlePageField[]) => void;
  addTitlePageField: (field: TitlePageField) => void;
  removeTitlePageField: (key: string) => void;
  clearTitlePage: () => void;
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
      titlePage: { fields: [] } as TitlePageData,
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
      setTitlePageField: (key, values) =>
        set((s) => {
          const idx = s.titlePage.fields.findIndex(
            (f) => f.key.toLowerCase() === key.toLowerCase(),
          );
          if (idx === -1) {
            return { titlePage: { fields: [...s.titlePage.fields, { key, values }] } };
          }
          const updated = [...s.titlePage.fields];
          updated[idx] = { key, values };
          return { titlePage: { fields: updated } };
        }),
      setTitlePageFields: (fields) => set({ titlePage: { fields } }),
      addTitlePageField: (field) =>
        set((s) => ({ titlePage: { fields: [...s.titlePage.fields, field] } })),
      removeTitlePageField: (key) =>
        set((s) => ({
          titlePage: {
            fields: s.titlePage.fields.filter(
              (f) => f.key.toLowerCase() !== key.toLowerCase(),
            ),
          },
        })),
      clearTitlePage: () => set({ titlePage: { fields: [] } }),
    }),
    {
      name: "screenplay-app-store",
      partialize: (s) => ({ theme: s.theme }),
    },
  ),
);

export const getInitialState = (): AppState => initialState;
