import React from "react";
import { observer } from "mobx-react-lite";
import { modelStore } from "../../store/modelStore";
import { uvOrganizerStore } from "../../store/uvOrganizerStore";

export type StudioMode = "model" | "uv" | "material" | "validation";

interface StudioTopBarProps {
  currentMode: StudioMode;
  onSelectMode: (mode: StudioMode) => void;
  showLeftSidebar: boolean;
  onToggleLeftSidebar: () => void;
  showRightPanel: boolean;
  onToggleRightPanel: () => void;
  showBottomDock: boolean;
  onToggleBottomDock: () => void;
  onExportGLB: () => void;
}

export const StudioTopBar: React.FC<StudioTopBarProps> = observer(({
  currentMode,
  onSelectMode,
  showLeftSidebar,
  onToggleLeftSidebar,
  showRightPanel,
  onToggleRightPanel,
  showBottomDock,
  onToggleBottomDock,
  onExportGLB
}) => {
  return (
    <header className="studio-topbar">
      {/* Brand Header */}
      <div className="studio-brand-group">
        <div className="brand-icon-box">
          <svg viewBox="0 0 40 40" fill="none">
            <path d="M6 12L20 4L34 12V28L20 36L6 28V12Z" stroke="#14d9ff" strokeWidth="2.2" strokeLinejoin="round" />
            <path d="M20 4V36" stroke="rgba(20,217,255,0.4)" strokeWidth="1.5" />
            <path d="M6 12L34 28" stroke="rgba(168,85,247,0.5)" strokeWidth="1.5" />
            <circle cx="20" cy="20" r="5" fill="#a855f7" filter="drop-shadow(0 0 8px #14d9ff)" />
          </svg>
        </div>
        <div className="brand-text-column">
          <span className="brand-main-title">Trikomi</span>
          <span className="brand-sub-tag">We breathe dimensions</span>
        </div>
      </div>

      {/* Center 4 Studio Modes */}
      <nav className="mode-tabs-dock" aria-label="Studio Modes">
        <button
          className={`mode-tab-button ${currentMode === "model" ? "active" : ""}`}
          onClick={() => onSelectMode("model")}
        >
          Model Studio
        </button>
        <button
          className={`mode-tab-button ${currentMode === "uv" ? "active" : ""}`}
          onClick={() => onSelectMode("uv")}
        >
          UV Studio
        </button>
        <button
          className={`mode-tab-button ${currentMode === "material" ? "active" : ""}`}
          onClick={() => onSelectMode("material")}
        >
          Material Studio
        </button>
        <button
          className={`mode-tab-button ${currentMode === "validation" ? "active" : ""}`}
          onClick={() => onSelectMode("validation")}
        >
          Asset Validation
        </button>
      </nav>

      {/* Right Controls: Responsive Panel Toggles & Export Asset */}
      <div className="topbar-right-controls">
        <button
          className={`control-toggle-btn ${showLeftSidebar ? "active" : ""}`}
          onClick={onToggleLeftSidebar}
          title={showLeftSidebar ? "Collapse Left Panel (Auto-Expand Viewport)" : "Expand Left Panel"}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M9 3v18" />
          </svg>
        </button>
        <button
          className={`control-toggle-btn ${showRightPanel ? "active" : ""}`}
          onClick={onToggleRightPanel}
          title={showRightPanel ? "Collapse Right Panel (Auto-Expand Viewport)" : "Expand Right Panel"}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M15 3v18" />
          </svg>
        </button>
        <button
          className={`control-toggle-btn ${showBottomDock ? "active" : ""}`}
          onClick={onToggleBottomDock}
          title={showBottomDock ? "Collapse Bottom Dock (Auto-Expand Viewport)" : "Expand Bottom Dock"}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 15h18" />
          </svg>
        </button>
        <div className="vertical-divider-bar" />
        <button
          className="control-toggle-btn"
          title="Reset Camera View"
          onClick={() => modelStore.resetCamera?.()}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </button>
        <button
          className={`control-toggle-btn ${modelStore.wireframeMode ? "active" : ""}`}
          title="Toggle Wireframe Mode"
          onClick={() => modelStore.toggleWireframe?.()}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="12 2 2 7 12 12 22 7 12 2" />
            <polyline points="2 17 12 22 22 17" />
            <polyline points="2 12 12 17 22 12" />
          </svg>
        </button>
        <div className="vertical-divider-bar" />
        <a
          href="/catalog.html"
          target="_blank"
          rel="noopener noreferrer"
          className="control-toggle-btn"
          title="Open Dedicated Style3D Asset Catalog Page"
          style={{ textDecoration: "none" }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
          </svg>
        </a>
        <button className="btn-export-grand" onClick={onExportGLB}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          Export Asset
        </button>
      </div>
    </header>
  );
});
