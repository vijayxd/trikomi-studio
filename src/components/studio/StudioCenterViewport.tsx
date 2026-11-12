import React, { useRef, useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import { modelStore, uvOrganizerStore, studioViewerManager } from "@trikomi/core/studio";

interface StudioCenterViewportProps {
  onToggleMaximize?: () => void;
  isMaximized?: boolean;
  onShowToast?: (msg: string) => void;
}

export const StudioCenterViewport: React.FC<StudioCenterViewportProps> = observer(({
  onToggleMaximize,
  isMaximized = false,
  onShowToast
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeGizmoMode, setActiveGizmoMode] = useState<string>("orbit");

  useEffect(() => {
    if (!containerRef.current) return;

    // Mandatory instantiation of Trikomi Core ThreeViewer with core plugins
    const viewer = studioViewerManager.init({
      container: containerRef.current,
      backgroundColor: modelStore.backgroundColor
    });

    // Bind modelStore to Trikomi ThreeViewer scene, camera & plugins
    modelStore.attachViewer(viewer);

    // Load curated model into Trikomi ThreeViewer scene
    const tryLoad = () => {
      if (!modelStore.currentModel && modelStore.curatedCatalog.length > 0) {
        modelStore.loadCuratedModelByIndex(0, uvOrganizerStore);
      } else if (!modelStore.currentModel) {
        setTimeout(tryLoad, 250);
      }
    };
    setTimeout(tryLoad, 100);

    return () => {
      studioViewerManager.dispose();
    };
  }, []);

  return (
    <section className="panel viewport-panel" id="viewportContainer">
      {/* Top Floating Viewport Bar */}
      <div className="viewport-top-floating-bar">
        {/* Perspective Dropdown */}
        <button
          className="viewport-perspective-btn"
          onClick={() => {
            modelStore.resetCamera?.();
            onShowToast?.("Camera reset to Perspective");
          }}
        >
          <span>Perspective</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {/* Center Viewport Modes Bar */}
        <div className="viewport-modes-cluster">
          <button
            className="tool-btn tool-btn-sm"
            title="Focus Origin (F)"
            onClick={() => {
              modelStore.resetCamera?.();
              onShowToast?.("Focused on origin");
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="8" />
              <circle cx="12" cy="12" r="2" />
              <line x1="12" y1="2" x2="12" y2="6" /><line x1="12" y1="18" x2="12" y2="22" />
              <line x1="2" y1="12" x2="6" y2="12" /><line x1="18" y1="12" x2="22" y2="12" />
            </svg>
          </button>

          <button
            className={`tool-btn tool-btn-sm ${activeGizmoMode === "translate" ? "active" : ""}`}
            title="Translate Gizmo"
            onClick={() => {
              setActiveGizmoMode("translate");
              onShowToast?.("Translate Gizmo enabled");
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" />
            </svg>
          </button>

          <button
            className="tool-btn tool-btn-sm"
            title="Zoom"
            onClick={() => onShowToast?.("Use wheel to Zoom")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          </button>

          <button
            className={`tool-btn tool-btn-sm ${activeGizmoMode === "orbit" ? "active" : ""}`}
            title="Orbit"
            onClick={() => {
              setActiveGizmoMode("orbit");
              onShowToast?.("Orbit control active (Left drag)");
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" /><path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
              <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" /><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
            </svg>
          </button>

          <button
            className={`tool-btn tool-btn-sm ${modelStore.wireframeMode ? "active" : ""}`}
            title="Toggle Shaded / Wireframe"
            onClick={() => {
              modelStore.toggleWireframe();
              onShowToast?.(modelStore.wireframeMode ? "Wireframe overlay active" : "Standard studio shading");
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
          </button>

          <button
            className="tool-btn tool-btn-sm"
            title="Pan Hand"
            onClick={() => onShowToast?.("Pan: Right click or Shift + drag")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M18 11V6a2 2 0 0 0-4 0v4" /><path d="M14 10V4a2 2 0 0 0-4 0v6" />
              <path d="M10 10.5V6a2 2 0 0 0-4 0v8" /><path d="M6 12a2 2 0 0 0-4 0v3a8 8 0 0 0 16 0v-4a2 2 0 0 0-4 0" />
            </svg>
          </button>

          <button
            className="tool-btn tool-btn-sm"
            title="Studio Lighting"
            onClick={() => onShowToast?.("Studio Lighting active")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          </button>

          <button
            className="tool-btn tool-btn-sm"
            title="Show Grid"
            onClick={() => onShowToast?.("Toggled Ground Grid")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <line x1="3" y1="9" x2="21" y2="9" /><line x1="3" y1="15" x2="21" y2="15" />
              <line x1="9" y1="3" x2="9" y2="21" /><line x1="15" y1="3" x2="15" y2="21" />
            </svg>
          </button>

          <button
            className="tool-btn tool-btn-sm"
            title="Point Cloud"
            onClick={() => onShowToast?.("Toggled Point Cloud")}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="6" cy="6" r="1.5" /><circle cx="12" cy="6" r="1.5" /><circle cx="18" cy="6" r="1.5" />
              <circle cx="6" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="18" cy="12" r="1.5" />
              <circle cx="6" cy="18" r="1.5" /><circle cx="12" cy="18" r="1.5" /><circle cx="18" cy="18" r="1.5" />
            </svg>
          </button>
        </div>

        {/* Fullscreen Button */}
        <button
          className="tool-btn tool-btn-sm"
          style={{ background: "rgba(17, 23, 38, 0.9)", border: "1px solid #222d42" }}
          title={isMaximized ? "Exit Fullscreen" : "Fullscreen Viewport"}
          onClick={onToggleMaximize}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
          </svg>
        </button>
      </div>

      {/* 3D Axis Gizmo Top-Right */}
      <div className="viewport-axis-gizmo">
        <svg width="64" height="64" viewBox="0 0 64 64">
          {/* Y Axis Green */}
          <line x1="32" y1="36" x2="32" y2="12" stroke="#22c55e" strokeWidth="2" />
          <polygon points="32,7 29,14 35,14" fill="#22c55e" />
          <text x="29" y="6" fill="#22c55e" fontSize="9" fontWeight="700">Y</text>
          {/* X Axis Red */}
          <line x1="32" y1="36" x2="52" y2="44" stroke="#ef4444" strokeWidth="2" />
          <polygon points="56,46 49,46 51,41" fill="#ef4444" />
          <text x="57" y="49" fill="#ef4444" fontSize="9" fontWeight="700">X</text>
          {/* Z Axis Cyan */}
          <line x1="32" y1="36" x2="14" y2="44" stroke="#06b6d4" strokeWidth="2" />
          <polygon points="10,46 15,41 17,46" fill="#06b6d4" />
          <text x="2" y="49" fill="#06b6d4" fontSize="9" fontWeight="700">Z</text>
          {/* Center Hub */}
          <circle cx="32" cy="36" r="3" fill="#e2e8f0" />
        </svg>
      </div>

      {/* Mandatory Trikomi Core ThreeViewer Canvas Stage */}
      <div
        ref={containerRef}
        className="viewport-canvas-mount"
      />

      {/* Bottom Status Overlay */}
      <div className="viewport-bottom-status-overlay">
        <span>
          Selected:{" "}
          <strong style={{ color: "#22d3ee", fontWeight: 500 }}>
            {modelStore.selectedPiece?.name || modelStore.modelMeta.title || "Garment Model"}
          </strong>
          {" "}• Drag to orbit, scroll to zoom
        </span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", color: "#64748b" }}>
          60 FPS
        </span>
      </div>
    </section>
  );
});
