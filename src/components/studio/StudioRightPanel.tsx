import React, { useState } from "react";
import { observer } from "mobx-react-lite";
import { RotateCw, RotateCcw, FlipHorizontal, FlipVertical, Crosshair, Undo2 } from "lucide-react";
import { modelStore, uvOrganizerStore } from "@trikomi/core/studio";
import { UVCanvasView } from "../UVCanvasView";
import { StudioCard } from "./StudioCard";

interface StudioRightPanelProps {
  collapsed?: boolean;
}

export const StudioRightPanel: React.FC<StudioRightPanelProps> = observer(({ collapsed = false }) => {
  const [isUVMaximized, setIsUVMaximized] = useState(false);

  const getTargetPieceIds = (): string[] => {
    if (modelStore.selectedPieceIds.length > 0) return [...modelStore.selectedPieceIds];
    if (modelStore.selectedPiece) return [modelStore.selectedPiece.id];
    return [];
  };

  const targetIds = getTargetPieceIds();
  const selectedCount = targetIds.length;
  const primaryPiece = selectedCount > 0 
    ? modelStore.pieces.find(p => p.id === targetIds[0]) 
    : null;

  return (
    <section
      className={`panel-uv-studio cyber-chassis ${collapsed ? "collapsed" : ""} ${isUVMaximized ? "maximized" : ""}`}
      id="uvStudio"
    >
      {/* UV Topbar */}
      <div className="uv-mode-topbar">
        <div className="uv-sub-tabs-list">
          <span style={{ fontSize: "11px", fontWeight: "700", color: "#fff", display: "flex", alignItems: "center", gap: "6px" }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#14d9ff" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18" />
              <path d="M9 21V9" />
            </svg>
            <span>UV Editor</span>
          </span>

          {/* Garment Category Tabs: Topwear vs Bottomwear */}
          <div style={{ display: "flex", background: "rgba(0, 0, 0, 0.4)", padding: "2px", borderRadius: "6px", border: "1px solid rgba(255, 255, 255, 0.08)", marginLeft: "8px" }}>
            <button
              className={`btn-uv-sub-tab ${uvOrganizerStore.activeGarmentType === "TOPWEAR" ? "active" : ""}`}
              onClick={() => uvOrganizerStore.switchGarmentType("TOPWEAR")}
              title="Topwear Canonical Slots (Front/Back Body, Sleeves, Collar, Waistband, Trims)"
            >
              Topwear
            </button>
            <button
              className={`btn-uv-sub-tab ${uvOrganizerStore.activeGarmentType === "BOTTOMWEAR" ? "active" : ""}`}
              onClick={() => uvOrganizerStore.switchGarmentType("BOTTOMWEAR")}
              title="Bottomwear Canonical Slots (Left/Right Leg, Waistband, Ankle Ribs, Trims)"
            >
              Bottomwear
            </button>
          </div>
        </div>

        {/* Right Topbar Actions: Auto Pack, Auto Detect, Focus Island, Reset Viewport & Fullscreen Viewport */}
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <button
            className="btn-uv-sub-tab"
            onClick={() => uvOrganizerStore.arrangeAssignedUVs()}
            title="Auto-Pack Canonical Islands"
          >
            Pack
          </button>
          <button
            className="btn-uv-sub-tab"
            onClick={() => uvOrganizerStore.autoDetectPatternAssignments(true)}
            title="Auto-Detect Layout"
          >
            Arrange
          </button>
          <button
            className="control-toggle-btn"
            style={{ width: "24px", height: "24px" }}
            onClick={() => uvOrganizerStore.focusSelectedIsland()}
            title="Focus & Frame Selected Island (F key)"
          >
            <Crosshair size={12} />
          </button>
          <button
            className="control-toggle-btn"
            style={{ width: "24px", height: "24px" }}
            onClick={() => uvOrganizerStore.resetUVViewport()}
            title="Reset UV Viewport View (100% Centered)"
          >
            <RotateCcw size={12} />
          </button>
          <button
            className={`control-toggle-btn ${isUVMaximized ? "active" : ""}`}
            style={{ width: "24px", height: "24px", marginLeft: "2px" }}
            onClick={() => setIsUVMaximized(!isUVMaximized)}
            title={isUVMaximized ? "Exit Fullscreen UV Viewport" : "Fullscreen UV Viewport"}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 3 21 3 21 9" />
              <polyline points="9 21 3 21 3 15" />
              <line x1="21" y1="3" x2="14" y2="10" />
              <line x1="3" y1="21" x2="10" y2="14" />
            </svg>
          </button>
        </div>
      </div>

      <div className="uv-split-container">
        {/* 2D Canvas Stage: Clean Hardware-Accelerated WebGL UV Viewport with 2D Move & Scale Gizmo */}
        <div className="uv-2d-canvas-box" style={{ position: "relative", minWidth: 0, height: "100%", overflow: "hidden" }}>
          <UVCanvasView />
        </div>

        {/* UV Inspector Column with Collapsible StudioCards */}
        <aside className="uv-inspector-panel" style={{ minWidth: 0, height: "100%", overflowY: "auto" }}>
          {/* Card 1: Essential Layout & Pipeline Tools */}
          <StudioCard title="UV Tools" flex="0 0 auto">
            <div className="uv-actions-tile-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
              <div
                className="tile-action-item"
                onClick={() => uvOrganizerStore.arrangeAssignedUVs()}
                style={{ cursor: "pointer" }}
                title="Pack islands into UV unit space"
              >
                <div className="tile-icon-square">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
                  </svg>
                </div>
                <span>Pack</span>
              </div>

              <div
                className="tile-action-item"
                onClick={() => uvOrganizerStore.equalizeTexelDensity()}
                style={{ cursor: "pointer" }}
                title="Scale islands uniformly so fabric texture pixel density is 100% equal across all garment panels"
              >
                <div className="tile-icon-square">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 6h18M7 12h10M10 18h4" />
                  </svg>
                </div>
                <span>Equalize Density</span>
              </div>
            </div>

            {/* UV Blueprint Export Button */}
            <div style={{ padding: "0 6px 6px" }}>
              <button
                className="btn-uv-reset"
                style={{ width: "100%", padding: "4px", fontSize: "9px" }}
                onClick={() => uvOrganizerStore.exportProductionBlueprint(2048, "png")}
                title="Export 2048x2048 high-resolution transparent blueprint PNG"
              >
                Export Blueprint (2K)
              </button>
            </div>
          </StudioCard>

          {/* Card 2: Transform Subcard (Dedicated Rotate, Mirror, Alignment & Reset) */}
          <StudioCard title="Transform" flex="0 0 auto">
            <div className="uv-transform-form">
              {/* Selected Target Island Indicator */}
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "4px 6px",
                background: "rgba(0,0,0,0.3)",
                borderRadius: "5px",
                border: "1px solid rgba(255,255,255,0.06)",
                marginBottom: "4px"
              }}>
                <span style={{ fontSize: "9px", color: "var(--text-muted)" }}>Target:</span>
                <span style={{
                  fontSize: "9.5px",
                  fontWeight: "600",
                  color: selectedCount > 0 ? "var(--neon-cyan)" : "var(--text-secondary)",
                  maxWidth: "130px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap"
                }}>
                  {primaryPiece ? (selectedCount > 1 ? `${selectedCount} Islands Selected` : primaryPiece.name) : "No Island Selected"}
                </span>
              </div>

              {/* Angle Row: Rotate CCW & CW */}
              <div className="transform-axis-row">
                <span>Angle</span>
                <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                  <button
                    className="btn-uv-reset"
                    style={{ flex: 1, padding: "4px 3px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
                    onClick={() => {
                      if (targetIds.length > 0) {
                        uvOrganizerStore.rotatePiecesGroupUV(targetIds, -90);
                      }
                    }}
                    title="Rotate 90° Counter-Clockwise"
                  >
                    <RotateCcw size={11} />
                    <span>-90°</span>
                  </button>
                  <button
                    className="btn-uv-reset"
                    style={{ flex: 1, padding: "4px 3px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
                    onClick={() => {
                      if (targetIds.length > 0) {
                        uvOrganizerStore.rotatePiecesGroupUV(targetIds, 90);
                      }
                    }}
                    title="Rotate 90° Clockwise"
                  >
                    <RotateCw size={11} />
                    <span>+90°</span>
                  </button>
                </div>
              </div>

              {/* Mirror Row: Flip Horizontal (U) & Vertical (V) */}
              <div className="transform-axis-row">
                <span>Mirror</span>
                <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                  <button
                    className="btn-uv-reset"
                    style={{ flex: 1, padding: "4px 3px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
                    onClick={() => {
                      if (targetIds.length > 0) {
                        uvOrganizerStore.flipPiecesGroupUV(targetIds, "horizontal");
                      }
                    }}
                    title="Flip Horizontal (Mirror U axis)"
                  >
                    <FlipHorizontal size={11} />
                    <span>Flip U</span>
                  </button>
                  <button
                    className="btn-uv-reset"
                    style={{ flex: 1, padding: "4px 3px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
                    onClick={() => {
                      if (targetIds.length > 0) {
                        uvOrganizerStore.flipPiecesGroupUV(targetIds, "vertical");
                      }
                    }}
                    title="Flip Vertical (Mirror V axis)"
                  >
                    <FlipVertical size={11} />
                    <span>Flip V</span>
                  </button>
                </div>
              </div>

              {/* Action Buttons: Center in Zone & Reset Island */}
              <div className="uv-dual-buttons" style={{ marginTop: "4px" }}>
                <button
                  className="btn-uv-reset"
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
                  onClick={() => {
                    if (targetIds.length > 0) {
                      uvOrganizerStore.centerPiecesGroupInZone(targetIds);
                    }
                  }}
                  title="Center Island in Assigned Zone"
                >
                  <Crosshair size={11} />
                  <span>Center</span>
                </button>
                <button
                  className="btn-uv-apply"
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
                  onClick={() => {
                    if (targetIds.length > 0) {
                      uvOrganizerStore.resetPiecesGroupUV(targetIds);
                    }
                  }}
                  title="Reset Island UV to Canonical Zone Layout"
                >
                  <Undo2 size={11} />
                  <span>Reset Island</span>
                </button>
              </div>
            </div>
          </StudioCard>

          {/* Card 3: UV Islands List */}
          <StudioCard
            title={`UV Islands (${modelStore.pieces.length})`}
            flex={1}
            style={{ minHeight: "80px" }}
          >
            <div className="islands-list-scroll">
              {modelStore.pieces.map((piece, idx) => {
                const colors = ["#3b82f6", "#10b981", "#f97316", "#a855f7", "#06b6d4", "#eab308"];
                const color = colors[idx % colors.length];
                const isSelected = modelStore.selectedPiece?.id === piece.id;

                return (
                  <div
                    key={piece.id}
                    className="island-list-row"
                    onClick={() => modelStore.selectPiece(piece.mesh)}
                    style={{
                      background: isSelected ? "rgba(37,99,235,0.25)" : undefined,
                      border: isSelected ? "1px solid rgba(56, 189, 248, 0.4)" : undefined,
                      cursor: "pointer"
                    }}
                  >
                    <div className="island-left-info">
                      <div className="island-color-swatch" style={{ background: color, color }} />
                      <span style={{ maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {piece.name}
                      </span>
                    </div>
                    <span style={{ color: "var(--text-muted)", fontSize: "8.5px" }}>
                      {piece.triangles > 1000 ? `${(piece.triangles / 1000).toFixed(1)}k` : piece.triangles}t
                    </span>
                  </div>
                );
              })}
            </div>
          </StudioCard>
        </aside>
      </div>
    </section>
  );
});
