import React from "react";
import { observer } from "mobx-react-lite";
import { modelStore } from "@trikomi/core/studio";

export type StudioMode = "model" | "uv" | "material" | "validation";

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
            onClick={() => {
              onSelectMode("model");
              onShowToast?.("Switched workspace to Model Studio");
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
            <span>Model Studio</span>
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

          <div
            className={`nav-tab ${currentMode === "validation" ? "active" : ""}`}
            onClick={() => {
              onSelectMode("validation");
              onShowToast?.("Switched workspace to Asset Validator");
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
              <polyline points="9 12 11 14 15 10" />
            </svg>
            <span>Asset Validator</span>
          </div>
        </nav>
      </div>

      {/* Right Controls */}
      <div className="header-right-cluster">
        {/* Undo / Redo */}
        <button
          className="tool-btn"
          title="Undo"
          onClick={() => {
            modelStore.resetCamera?.();
            onShowToast?.("Undo action");
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M3 7v6h6" />
            <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
          </svg>
        </button>
        <button
          className="tool-btn"
          title="Redo"
          onClick={() => onShowToast?.("Redo action")}
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
          onClick={() => onShowToast?.("User Profile: Trikomi Designer")}
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
    </header>
  );
});
