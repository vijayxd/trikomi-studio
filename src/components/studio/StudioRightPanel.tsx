import React, { useState } from "react";
import { observer } from "mobx-react-lite";
import { modelStore } from "../../store/modelStore";
import { uvOrganizerStore } from "../../store/uvOrganizerStore";
import { UVCanvasView } from "../UVCanvasView";
import { StudioCard } from "./StudioCard";

interface StudioRightPanelProps {
  collapsed?: boolean;
}

export const StudioRightPanel: React.FC<StudioRightPanelProps> = observer(({ collapsed = false }) => {
  const [isUVMaximized, setIsUVMaximized] = useState(false);

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

        {/* Right Topbar Actions: Auto Pack, Auto Detect & Fullscreen Viewport */}
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
            className={`control-toggle-btn ${isUVMaximized ? "active" : ""}`}
            style={{ width: "24px", height: "24px", marginLeft: "4px" }}
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
        {/* Left Vertical Strip: Clean Tool Toggles (Matching Mockup) */}
        <div className="uv-vertical-strip">
          <button className="btn-uv-strip-icon active" title="Select & Transform Island (Move / Scale)">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="3 3" />
            </svg>
          </button>
          <button
            className="btn-uv-strip-icon"
            title="Rotate 90° Clockwise"
            onClick={() => {
              if (modelStore.selectedPiece) {
                uvOrganizerStore.rotatePieceUV(modelStore.selectedPiece.id, 90);
              }
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 11-.57-8.38l5.67-5.67" />
            </svg>
          </button>
          <button
            className="btn-uv-strip-icon"
            title="Rotate 90° Counter-Clockwise"
            onClick={() => {
              if (modelStore.selectedPiece) {
                uvOrganizerStore.rotatePieceUV(modelStore.selectedPiece.id, -90);
              }
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2.5 2v6h6M2.66 15.57a10 10 0 00.57-8.38l-5.67-5.67" />
            </svg>
          </button>
          <button
            className="btn-uv-strip-icon"
            title="Flip Horizontal (Mirror U)"
            onClick={() => {
              if (modelStore.selectedPiece) {
                uvOrganizerStore.flipPieceUV(modelStore.selectedPiece.id, "horizontal");
              }
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
          <button
            className="btn-uv-strip-icon"
            title="Flip Vertical (Mirror V)"
            onClick={() => {
              if (modelStore.selectedPiece) {
                uvOrganizerStore.flipPieceUV(modelStore.selectedPiece.id, "vertical");
              }
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="17 14 12 9 7 14" />
              <line x1="12" y1="9" x2="12" y2="21" />
            </svg>
          </button>
          <button
            className="btn-uv-strip-icon"
            title="Center Island in Assigned Zone"
            onClick={() => {
              if (modelStore.selectedPiece) {
                uvOrganizerStore.centerPieceInZone(modelStore.selectedPiece.id);
              }
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="12" r="2" fill="currentColor" />
            </svg>
          </button>
          <button
            className="btn-uv-strip-icon"
            title="Reset Island UV"
            onClick={() => {
              if (modelStore.selectedPiece) {
                uvOrganizerStore.resetPieceUV(modelStore.selectedPiece.id);
              }
            }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" />
            </svg>
          </button>
        </div>

        {/* 2D Canvas Stage: Clean Hardware-Accelerated WebGL UV Viewport with 2D Move & Scale Gizmo */}
        <div className="uv-2d-canvas-box" style={{ position: "relative", minHeight: "340px", flex: 1, overflow: "hidden" }}>
          <UVCanvasView />
        </div>

        {/* UV Inspector Column with Collapsible StudioCards */}
        <aside className="uv-inspector-panel">
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

          {/* Card 2: Transform Subcard */}
          <StudioCard title="Transform" flex="0 0 auto">
            <div className="uv-transform-form">
              <div className="transform-axis-row">
                <span>Angle</span>
                <div style={{ display: "flex", gap: "3px", alignItems: "center" }}>
                  <button
                    className="btn-uv-reset"
                    style={{ flex: 1, padding: "3px" }}
                    onClick={() => {
                      if (modelStore.selectedPiece) {
                        uvOrganizerStore.rotatePieceUV(modelStore.selectedPiece.id, -90);
                      }
                    }}
                  >
                    -90°
                  </button>
                  <button
                    className="btn-uv-reset"
                    style={{ flex: 1, padding: "3px" }}
                    onClick={() => {
                      if (modelStore.selectedPiece) {
                        uvOrganizerStore.rotatePieceUV(modelStore.selectedPiece.id, 90);
                      }
                    }}
                  >
                    +90°
                  </button>
                </div>
              </div>

              <div className="transform-axis-row">
                <span>Mirror</span>
                <div style={{ display: "flex", gap: "3px", alignItems: "center" }}>
                  <button
                    className="btn-uv-reset"
                    style={{ flex: 1, padding: "3px" }}
                    onClick={() => {
                      if (modelStore.selectedPiece) {
                        uvOrganizerStore.flipPieceUV(modelStore.selectedPiece.id, "horizontal");
                      }
                    }}
                  >
                    Flip U
                  </button>
                  <button
                    className="btn-uv-reset"
                    style={{ flex: 1, padding: "3px" }}
                    onClick={() => {
                      if (modelStore.selectedPiece) {
                        uvOrganizerStore.flipPieceUV(modelStore.selectedPiece.id, "vertical");
                      }
                    }}
                  >
                    Flip V
                  </button>
                </div>
              </div>

              <div className="uv-dual-buttons">
                <button
                  className="btn-uv-reset"
                  onClick={() => {
                    if (modelStore.selectedPiece) {
                      uvOrganizerStore.resetPieceUV(modelStore.selectedPiece.id);
                    }
                  }}
                >
                  Reset
                </button>
                <button
                  className="btn-uv-apply"
                  onClick={() => uvOrganizerStore.arrangeAssignedUVs()}
                >
                  Apply
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
