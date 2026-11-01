import React, { useRef, useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import { modelStore } from "../../store/modelStore";
import { uvOrganizerStore } from "../../store/uvOrganizerStore";

interface StudioCenterViewportProps {
  onToggleMaximize?: () => void;
  isMaximized?: boolean;
}

export const StudioCenterViewport: React.FC<StudioCenterViewportProps> = observer(({
  onToggleMaximize,
  isMaximized = false
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [activeViewportTool, setActiveViewportTool] = useState<"select" | "draw" | "pivot" | "crosshair" | "measure">("select");

  useEffect(() => {
    if (containerRef.current) {
      modelStore.initThree(containerRef.current);
      const tryLoad = () => {
        if (!modelStore.currentModel && modelStore.curatedCatalog.length > 0) {
          modelStore.loadCuratedModelByIndex(0, uvOrganizerStore);
        } else if (!modelStore.currentModel) {
          setTimeout(tryLoad, 250);
        }
      };
      setTimeout(tryLoad, 100);
    }
  }, []);

  return (
    <section className="panel-viewport-center cyber-chassis">
      {/* Top Viewport Toolbar */}
      <div className="viewport-top-toolbar">
        <div className="camera-dropdown-pill" onClick={() => modelStore.resetCamera?.()} title="Reset Camera">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#14d9ff" strokeWidth="2">
            <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
          </svg>
          <span>Perspective ∨</span>
        </div>

        <div className="viewport-action-strip">
          <button
            className={`control-toggle-btn ${modelStore.wireframeMode ? "active" : ""}`}
            title="Toggle Wireframe Shading"
            onClick={() => modelStore.toggleWireframe?.()}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2a10 10 0 000 20z" />
            </svg>
          </button>
          <button
            className="control-toggle-btn"
            title="Focus Framing (F key)"
            onClick={() => modelStore.resetCamera?.()}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />
            </svg>
          </button>
          {onToggleMaximize && (
            <button
              className={`control-toggle-btn ${isMaximized ? "active" : ""}`}
              title="Fullscreen Viewport"
              onClick={onToggleMaximize}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 3 21 3 21 9" />
                <polyline points="9 21 3 21 3 15" />
                <line x1="21" y1="3" x2="14" y2="10" />
                <line x1="3" y1="21" x2="10" y2="14" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* 3D WebGL Canvas Stage */}
      <div className="viewport-3d-stage" style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
        {/* Floating 5-Tool Strip on Left */}
        <div className="viewport-floating-strip" style={{ zIndex: 10 }}>
          <button
            className={`btn-viewport-tool ${activeViewportTool === "select" ? "active" : ""}`}
            onClick={() => setActiveViewportTool("select")}
            title="Select Box"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="3 3" />
            </svg>
          </button>
          <button
            className={`btn-viewport-tool ${activeViewportTool === "draw" ? "active" : ""}`}
            onClick={() => setActiveViewportTool("draw")}
            title="Draw Annotate"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 19l7-7 3 3-7 7-3-3z" />
              <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
            </svg>
          </button>
          <button
            className={`btn-viewport-tool ${activeViewportTool === "pivot" ? "active" : ""}`}
            onClick={() => setActiveViewportTool("pivot")}
            title="Center Pivot"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="12" r="2" fill="currentColor" />
            </svg>
          </button>
          <button
            className={`btn-viewport-tool ${activeViewportTool === "crosshair" ? "active" : ""}`}
            onClick={() => setActiveViewportTool("crosshair")}
            title="Crosshair"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <line x1="12" y1="3" x2="12" y2="21" />
              <line x1="3" y1="12" x2="21" y2="12" />
            </svg>
          </button>
          <button
            className={`btn-viewport-tool ${activeViewportTool === "measure" ? "active" : ""}`}
            onClick={() => setActiveViewportTool("measure")}
            title="Measure Distance"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="4" y1="20" x2="20" y2="4" />
              <line x1="8" y1="16" x2="10" y2="18" />
              <line x1="14" y1="10" x2="16" y2="12" />
            </svg>
          </button>
        </div>

        {/* Ambient Pedestal Ring */}
        <div className="stage-pedestal-disk" style={{ pointerEvents: "none" }} />

        {/* Real Three.js Canvas Container */}
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
