import React, { useRef, useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import { when } from "mobx";
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
  const [showViewDropdown, setShowViewDropdown] = useState(false);
  const [activeViewLabel, setActiveViewLabel] = useState("Perspective");

  useEffect(() => {
    if (!containerRef.current) return;

    // Adopt headless Trikomi ThreeViewer canvas into container
    const viewer = studioViewerManager.attachToContainer({
      container: containerRef.current,
      backgroundColor: modelStore.backgroundColor
    });

    // Bind modelStore to Trikomi ThreeViewer scene, camera & plugins
    modelStore.attachViewer(viewer);

    // Initial model load into persistent viewer via MobX reactive predicate (zero timer polling)
    let cancelPredicate: (() => void) | undefined;
    if (!modelStore.currentModel) {
      cancelPredicate = when(
        () => !modelStore.currentModel && modelStore.curatedCatalog.length > 0,
        () => {
          modelStore.loadCuratedModelByIndex(0, uvOrganizerStore);
        }
      );
    }

    return () => {
      cancelPredicate?.();
      // Detach canvas from DOM on unmount without destroying the viewer or model in memory
      studioViewerManager.detachFromContainer();
    };
  }, []);

  return (
    <section className="panel viewport-panel" id="viewportContainer">
      {/* Top Floating Viewport Bar */}
      <div className="viewport-top-floating-bar">
        {/* Camera Views Dropdown (Perspective, Front, Back, Left, Right, Top, Bottom) */}
        <div style={{ position: "relative" }}>
          <button
            className="viewport-perspective-btn"
            onClick={() => setShowViewDropdown(!showViewDropdown)}
            title="Switch View Alignment / Camera Orientation"
          >
            <span>{activeViewLabel}</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>

          {showViewDropdown && (
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                marginTop: "4px",
                background: "#0d131f",
                border: "1px solid #1e293b",
                borderRadius: "6px",
                boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                display: "flex",
                flexDirection: "column",
                minWidth: "140px",
                zIndex: 50,
                overflow: "hidden"
              }}
            >
              {[
                { label: "Perspective", action: () => { modelStore.resetCamera?.(); setActiveViewLabel("Perspective"); } },
                { label: "Front (Z)", action: () => { modelStore.setOrthogonalView?.("z"); setActiveViewLabel("Front (Z)"); } },
                { label: "Back (-Z)", action: () => { modelStore.setOrthogonalView?.("-z"); setActiveViewLabel("Back (-Z)"); } },
                { label: "Left (-X)", action: () => { modelStore.setOrthogonalView?.("-x"); setActiveViewLabel("Left (-X)"); } },
                { label: "Right (X)", action: () => { modelStore.setOrthogonalView?.("x"); setActiveViewLabel("Right (X)"); } },
                { label: "Top (Y)", action: () => { modelStore.setOrthogonalView?.("y"); setActiveViewLabel("Top (Y)"); } },
                { label: "Bottom (-Y)", action: () => { modelStore.setOrthogonalView?.("-y"); setActiveViewLabel("Bottom (-Y)"); } }
              ].map((item) => (
                <button
                  key={item.label}
                  style={{
                    padding: "7px 12px",
                    background: activeViewLabel === item.label ? "rgba(56, 189, 248, 0.15)" : "transparent",
                    color: activeViewLabel === item.label ? "#38bdf8" : "#cbd5e1",
                    border: "none",
                    textAlign: "left",
                    fontSize: "11px",
                    cursor: "pointer",
                    transition: "background 0.15s"
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.06)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = activeViewLabel === item.label ? "rgba(56, 189, 248, 0.15)" : "transparent")}
                  onClick={() => {
                    item.action();
                    setShowViewDropdown(false);
                    onShowToast?.(`View: ${item.label}`);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
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

      {/* Mandatory Trikomi Core ThreeViewer Canvas Stage */}
      <div
        ref={containerRef}
        className="viewport-canvas-mount"
      />

      {/* Viewport Model Loading Progress Overlay */}
      {modelStore.isLoadingCuratedModel && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(10, 15, 26, 0.72)",
            backdropFilter: "blur(6px)",
            zIndex: 40,
            pointerEvents: "none",
            gap: "14px"
          }}
        >
          {/* Cyberpunk Progress Card */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "10px",
              padding: "18px 24px",
              background: "#0c1322",
              border: "1px solid rgba(0, 240, 255, 0.3)",
              borderRadius: "8px",
              boxShadow: "0 8px 32px rgba(0, 0, 0, 0.6), 0 0 16px rgba(0, 240, 255, 0.15)",
              minWidth: "280px"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#00f0ff"
                strokeWidth="2.5"
                style={{ animation: "spin 1.2s linear infinite" }}
              >
                <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" />
              </svg>
              <span style={{ fontSize: "12px", fontWeight: "700", color: "#f8fafc", letterSpacing: "0.5px" }}>
                STREAMING 3D ASSET
              </span>
            </div>

            {/* Progress Bar Track */}
            <div
              style={{
                width: "100%",
                height: "6px",
                background: "rgba(255, 255, 255, 0.1)",
                borderRadius: "3px",
                overflow: "hidden"
              }}
            >
              <div
                style={{
                  width: `${modelStore.loadingProgress}%`,
                  height: "100%",
                  background: "linear-gradient(90deg, #00f0ff, #a855f7)",
                  transition: "width 0.15s ease",
                  boxShadow: "0 0 8px #00f0ff"
                }}
              />
            </div>

            {/* Status Text and Percentage */}
            <div style={{ display: "flex", justifyContent: "space-between", width: "100%", fontSize: "10.5px" }}>
              <span style={{ color: "#94a3b8" }}>
                {modelStore.loadingStatusMessage || "Downloading geometry..."}
              </span>
              <span style={{ color: "#00f0ff", fontWeight: "700" }}>
                {Math.round(modelStore.loadingProgress)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Status Overlay */}
      <div className="viewport-bottom-status-overlay">
        <span>
          Selected:{" "}
          <strong style={{ color: "#22d3ee", fontWeight: 500 }}>
            {modelStore.selectedPiece?.name || modelStore.modelMeta.title || "Garment Model"}
          </strong>
          {" "}• Drag to orbit, scroll to zoom
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <button
            onClick={() => {
              modelStore.toggleWireframe();
              onShowToast?.(modelStore.wireframeMode ? "Wireframe enabled" : "Wireframe disabled");
            }}
            className={`viewport-wireframe-toggle-btn ${modelStore.wireframeMode ? "active" : ""}`}
            title="Toggle Wireframe Topology (W)"
            style={{ padding: "4px 6px" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </button>

          <button
            onClick={() => {
              modelStore.toggleDoubleShading();
              onShowToast?.(modelStore.doubleShadingMode ? "Double shading enabled" : "Double shading disabled");
            }}
            className={`viewport-wireframe-toggle-btn ${modelStore.doubleShadingMode ? "active" : ""}`}
            title="Toggle Two-Sided Shading (DoubleSide)"
            style={{ padding: "4px 6px" }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 3v18" />
              <path d="M3 9l9-6 9 6" />
              <path d="M3 15l9 6 9-6" />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
});
