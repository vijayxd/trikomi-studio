import React, { useRef, useEffect } from "react";
import { observer } from "mobx-react-lite";
import { modelStore, uvOrganizerStore, studioViewerManager } from "@trikomi/core/studio";

interface StudioCenterViewportProps {
  onToggleMaximize?: () => void;
  isMaximized?: boolean;
}

export const StudioCenterViewport: React.FC<StudioCenterViewportProps> = observer(({
  onToggleMaximize,
  isMaximized = false
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // 1. Mandatory instantiation of Trikomi Core ThreeViewer with core plugins
    const viewer = studioViewerManager.init({
      container: containerRef.current,
      backgroundColor: modelStore.backgroundColor
    });

    // 2. Bind modelStore to Trikomi ThreeViewer scene, camera & plugins
    modelStore.attachViewer(viewer);

    // 3. Load curated model into Trikomi ThreeViewer scene
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
    <section className="panel-viewport-center cyber-chassis">
      {/* Top Viewport Toolbar */}
      <div className="viewport-top-toolbar">
        <div className="camera-dropdown-pill" onClick={() => modelStore.resetCamera()} title="Reset Camera View to Frame Garment">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#14d9ff" strokeWidth="2">
            <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
          </svg>
          <span>Perspective ∨</span>
        </div>

        <div className="viewport-action-strip">
          <button
            className="control-toggle-btn"
            title="Reset Camera View to Frame Garment"
            onClick={() => modelStore.resetCamera()}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
          <button
            className={`control-toggle-btn ${modelStore.wireframeMode ? "active" : ""}`}
            title="Toggle Wireframe Mode"
            onClick={() => modelStore.toggleWireframe()}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
          </button>
          <div className="vertical-divider-bar" />
          <button
            className={`control-toggle-btn ${isMaximized ? "active" : ""}`}
            title="Fullscreen 3D Viewport"
            onClick={onToggleMaximize || (() => modelStore.resetCamera())}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />
            </svg>
          </button>
        </div>
      </div>

      {/* 3D WebGL / WebGPU Canvas Stage */}
      <div className="viewport-3d-stage" style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
        {/* Ambient Pedestal Ring */}
        <div className="stage-pedestal-disk" style={{ pointerEvents: "none" }} />

        {/* Real Trikomi ThreeViewer Canvas Mount */}
        <div
          ref={containerRef}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            cursor: "grab"
          }}
        />

        {/* 3D Axis Orientation Gizmo */}
        <div className="axes-gizmo-box" style={{ pointerEvents: "none", zIndex: 5 }}>
          <svg viewBox="0 0 100 100" width="100%" height="100%">
            <line x1="20" y1="80" x2="85" y2="80" stroke="#ef4444" strokeWidth="3" strokeLinecap="round" />
            <polygon points="88,80 82,76 82,84" fill="#ef4444" />
            <line x1="20" y1="80" x2="20" y2="15" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" />
            <polygon points="20,12 16,18 24,18" fill="#22c55e" />
            <line x1="20" y1="80" x2="65" y2="40" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" />
            <polygon points="68,37 60,40 64,44" fill="#3b82f6" />
          </svg>
        </div>
      </div>
    </section>
  );
});
