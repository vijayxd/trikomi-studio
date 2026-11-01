import React from "react";
import { observer } from "mobx-react-lite";
import { modelStore } from "../../store/modelStore";
import { uvOrganizerStore } from "../../store/uvOrganizerStore";

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
          <button className="btn-uv-strip-icon" title="Pen Tool">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 19l7-7 3 3-7 7-3-3z" />
              <path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" />
            </svg>
          </button>
          <button className="btn-uv-strip-icon" title="Circle Select">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
            </svg>
          </button>
          <button className="btn-uv-strip-icon" title="Anchor Pivot">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <circle cx="12" cy="12" r="2" fill="currentColor" />
            </svg>
          </button>
          <button className="btn-uv-strip-icon" title="Move Island">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="5 9 2 12 5 15" />
              <polyline points="9 5 12 2 15 5" />
              <polyline points="15 19 12 22 9 19" />
              <polyline points="19 9 22 12 19 15" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <line x1="12" y1="2" x2="12" y2="22" />
            </svg>
          </button>
          <button className="btn-uv-strip-icon" title="Cut Seam">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="6" cy="6" r="3" />
              <circle cx="6" cy="18" r="3" />
              <line x1="20" y1="4" x2="8.12" y2="15.88" />
              <line x1="14.47" y1="14.48" x2="20" y2="20" />
              <line x1="8.12" y1="8.12" x2="12" y2="12" />
            </svg>
          </button>
          <button className="btn-uv-strip-icon" title="Weld Seam">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <line x1="12" y1="8" x2="12" y2="16" />
            </svg>
          </button>
        </div>

        {/* 2D Canvas Stage with Wireframe Grid Quad Topology */}
        <div className="uv-2d-canvas-box">
          <svg viewBox="0 0 500 500" fill="none">
            <defs>
              <pattern id="uvQuadGrid" width="14" height="14" patternUnits="userSpaceOnUse">
                <path d="M 14 0 L 0 0 0 14" fill="none" stroke="rgba(20,217,255,0.25)" strokeWidth="0.75" />
              </pattern>
            </defs>

            {/* Collar Arc with Quad Topology */}
            <path d="M 230 90 Q 250 115 270 90 L 295 98 Q 250 135 205 98 Z" fill="rgba(37,99,235,0.4)" stroke="#14d9ff" strokeWidth="1.8" />
            <path d="M 230 90 Q 250 115 270 90 L 295 98 Q 250 135 205 98 Z" fill="url(#uvQuadGrid)" />

            {/* Left Sleeve with Quad Topology */}
            <polygon points="120,60 170,85 185,150 145,200 110,180" fill="rgba(37,99,235,0.4)" stroke="#14d9ff" strokeWidth="1.8" />
            <polygon points="120,60 170,85 185,150 145,200 110,180" fill="url(#uvQuadGrid)" />

            {/* Front Body with Quad Topology */}
            <path d="M 175,220 L 210,185 L 250,195 L 290,185 L 325,220 L 315,360 L 185,360 Z" fill="rgba(37,99,235,0.45)" stroke="#14d9ff" strokeWidth="1.8" />
            <path d="M 175,220 L 210,185 L 250,195 L 290,185 L 325,220 L 315,360 L 185,360 Z" fill="url(#uvQuadGrid)" />

            {/* Back Body with Quad Topology */}
            <path d="M 335,220 L 365,185 L 400,195 L 435,185 L 465,220 L 455,360 L 345,360 Z" fill="rgba(37,99,235,0.45)" stroke="#14d9ff" strokeWidth="1.8" />
            <path d="M 335,220 L 365,185 L 400,195 L 435,185 L 465,220 L 455,360 L 345,360 Z" fill="url(#uvQuadGrid)" />

            {/* Hem Bottoms */}
            <rect x="185" y="375" width="130" height="28" rx="3" fill="rgba(37,99,235,0.4)" stroke="#14d9ff" strokeWidth="1.8" />
            <rect x="185" y="375" width="130" height="28" fill="url(#uvQuadGrid)" />
            <rect x="345" y="375" width="110" height="28" rx="3" fill="rgba(37,99,235,0.4)" stroke="#14d9ff" strokeWidth="1.8" />
            <rect x="345" y="375" width="110" height="28" fill="url(#uvQuadGrid)" />

            {/* Selected Right Sleeve with Transform Gizmo */}
            <g transform="translate(350, 70)">
              <rect x="-10" y="-10" width="85" height="110" fill="none" stroke="#14d9ff" strokeWidth="1.5" strokeDasharray="4 4" />
              <polygon points="0,20 40,0 65,35 50,85 15,85" fill="rgba(37,99,235,0.55)" stroke="#14d9ff" strokeWidth="2" />
              <polygon points="0,20 40,0 65,35 50,85 15,85" fill="url(#uvQuadGrid)" />
              <line x1="32" y1="42" x2="32" y2="-22" stroke="#22c55e" strokeWidth="2.2" strokeLinecap="round" />
              <polygon points="32,-26 28,-18 36,-18" fill="#22c55e" />
              <line x1="32" y1="42" x2="95" y2="42" stroke="#ef4444" strokeWidth="2.2" strokeLinecap="round" />
              <polygon points="99,42 91,38 91,46" fill="#ef4444" />
              <rect x="29" y="39" width="6" height="6" fill="#ffffff" stroke="#000" strokeWidth="1" />
            </g>
          </svg>
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
