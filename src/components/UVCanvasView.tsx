import React, { useRef, useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import { uvOrganizerStore, modelStore, studioViewerManager, UVViewerPlugin } from "@trikomi/core/studio";

/**
 * Pure Presentation Skin for the 2D UV Canvas View.
 * 100% free of ad-hoc WebGL scenes and render loops.
 * Exclusively instantiates Trikomi Core ThreeViewer with the UVViewerPlugin.
 */
export const UVCanvasView = observer(() => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pluginRef = useRef<UVViewerPlugin | null>(null);
  const [, setTick] = useState(0);

  // Mount/Adopt Trikomi ThreeViewer with UVViewerPlugin
  useEffect(() => {
    if (!containerRef.current) return;
    const { plugin } = studioViewerManager.attachUVToContainer({
      container: containerRef.current,
      uvStore: uvOrganizerStore,
      modelStore,
      onStateChange: () => setTick(t => t + 1)
    });
    pluginRef.current = plugin;

    return () => {
      // Detach UV canvas element on unmount without destroying the UVViewer or scenes
      studioViewerManager.detachUVFromContainer();
      pluginRef.current = null;
    };
  }, []);

  // Sync external reactive MobX triggers
  useEffect(() => {
    pluginRef.current?.updateZonesOverlay();
    pluginRef.current?.rebuildUVMeshes();
    pluginRef.current?.updateGizmoMesh();
  }, [
    modelStore.currentModel,
    modelStore.pieces.length,
    modelStore.visibilityVersion,
    modelStore.selectedPiece?.id,
    modelStore.selectedPieceIds.join(","),
    uvOrganizerStore.zones,
    uvOrganizerStore.layoutVersion,
    uvOrganizerStore.zoneDisplayMode
  ]);

  // External Reset & Focus triggers from store
  useEffect(() => {
    if (uvOrganizerStore.uvViewportResetTrigger > 0) {
      pluginRef.current?.resetView();
    }
  }, [uvOrganizerStore.uvViewportResetTrigger]);

  useEffect(() => {
    if (uvOrganizerStore.uvViewportFocusTrigger > 0) {
      pluginRef.current?.focusSelectedIsland();
    }
  }, [uvOrganizerStore.uvViewportFocusTrigger]);

  // Keyboard shortcut 'F' to focus selected island
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "f" || e.key === "F") {
        if (modelStore.selectedPiece || modelStore.selectedPieceIds.length > 0) {
          e.preventDefault();
          pluginRef.current?.focusSelectedIsland();
          modelStore.focusOnSelected?.();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const plugin = pluginRef.current;
  const marquee = plugin?.marqueeState;
  const hoveredPieceId = modelStore.hoveredPieceId;
  const zoomPercent = plugin ? Math.round(plugin.viewState.zoom * 100) : 100;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        cursor: plugin ? plugin.getCursor() : "default"
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* 2D Canvas Mount */}
      <div
        ref={containerRef}
        onPointerDown={(e) => plugin?.onPointerDown(e.nativeEvent)}
        onPointerMove={(e) => plugin?.onPointerMove(e.nativeEvent)}
        onPointerLeave={() => {
          if (plugin) {
            plugin.activeGizmoHandle = null;
            modelStore.setHoveredPieceId(null);
            setTick(t => t + 1);
          }
        }}
        style={{ width: "100%", height: "100%" }}
      />

      {/* Visual Marquee Selection Box */}
      {marquee && (() => {
        const left = Math.min(marquee.startX, marquee.currentX);
        const top = Math.min(marquee.startY, marquee.currentY);
        const width = Math.abs(marquee.currentX - marquee.startX);
        const height = Math.abs(marquee.currentY - marquee.startY);

        if (width < 3 && height < 3) return null;

        return (
          <div
            className="uv-marquee-box"
            style={{
              left: `${left}px`,
              top: `${top}px`,
              width: `${width}px`,
              height: `${height}px`
            }}
          />
        );
      })()}

      {/* Floating Hover Badge */}
      {hoveredPieceId && (
        <div style={{
          position: "absolute",
          top: "8px",
          left: "10px",
          display: "flex",
          alignItems: "center",
          gap: "6px",
          pointerEvents: "none",
          background: "rgba(15, 23, 42, 0.88)",
          backdropFilter: "blur(6px)",
          padding: "3px 8px",
          borderRadius: "6px",
          fontSize: "10px",
          color: "#38bdf8",
          fontWeight: "600",
          border: "1px solid rgba(56, 189, 248, 0.35)",
          boxShadow: "0 4px 12px rgba(0,0,0,0.4)"
        }}>
          <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#38bdf8", boxShadow: "0 0 6px #38bdf8" }} />
          <span>{modelStore.pieces.find(p => p.id === hoveredPieceId)?.name || "Pattern Island"}</span>
        </div>
      )}

      {/* Zoom Display and View Reset Controls */}
      <div style={{
        position: "absolute",
        bottom: "8px",
        right: "10px",
        display: "flex",
        alignItems: "center",
        gap: "4px",
        background: "rgba(14, 21, 39, 0.85)",
        border: "1px solid rgba(255, 255, 255, 0.1)",
        borderRadius: "6px",
        padding: "2px 5px",
        fontSize: "9px",
        color: "var(--text-secondary)"
      }}>
        <span>Zoom: {zoomPercent}%</span>
        <button
          onClick={() => plugin?.resetView()}
          style={{
            background: "none",
            border: "none",
            color: "var(--neon-cyan)",
            cursor: "pointer",
            fontSize: "9px",
            fontWeight: "600"
          }}
          title="Reset Zoom & Pan to Fit UV Space"
        >
          Reset
        </button>
      </div>
    </div>
  );
});
export default UVCanvasView;
