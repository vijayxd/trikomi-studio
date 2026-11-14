import React, { useRef, useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import { uvOrganizerStore, modelStore, UVViewport } from "@trikomi/core/studio";

/**
 * Pure Presentation Skin for the 2D UV Canvas View.
 * 100% free of raw WebGL math, Three.js scenes, render loops, and drag state machines.
 * Delegates all lifecycle and interaction to the headless UVViewport engine in @trikomi/core/studio.
 */
export const UVCanvasView = observer(() => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<UVViewport | null>(null);
  const [, setTick] = useState(0);

  // Mount Headless UVViewport on DOM container
  useEffect(() => {
    if (!containerRef.current) return;
    const viewport = new UVViewport(
      containerRef.current,
      uvOrganizerStore,
      modelStore,
      () => setTick(t => t + 1)
    );
    viewportRef.current = viewport;

    return () => {
      viewport.dispose();
      viewportRef.current = null;
    };
  }, []);

  // Sync external reactive MobX triggers
  useEffect(() => {
    viewportRef.current?.updateZonesOverlay();
    viewportRef.current?.rebuildUVMeshes();
    viewportRef.current?.updateGizmoMesh();
  }, [
    modelStore.currentModel,
    modelStore.pieces.length,
    modelStore.visibilityVersion,
    modelStore.selectedPiece?.id,
    modelStore.selectedPieceIds.slice(),
    uvOrganizerStore.zones,
    uvOrganizerStore.layoutVersion,
    uvOrganizerStore.zoneDisplayMode
  ]);

  // External Reset & Focus triggers from store
  useEffect(() => {
    if (uvOrganizerStore.uvViewportResetTrigger > 0) {
      viewportRef.current?.resetView();
    }
  }, [uvOrganizerStore.uvViewportResetTrigger]);

  useEffect(() => {
    if (uvOrganizerStore.uvViewportFocusTrigger > 0) {
      viewportRef.current?.focusSelectedIsland();
    }
  }, [uvOrganizerStore.uvViewportFocusTrigger]);

  // Keyboard shortcut 'F' to focus selected island
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "f" || e.key === "F") {
        if (modelStore.selectedPiece || modelStore.selectedPieceIds.length > 0) {
          e.preventDefault();
          viewportRef.current?.focusSelectedIsland();
          modelStore.focusOnSelected?.();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const viewport = viewportRef.current;
  const marquee = viewport?.marqueeState;
  const hoveredPieceId = modelStore.hoveredPieceId;
  const zoomPercent = viewport ? Math.round(viewport.viewState.zoom * 100) : 100;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        cursor: viewport ? viewport.getCursor() : "default"
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* 2D Canvas Mount */}
      <div
        ref={containerRef}
        onPointerDown={(e) => viewport?.onPointerDown(e.nativeEvent)}
        onPointerMove={(e) => viewport?.onPointerMove(e.nativeEvent)}
        onPointerLeave={() => {
          if (viewport) {
            viewport.activeGizmoHandle = null;
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
          onClick={() => viewport?.resetView()}
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
