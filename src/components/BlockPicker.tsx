// src/components/BlockPicker.tsx
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Pilcrow, Clapperboard, User, MessageSquare, ArrowRight, Parentheses } from "lucide-react";
import { BLOCK_TYPES } from "../editor/extensions/slashCommand";
import type { BlockType } from "../types/screenplay";
import type { LucideIcon } from "lucide-react";

interface BlockPickerProps {
  open: boolean;
  anchor: { x: number; y: number } | null;
  onSelect: (type: BlockType) => void;
  onClose: () => void;
}

const BLOCK_ICONS: Record<BlockType, LucideIcon> = {
  action: Pilcrow,
  sceneHeading: Clapperboard,
  character: User,
  dialogue: MessageSquare,
  parenthetical: Parentheses,
  transition: ArrowRight,
  section: Pilcrow,
  screenplayNote: MessageSquare,
};

const MENU_HEIGHT = BLOCK_TYPES.length * 36 + 8;

export function BlockPicker({ open, anchor, onSelect, onClose }: BlockPickerProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeIndexRef = useRef(0);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setActiveIndex(0);
      activeIndexRef.current = 0;
    }
  }, [open]);

  // Keep ref in sync so the keydown handler can read the current index without
  // being re-registered on every arrow-key press.
  activeIndexRef.current = activeIndex;

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        e.stopPropagation();
        setActiveIndex((i) => (i + 1) % BLOCK_TYPES.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        e.stopPropagation();
        setActiveIndex((i) => (i - 1 + BLOCK_TYPES.length) % BLOCK_TYPES.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        onSelect(BLOCK_TYPES[activeIndexRef.current].type);
      } else if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open, onSelect, onClose]);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open, onClose]);

  if (!open || !anchor) return null;

  const top = anchor.y + MENU_HEIGHT > window.innerHeight ? anchor.y - MENU_HEIGHT - 8 : anchor.y;

  return createPortal(
    <div
      ref={menuRef}
      style={{ position: "fixed", left: anchor.x, top, zIndex: 9999 }}
      className="block-picker"
    >
      {BLOCK_TYPES.map((item, i) => {
        const Icon = BLOCK_ICONS[item.type];
        return (
          <div
            key={item.type}
            className={`block-picker-item${i === activeIndex ? " active" : ""}`}
            onMouseEnter={() => setActiveIndex(i)}
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(item.type);
            }}
          >
            <span className="block-picker-icon">
              <Icon size={14} />
            </span>
            <span className="block-picker-label">{item.label}</span>
          </div>
        );
      })}
    </div>,
    document.body,
  );
}
