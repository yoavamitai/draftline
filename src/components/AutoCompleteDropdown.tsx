// src/components/AutoCompleteDropdown.tsx
import { createPortal } from "react-dom";

interface Props {
  rect: DOMRect | null;
  items: string[];
  activeIndex: number;
  onSelect: (text: string) => void;
  onClose: () => void;
}

export function AutoCompleteDropdown({ rect, items, activeIndex, onSelect, onClose }: Props) {
  if (!rect || items.length === 0) return null;

  // Flip above the block if the dropdown would overflow the bottom of the viewport.
  const DROPDOWN_HEIGHT = Math.min(items.length * 33, 200); // rough estimate
  const fitsBelow = rect.bottom + 4 + DROPDOWN_HEIGHT < window.innerHeight;
  const top = fitsBelow ? rect.bottom + 4 : rect.top - DROPDOWN_HEIGHT - 4;

  return createPortal(
    <>
      {/* Click-outside backdrop — mousedown so the editor doesn't lose focus */}
      <div
        style={{ position: "fixed", inset: 0, zIndex: 49 }}
        onMouseDown={(e) => { e.preventDefault(); onClose(); }}
      />
      <div
        className="block-picker"
        style={{
          position: "fixed",
          top,
          left: rect.left,
          zIndex: 50,
          maxHeight: 200,
          overflowY: "auto",
        }}
      >
        {items.map((item, i) => (
          <div
            key={item}
            className={`block-picker-item${i === activeIndex ? " active" : ""}`}
            // mousedown instead of click so the editor keeps focus
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(item);
            }}
          >
            {item}
          </div>
        ))}
      </div>
    </>,
    document.body,
  );
}
