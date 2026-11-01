import React from "react";
import { observer } from "mobx-react-lite";
import { modelStore } from "../../store/modelStore";
import { uvOrganizerStore } from "../../store/uvOrganizerStore";
import { UVCanvasView } from "../UVCanvasView";

interface StudioRightPanelProps {
  collapsed?: boolean;
}

export const StudioRightPanel: React.FC<StudioRightPanelProps> = observer(({ collapsed = false }) => {
  return (
    <section className={`panel-uv-studio cyber-chassis ${collapsed ? "collapsed" : ""}`} id="uvStudio">
      {/* UV Topbar Sub-tabs */}
      <div className="uv-mode-topbar">
        <div className="uv-sub-tabs-list">
          <button className="btn-uv-sub-tab active">UV Editor</button>
          <button
            className="btn-uv-sub-tab"
            onClick={() => uvOrganizerStore.arrangeAssignedUVs()}
            title="Auto-Pack Canonical Islands"
          >
            Pack
          </button>
          <button
            className="btn-uv-sub-tab"
            onClick={() => uvOrganizerStore.autoDetectPatternAssignments()}
            title="Auto-Detect Layout"
          >
            Arrange
          </button>
          <button
            className="btn-uv-sub-tab"
            onClick={() => modelStore.decimateModel(0.5)}
            title="Meshopt Geometry Optimization"
          >
            Optimize
          </button>
        </div>
        <div className="uv-set-actions">
          <div className="pill-uv-set-dropdown">
            <span>UV Sets ∨</span>
          </div>
          <button
            className="control-toggle-btn"
            style={{ width: "20px", height: "20px", borderRadius: "5px" }}
            title="Add UV Channel"
          >
            +
          </button>
        </div>
      </div>

      <div className="uv-split-container">
        {/* Left Vertical Strip */}
        <div className="uv-vertical-strip">
          <button className="btn-uv-strip-icon active" title="Island Select">
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
            title="Center Island in Canvas"
            onClick={() => {
              if (modelStore.selectedPiece) {
                uvOrganizerStore.arrangeAssignedUVs();
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

        {/* 2D Canvas Stage: Interactive GPU WebGL UV Canvas */}
        <div className="uv-2d-canvas-box" style={{ position: "relative", minHeight: "340px", flex: 1 }}>
          <UVCanvasView />
        </div>

        {/* UV Inspector Column */}
        <aside className="uv-inspector-panel">
          {/* UV Tools Subcard */}
          <div className="studio-subcard">
            <div className="subcard-title-bar">
              <span>UV Tools</span>
            </div>
            <div className="uv-actions-tile-grid">
              <div
                className="tile-action-item"
                onClick={() => uvOrganizerStore.arrangeAssignedUVs()}
                style={{ cursor: "pointer" }}
              >
                <div className="tile-icon-square">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <path d="M3 9h18" />
                    <path d="M9 21V9" />
                  </svg>
                </div>
                <span>Unwrap</span>
              </div>
              <div className="tile-action-item">
                <div className="tile-icon-square">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="2 2" />
                  </svg>
                </div>
                <span>Straighten</span>
              </div>
              <div className="tile-action-item">
                <div className="tile-icon-square">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 12h18M3 6h18M3 18h18" />
                  </svg>
                </div>
                <span>Relax</span>
              </div>
              <div
                className="tile-action-item"
                onClick={() => uvOrganizerStore.arrangeAssignedUVs()}
                style={{ cursor: "pointer" }}
              >
                <div className="tile-icon-square">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
                  </svg>
                </div>
                <span>Pack</span>
              </div>
            </div>
          </div>

          {/* Transform Subcard */}
          <div className="studio-subcard">
            <div className="subcard-title-bar">
              <span>Transform</span>
            </div>
            <div className="uv-transform-form">
              <div className="transform-axis-row">
                <span>Position</span>
                <div className="uv-pair-fields">
                  <div className="cell-uv-val">X 0.12</div>
                  <div className="cell-uv-val">Y 0.08</div>
                </div>
              </div>
              <div className="transform-axis-row">
                <span>Rotate</span>
                <div style={{ display: "flex", gap: "3px", alignItems: "center" }}>
                  <div className="cell-uv-val" style={{ flex: 1 }}>0.0° ∨</div>
                  <button className="control-toggle-btn" style={{ width: "18px", height: "18px", borderRadius: "4px" }}>
                    <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 11-.57-8.38l5.67-5.67" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="transform-axis-row">
                <span>Scale</span>
                <div className="uv-pair-fields">
                  <div className="cell-uv-val">X 1.00</div>
                  <div className="cell-uv-val">Y 1.00</div>
                </div>
              </div>
              <div className="uv-dual-buttons">
                <button className="btn-uv-reset">Reset</button>
                <button
                  className="btn-uv-apply"
                  onClick={() => uvOrganizerStore.arrangeAssignedUVs()}
                >
                  Apply
                </button>
              </div>
            </div>
          </div>

          {/* UV Islands Subcard */}
          <div className="studio-subcard" style={{ flex: 1, minHeight: "80px" }}>
            <div className="subcard-title-bar">
              <span>UV Islands ({modelStore.pieces.length})</span>
            </div>
            <div className="islands-list-scroll">
              {modelStore.pieces.slice(0, 10).map((piece, idx) => {
                const colors = ["#3b82f6", "#10b981", "#f97316", "#a855f7", "#06b6d4", "#eab308"];
                const color = colors[idx % colors.length];
                const isSelected = modelStore.selectedPiece?.id === piece.id;

                return (
                  <div
                    key={piece.id}
                    className="island-list-row"
                    onClick={() => modelStore.selectPiece(piece.mesh)}
                    style={{
                      background: isSelected ? "rgba(37,99,235,0.2)" : undefined,
                      cursor: "pointer"
                    }}
                  >
                    <div className="island-left-info">
                      <span className="tree-visibility-eye">👁</span>
                      <div className="island-color-swatch" style={{ background: color, color }} />
                      <span style={{ maxWidth: "80px", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {piece.name}
                      </span>
                    </div>
                    <span style={{ color: "var(--text-muted)", fontSize: "9px" }}>•••</span>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
});
