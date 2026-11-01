import React, { useState } from "react";
import { observer } from "mobx-react-lite";
import { modelStore } from "../../store/modelStore";
import { uvOrganizerStore } from "../../store/uvOrganizerStore";

interface StudioLeftPanelProps {
  collapsed?: boolean;
}

export const StudioLeftPanel: React.FC<StudioLeftPanelProps> = observer(({ collapsed = false }) => {
  const [searchFilter, setSearchFilter] = useState("");
  const [transformTool, setTransformTool] = useState<"select" | "move" | "rotate" | "scale">("select");

  const filteredPieces = modelStore.pieces.filter((p) =>
    searchFilter ? p.name.toLowerCase().includes(searchFilter.toLowerCase()) : true
  );

  return (
    <aside className={`panel-left-sidebar cyber-chassis ${collapsed ? "collapsed" : ""}`} id="sceneSidebar">
      {/* Panel Titlebar with Curated Model Navigator & Search */}
      <div
        className="panel-header-titlebar"
        style={{ margin: "-8px -8px 6px", borderRadius: "var(--radius-chassis) var(--radius-chassis) 0 0" }}
      >
        <div className="titlebar-text">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#14d9ff" strokeWidth="2">
            <polygon points="12 2 2 7 12 12 22 7 12 2" />
            <polyline points="2 17 12 22 22 17" />
            <polyline points="2 12 12 17 22 12" />
          </svg>
          <span>Scene Explorer</span>
        </div>

        {/* Curated Model Browser Navigator */}
        <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
          <button
            className="control-toggle-btn"
            style={{ width: "20px", height: "20px", padding: 0 }}
            onClick={() => modelStore.loadPrevCuratedModel(uvOrganizerStore)}
            title="Previous Curated Garment (Left Arrow)"
            disabled={modelStore.isLoadingCuratedModel}
          >
            ‹
          </button>
          <span
            style={{
              fontSize: "9px",
              fontFamily: "'JetBrains Mono', monospace",
              color: "var(--neon-cyan)",
              padding: "0 2px"
            }}
          >
            {modelStore.currentCuratedIndex >= 0 ? modelStore.currentCuratedIndex + 1 : 1}/{modelStore.filteredCuratedList.length || 40}
          </span>
          <button
            className="control-toggle-btn"
            style={{ width: "20px", height: "20px", padding: 0 }}
            onClick={() => modelStore.loadNextCuratedModel(uvOrganizerStore)}
            title="Next Curated Garment (Right Arrow)"
            disabled={modelStore.isLoadingCuratedModel}
          >
            ›
          </button>
        </div>
      </div>

      {/* 1. Scene Tree Subcard */}
      <div className="studio-subcard" style={{ flex: 1.1, minHeight: "90px" }}>
        <div className="subcard-title-bar">
          <span style={{ fontSize: "10px" }}>Hierarchy ({modelStore.pieces.length} Pieces)</span>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <span
              style={{ fontSize: "9px", color: "var(--text-muted)", cursor: "pointer" }}
              onClick={() => modelStore.toggleAllPiecesVisibility()}
              title="Toggle All Visibility"
            >
              👁 All
            </span>
          </div>
        </div>

        <div className="scene-tree-content">
          {/* Root Group Node */}
          <div className="tree-node-item">
            <div className="tree-node-prefix">
              <span style={{ fontSize: "9px" }}>▼</span>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z" />
              </svg>
              <span style={{ fontWeight: 600, color: "#fff" }}>
                {modelStore.modelMeta.title || "Garment_Model.glb"}
              </span>
            </div>
          </div>

          {/* Piece Nodes */}
          {filteredPieces.map((piece) => {
            const isSelected = modelStore.selectedPiece?.id === piece.id;
            const isVisible = piece.visible !== false;

            return (
              <div
                key={piece.id}
                className={`tree-node-item tree-indent-level ${isSelected ? "active" : ""}`}
                onClick={() => modelStore.selectPiece(piece.mesh)}
              >
                <div className="tree-node-prefix">
                  <span style={{ fontSize: "8px", color: "var(--text-muted)" }}>›</span>
                  <svg
                    width="9"
                    height="9"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={isSelected ? "#fff" : "currentColor"}
                    strokeWidth="2"
                  >
                    <polygon points="12 2 2 7 12 12 22 7 12 2" />
                  </svg>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", maxWidth: "120px" }}>
                    {piece.name}
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "8px", color: "var(--text-muted)" }}>
                    {piece.triangles > 1000 ? `${(piece.triangles / 1000).toFixed(1)}k` : piece.triangles}t
                  </span>
                  <span
                    className="tree-visibility-eye"
                    onClick={(e) => {
                      e.stopPropagation();
                      modelStore.togglePieceVisibility(piece.id);
                    }}
                    title={isVisible ? "Hide Piece" : "Show Piece"}
                    style={{ color: isVisible ? "var(--text-secondary)" : "rgba(255,255,255,0.2)" }}
                  >
                    {isVisible ? "👁" : "🕶"}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Transforms Subcard */}
      <div className="studio-subcard">
        <div className="subcard-title-bar">
          <span>Transforms</span>
          <span style={{ fontSize: "8.5px", color: "var(--text-muted)" }}>LOCAL</span>
        </div>
        <div className="transforms-form-content">
          <div className="transform-axis-row">
            <span>Position</span>
            <div className="triplet-inputs">
              <div className="cell-axis-val">X 0.00</div>
              <div className="cell-axis-val">Y 0.00</div>
              <div className="cell-axis-val">Z 0.00</div>
            </div>
          </div>
          <div className="transform-axis-row">
            <span>Rotation</span>
            <div className="triplet-inputs">
              <div className="cell-axis-val">X 0.00</div>
              <div className="cell-axis-val">Y 0.00</div>
              <div className="cell-axis-val">Z 0.00</div>
            </div>
          </div>
          <div className="transform-axis-row">
            <span>Scale</span>
            <div className="triplet-inputs">
              <div className="cell-axis-val">X 1.00</div>
              <div className="cell-axis-val">Y 1.00</div>
              <div className="cell-axis-val">Z 1.00</div>
            </div>
          </div>
          <button
            className="btn-reset-full"
            onClick={() => {
              if (modelStore.currentModel) {
                modelStore.currentModel.position.set(0, 0, 0);
                modelStore.currentModel.rotation.set(0, 0, 0);
                modelStore.currentModel.scale.set(1, 1, 1);
              }
            }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* 3. Quick Tools Subcard */}
      <div className="studio-subcard">
        <div className="subcard-title-bar">Quick Tools</div>
        <div className="quick-tools-grid-box">
          <button
            className={`btn-tool-square ${transformTool === "select" ? "active" : ""}`}
            onClick={() => setTransformTool("select")}
            title="Selection Tool"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
            </svg>
            <span>Select</span>
          </button>
          <button
            className={`btn-tool-square ${transformTool === "move" ? "active" : ""}`}
            onClick={() => setTransformTool("move")}
            title="Move Tool"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="5 9 2 12 5 15" />
              <polyline points="9 5 12 2 15 5" />
              <polyline points="15 19 12 22 9 19" />
              <polyline points="19 9 22 12 19 15" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <line x1="12" y1="2" x2="12" y2="22" />
            </svg>
            <span>Move</span>
          </button>
          <button
            className={`btn-tool-square ${transformTool === "rotate" ? "active" : ""}`}
            onClick={() => setTransformTool("rotate")}
            title="Rotate Tool"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 11-.57-8.38l5.67-5.67" />
            </svg>
            <span>Rotate</span>
          </button>
          <button
            className={`btn-tool-square ${transformTool === "scale" ? "active" : ""}`}
            onClick={() => setTransformTool("scale")}
            title="Scale Tool"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M15 3h6v6" />
              <path d="M9 21H3v-6" />
            </svg>
            <span>Scale</span>
          </button>
        </div>
      </div>
    </aside>
  );
});
