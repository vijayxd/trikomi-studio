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
        {/* Perspective / Orthographic Toggle */}
        <button
          className="viewport-perspective-btn"
          onClick={() => {
            const nextMode = modelStore.toggleCameraProjection?.();
            onShowToast?.(`Camera Projection: ${nextMode === "orthographic" ? "Orthographic" : "Perspective"}`);
          }}
          title="Toggle Perspective / Orthographic Projection"
        >
          <span>{modelStore.cameraProjection === "orthographic" ? "Orthographic" : "Perspective"}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

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

      {/* 3D Axis Gizmo Top-Right with interactive orientation clicks */}
      <div className="viewport-axis-gizmo" style={{ cursor: "pointer" }} title="Click axis to align view (Y: Top, X: Right, Z: Front)">
        <svg width="64" height="64" viewBox="0 0 64 64">
          {/* Y Axis Green (Top View) */}
          <g onClick={() => { modelStore.setOrthogonalView?.("y"); onShowToast?.("View: Top (Y)"); }}>
            <line x1="32" y1="36" x2="32" y2="12" stroke="#22c55e" strokeWidth="2.5" />
            <polygon points="32,7 28,14 36,14" fill="#22c55e" />
            <text x="28" y="6" fill="#22c55e" fontSize="9" fontWeight="700">Y</text>
          </g>
          {/* X Axis Red (Right View) */}
          <g onClick={() => { modelStore.setOrthogonalView?.("x"); onShowToast?.("View: Right (X)"); }}>
            <line x1="32" y1="36" x2="52" y2="44" stroke="#ef4444" strokeWidth="2.5" />
            <polygon points="56,46 49,46 51,41" fill="#ef4444" />
            <text x="57" y="49" fill="#ef4444" fontSize="9" fontWeight="700">X</text>
          </g>
          {/* Z Axis Cyan (Front View) */}
          <g onClick={() => { modelStore.setOrthogonalView?.("z"); onShowToast?.("View: Front (Z)"); }}>
            <line x1="32" y1="36" x2="14" y2="44" stroke="#06b6d4" strokeWidth="2.5" />
            <polygon points="10,46 15,41 17,46" fill="#06b6d4" />
            <text x="2" y="49" fill="#06b6d4" fontSize="9" fontWeight="700">Z</text>
          </g>
          {/* Center Hub (Reset Perspective Framing) */}
          <circle
            cx="32"
            cy="36"
            r="4.5"
            fill="#e2e8f0"
            onClick={() => { modelStore.resetCamera?.(); onShowToast?.("View: Perspective (Default)"); }}
          />
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
