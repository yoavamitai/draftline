// src/components/TitleBar.tsx
import { getCurrentWindow } from "@tauri-apps/api/window";

const appWindow = getCurrentWindow();

interface BtnProps {
  color: string;
  label: string;
  symbol: string;
  onClick: () => void;
}

function TrafficLight({ color, label, symbol, onClick }: BtnProps) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={onClick}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      style={{
        width: 12,
        height: 12,
        minWidth: 12,
        flexShrink: 0,
        borderRadius: "50%",
        backgroundColor: color,
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 8,
        fontWeight: "bold",
        color: "rgba(0,0,0,0.5)",
        boxShadow: "inset 0 0 0 0.5px rgba(0,0,0,0.2)",
      }}
    >
      <span style={{ opacity: 0 }} className="group-hover:opacity-100 transition-opacity duration-75">
        {symbol}
      </span>
    </div>
  );
}

export function TitleBar() {
  return (
    <div
      className="group/titlebar relative z-50 h-7 shrink-0 flex items-center justify-end px-3 border-sidebar-border select-none"
    >
      <div className="flex items-center gap-1.5 group">
        <TrafficLight color="#FEBC2E" label="Minimize" symbol="−" onClick={() => appWindow.minimize()} />
        <TrafficLight color="#28C840" label="Maximize" symbol="↗" onClick={() => appWindow.toggleMaximize()} />
        <TrafficLight color="#FF5F57" label="Close"    symbol="✕" onClick={() => appWindow.close()} />

      </div>
    </div>
  );
}
