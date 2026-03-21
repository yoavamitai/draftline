// src/components/TitlePage.tsx
import { useRef, useEffect, useCallback } from "react";
import type { Editor } from "@tiptap/core";
import { useAppStore } from "../store/useAppStore";

// Standard fields always rendered in fixed positions
const STANDARD_CENTERED = [
  { key: "Title", placeholder: "Title..." },
  { key: "Credit", placeholder: "Written by..." },
  { key: "Author", placeholder: "Author..." },
  { key: "Source", placeholder: "Source..." },
];

const STANDARD_LOWER_LEFT = [
  { key: "Draft date", placeholder: "Draft date..." },
  { key: "Contact", placeholder: "Contact..." },
];

const STANDARD_KEYS = new Set(
  [...STANDARD_CENTERED, ...STANDARD_LOWER_LEFT].map((s) => s.key.toLowerCase()),
);

interface FieldProps {
  label: string;
  placeholder: string;
  values: string[];
  centered: boolean;
  isCustom?: boolean;
  tabIndex: number;
  textareaRef: (el: HTMLTextAreaElement | null) => void;
  onCommit: (values: string[]) => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onRemoveKey?: () => void;
}

function TitleField({
  label,
  placeholder,
  values,
  centered,
  isCustom,
  tabIndex,
  textareaRef,
  onCommit,
  onKeyDown,
  onRemoveKey,
}: FieldProps) {
  const setDirty = useAppStore((s) => s.setDirty);
  const innerRef = useRef<HTMLTextAreaElement | null>(null);

  function setRef(el: HTMLTextAreaElement | null) {
    innerRef.current = el;
    textareaRef(el);
  }

  function autoResize() {
    const el = innerRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }

  useEffect(() => {
    if (innerRef.current) {
      innerRef.current.value = values.join("\n");
      autoResize();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Uncontrolled: only initialize on mount

  return (
    <div style={{ marginBottom: "0.25rem" }}>
      {!centered && (
        <div style={{ opacity: 0.5, fontSize: "0.75rem" }}>
          {isCustom ? (
            <span
              contentEditable
              suppressContentEditableWarning
              style={{ outline: "none" }}
              onBlur={(e) => {
                const k = e.currentTarget.textContent?.trim() ?? "";
                if (!k) onRemoveKey?.();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  e.currentTarget.blur();
                }
              }}
            >
              {label}
            </span>
          ) : (
            <span>{label}</span>
          )}
          <span>:</span>
        </div>
      )}
      <textarea
        ref={setRef}
        rows={1}
        defaultValue={values.join("\n")}
        placeholder={placeholder}
        tabIndex={tabIndex}
        onInput={autoResize}
        onChange={() => setDirty(true)}
        onBlur={(e) => {
          const text = e.currentTarget.value;
          onCommit(text === "" ? [""] : text.split("\n"));
        }}
        onKeyDown={onKeyDown}
        style={{
          display: "block",
          width: centered ? "100%" : "auto",
          textAlign: centered ? "center" : "left",
          resize: "none",
          overflow: "hidden",
          background: "transparent",
          border: "none",
          outline: "none",
          fontFamily: "inherit",
          fontSize: "inherit",
          color: "inherit",
          minHeight: "1.5em",
          padding: 0,
        }}
      />
    </div>
  );
}

export function TitlePage({ editor }: { editor: Editor | null }) {
  const fields = useAppStore((s) => s.titlePage.fields);
  const setTitlePageField = useAppStore((s) => s.setTitlePageField);
  const setTitlePageFields = useAppStore((s) => s.setTitlePageFields);
  const addTitlePageField = useAppStore((s) => s.addTitlePageField);
  const removeTitlePageField = useAppStore((s) => s.removeTitlePageField);
  const setDirty = useAppStore((s) => s.setDirty);

  const fieldMap = new Map(fields.map((f) => [f.key.toLowerCase(), f]));
  const customFields = fields.filter((f) => !STANDARD_KEYS.has(f.key.toLowerCase()));

  const allFields = [
    ...STANDARD_CENTERED.map((s) => ({ ...s, centered: true, custom: false })),
    ...STANDARD_LOWER_LEFT.map((s) => ({ ...s, centered: false, custom: false })),
    ...customFields.map((f) => ({ key: f.key, placeholder: `${f.key}...`, centered: false, custom: true })),
  ];

  const textareaRefs = useRef<(HTMLTextAreaElement | null)[]>([]);

  const makeTextareaRef = useCallback(
    (i: number) => (el: HTMLTextAreaElement | null) => {
      textareaRefs.current[i] = el;
    },
    [],
  );

  function handleKeyDown(i: number) {
    return (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key !== "Tab") return;
      e.preventDefault();
      if (!e.shiftKey) {
        if (i < allFields.length - 1) {
          textareaRefs.current[i + 1]?.focus();
        } else {
          editor?.commands.focus();
        }
      } else {
        if (i > 0) {
          textareaRefs.current[i - 1]?.focus();
        }
      }
    };
  }

  function getValues(key: string): string[] {
    return fieldMap.get(key.toLowerCase())?.values ?? [""];
  }

  function handleCommit(key: string) {
    return (values: string[]) => {
      setTitlePageField(key, values);
      setDirty(true);
    };
  }

  return (
    <div
      className="screenplay-page"
      style={{ position: "relative", minHeight: "11in" }}
    >
      {/* Centered upper block */}
      <div
        style={{
          paddingTop: "3.5in",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        {STANDARD_CENTERED.map((s, i) => (
          <TitleField
            key={s.key}
            label={s.key}
            placeholder={s.placeholder}
            values={getValues(s.key)}
            centered
            tabIndex={i + 1}
            textareaRef={makeTextareaRef(i)}
            onCommit={handleCommit(s.key)}
            onKeyDown={handleKeyDown(i)}
          />
        ))}
      </div>

      {/* Lower-left block */}
      <div style={{ position: "absolute", bottom: "1in", left: "0" }}>
        {STANDARD_LOWER_LEFT.map((s, i) => {
          const globalIdx = STANDARD_CENTERED.length + i;
          return (
            <TitleField
              key={s.key}
              label={s.key}
              placeholder={s.placeholder}
              values={getValues(s.key)}
              centered={false}
              tabIndex={globalIdx + 1}
              textareaRef={makeTextareaRef(globalIdx)}
              onCommit={handleCommit(s.key)}
              onKeyDown={handleKeyDown(globalIdx)}
            />
          );
        })}
        {customFields.map((f, i) => {
          const globalIdx = STANDARD_CENTERED.length + STANDARD_LOWER_LEFT.length + i;
          return (
            <TitleField
              key={f.key}
              label={f.key}
              placeholder={`${f.key}...`}
              values={f.values}
              centered={false}
              isCustom
              tabIndex={globalIdx + 1}
              textareaRef={makeTextareaRef(globalIdx)}
              onCommit={(values) => {
                const updated = fields.map((field) =>
                  field.key === f.key ? { ...field, values } : field,
                );
                setTitlePageFields(updated);
                setDirty(true);
              }}
              onKeyDown={handleKeyDown(globalIdx)}
              onRemoveKey={() => {
                removeTitlePageField(f.key);
                setDirty(true);
              }}
            />
          );
        })}
        <button
          onClick={() => {
            addTitlePageField({ key: "Custom", values: [""] });
            setDirty(true);
          }}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            opacity: 0.4,
            fontSize: "0.75rem",
            padding: 0,
            color: "inherit",
            display: "block",
            marginTop: "0.5rem",
          }}
        >
          + Add field
        </button>
      </div>
    </div>
  );
}
