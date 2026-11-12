import React, { useState } from "react";
import { observer } from "mobx-react-lite";
import { modelStore, uvOrganizerStore } from "@trikomi/core/studio";

export type StudioMode = "model" | "uv" | "material";

interface StudioTopBarProps {
  currentMode: StudioMode;
  onSelectMode: (mode: StudioMode) => void;
  isTurntablePlaying?: boolean;
  onToggleTurntable?: () => void;
  onExportGLB: () => void;
  onShowToast?: (msg: string) => void;
}

export const StudioTopBar: React.FC<StudioTopBarProps> = observer(({
  currentMode,
  onSelectMode,
  isTurntablePlaying = false,
  onToggleTurntable,
  onExportGLB,
  onShowToast
}) => {
  const [showInfoModal, setShowInfoModal] = useState(false);
  return (
    <header className="studio-header">
      {/* Left Logo + Studio Tabs */}
      <div className="header-left-cluster">
        {/* Brand Logo */}
        <div className="brand-badge" onClick={() => onShowToast?.("Trikomi 3D Studio")}>
          <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
            <defs>
              <linearGradient id="logoGrad1" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#00f2fe" />
                <stop offset="100%" stopColor="#4facfe" />
              </linearGradient>
              <linearGradient id="logoGrad2" x1="0" y1="28" x2="28" y2="0" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#3b82f6" />
                <stop offset="100%" stopColor="#9333ea" />
              </linearGradient>
            </defs>
            <path d="M14 2L3 23H10.5L14 15.5L17.5 23H25L14 2Z" fill="url(#logoGrad1)" />
            <path d="M14 15.5L10.5 23H17.5L14 15.5Z" fill="url(#logoGrad2)" opacity="0.85" />
            <path d="M9 11L14 2L19 11H9Z" fill="#e0f2fe" opacity="0.35" />
          </svg>
          <span className="brand-name">Trikomi</span>
        </div>

        {/* Center-Left Navigation Tabs */}
        <nav className="nav-tabs-group" aria-label="Studio Navigation">
          <div
            className={`nav-tab ${currentMode === "model" ? "active" : ""}`}
            style={{ opacity: 0.65 }}
            onClick={() => {
              onShowToast?.("Model Studio is pending implementation");
            }}
            title="Model Studio (Pending)"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
            <span>Model Studio</span>
            <span style={{ fontSize: "8.5px", padding: "1px 5px", borderRadius: "3px", background: "rgba(255, 255, 255, 0.08)", color: "#94a3b8", marginLeft: "4px" }}>Pending</span>
          </div>

          <div
            className={`nav-tab ${currentMode === "uv" ? "active" : ""}`}
            onClick={() => {
              onSelectMode("uv");
              onShowToast?.("Switched workspace to UV Studio");
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
            </svg>
            <span>UV Studio</span>
          </div>

          <div
            className={`nav-tab ${currentMode === "material" ? "active" : ""}`}
            onClick={() => {
              onSelectMode("material");
              onShowToast?.("Switched workspace to Material Studio");
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="9" />
              <ellipse cx="12" cy="12" rx="9" ry="3.5" />
              <ellipse cx="12" cy="12" rx="3.5" ry="9" />
            </svg>
            <span>Material Studio</span>
          </div>
        </nav>
      </div>

      {/* Right Controls */}
      <div className="header-right-cluster">
        {/* Undo / Redo */}
        <button
          className="tool-btn"
          title="Undo (Ctrl+Z)"
          onClick={() => {
            const success = uvOrganizerStore.undo();
            if (success) {
              onShowToast?.("Undid last UV action");
            } else {
              modelStore.resetCamera?.();
              onShowToast?.("Nothing to undo (camera reset)");
            }
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M3 7v6h6" />
            <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
          </svg>
        </button>
        <button
          className="tool-btn"
          title="Redo (Ctrl+Y)"
          onClick={() => {
            const success = uvOrganizerStore.redo();
            if (success) {
              onShowToast?.("Redid UV action");
            } else {
              onShowToast?.("Nothing to redo");
            }
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M21 7v6h-6" />
            <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7" />
          </svg>
        </button>

        <div className="divider-vertical" />

        {/* Play Turntable Preview */}
        <button
          className={`tool-btn ${isTurntablePlaying ? "active" : ""}`}
          title="Toggle Turntable Spin"
          onClick={onToggleTurntable}
        >
          <svg width="16" height="16" fill="currentColor" viewBox="0 0 24 24">
            <polygon points="6 4 20 12 6 20 6 4" />
          </svg>
        </button>

        {/* Export Button */}
        <button
          className="btn-export-gradient"
          onClick={() => {
            onExportGLB();
            onShowToast?.("Exporting Garment Asset...");
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="17 8 12 3 7 8" />
            <line x1="12" y1="3" x2="12" y2="15" />
          </svg>
          <span>Export</span>
        </button>

        {/* User Profile Avatar */}
        <div
          className="user-avatar-pill"
          onClick={() => setShowInfoModal(!showInfoModal)}
          title="Studio Info & Hotkeys"
        >
          <svg viewBox="0 0 36 36" style={{ width: "100%", height: "100%", background: "#1e293b" }}>
            <defs>
              <linearGradient id="avBg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#6366f1" />
              </linearGradient>
            </defs>
            <rect width="36" height="36" fill="url(#avBg)" opacity="0.25" />
            <circle cx="18" cy="13.5" r="6" fill="#cbd5e1" />
            <path d="M7 33c1.5-6.5 6-9.5 11-9.5s9.5 3 11 9.5" fill="#94a3b8" />
          </svg>
        </div>
      </div>

      {/* Studio Info & Hotkeys Modal */}
      {showInfoModal && (
        <div
          style={{
            position: "fixed",
            top: "52px",
            right: "16px",
            width: "320px",
            background: "#0c1220",
            border: "1px solid #1e293b",
            borderRadius: "8px",
            padding: "16px",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.7)",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            gap: "12px"
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", color: "#f8fafc" }}>Studio Info & Shortcuts</span>
            <button
              onClick={() => setShowInfoModal(false)}
              style={{ background: "transparent", border: "none", color: "#64748b", cursor: "pointer", fontSize: "14px" }}
            >
              ✕
            </button>
          </div>

          <div style={{ background: "#060911", padding: "8px 10px", borderRadius: "6px", border: "1px solid #162032", fontSize: "10px", display: "flex", flexDirection: "column", gap: "4px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#94a3b8" }}>Active Model:</span>
              <span style={{ color: "#38bdf8", fontWeight: "600" }}>{modelStore.modelMeta.title || "Sportswear Garment"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#94a3b8" }}>Triangles:</span>
              <span style={{ color: "#f1f5f9" }}>{(modelStore.modelMeta.triangles || 0).toLocaleString()}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#94a3b8" }}>Garment Panels:</span>
              <span style={{ color: "#f1f5f9" }}>{modelStore.pieces.length} panels</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#94a3b8" }}>Architecture:</span>
              <span style={{ color: "#10b981" }}>ThreeViewer + TrikomiMeshNode</span>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={{ fontSize: "10px", fontWeight: "600", color: "#94a3b8", textTransform: "uppercase" }}>Keyboard Shortcuts</span>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", fontSize: "10px" }}>
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}><kbd style={{ background: "#1e293b", padding: "2px 5px", borderRadius: "3px", color: "#38bdf8" }}>Q</kbd> <span>Select</span></div>
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}><kbd style={{ background: "#1e293b", padding: "2px 5px", borderRadius: "3px", color: "#38bdf8" }}>W</kbd> <span>Move</span></div>
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}><kbd style={{ background: "#1e293b", padding: "2px 5px", borderRadius: "3px", color: "#38bdf8" }}>E</kbd> <span>Rotate</span></div>
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}><kbd style={{ background: "#1e293b", padding: "2px 5px", borderRadius: "3px", color: "#38bdf8" }}>R</kbd> <span>Scale</span></div>
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}><kbd style={{ background: "#1e293b", padding: "2px 5px", borderRadius: "3px", color: "#38bdf8" }}>F</kbd> <span>Focus</span></div>
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}><kbd style={{ background: "#1e293b", padding: "2px 5px", borderRadius: "3px", color: "#38bdf8" }}>Ctrl+Z</kbd> <span>Undo</span></div>
            </div>
          </div>
        </div>
      )}
    </header>
  );
});
