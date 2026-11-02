import React, { useState } from "react";
import { observer } from "mobx-react-lite";
import { modelStore, uvOrganizerStore } from "@trikomi/core/studio";
import { StudioCard } from "./StudioCard";

interface StudioLeftPanelProps {
  collapsed?: boolean;
}

export const StudioLeftPanel: React.FC<StudioLeftPanelProps> = observer(({ collapsed = false }) => {
  const [searchFilter, setSearchFilter] = useState("");

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

      {/* 1. Scene Tree Collapsible Card */}
      <StudioCard
        title={`Hierarchy (${modelStore.pieces.length} Pieces)`}
        defaultCollapsed={false}
        flex={1}
        style={{ minHeight: "120px" }}
        headerRight={
          <span
            style={{ fontSize: "9px", color: "var(--text-muted)", cursor: "pointer" }}
            onClick={() => modelStore.toggleAllPiecesVisibility()}
            title="Toggle All Visibility"
          >
            👁 All
          </span>
        }
      >
        {/* Piece Search Filter Input */}
        <div style={{ padding: "4px 6px" }}>
          <input
            type="text"
            placeholder="Filter pieces..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
            style={{
              width: "100%",
              padding: "3px 6px",
              fontSize: "9px",
              background: "rgba(0,0,0,0.4)",
              border: "1px solid rgba(20,217,255,0.2)",
              borderRadius: "4px",
              color: "#fff",
              outline: "none"
            }}
          />
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
      </StudioCard>

      {/* 2. Transforms Collapsible Card with Integrated 3D Transform Gizmo Controls */}
      <StudioCard
        title="Transforms"
        defaultCollapsed={false}
        flex="0 0 auto"
        headerRight={<span style={{ fontSize: "8.5px", color: "var(--text-muted)" }}>LOCAL</span>}
      >
        <div className="transforms-form-content">
          {/* Active Gizmo Tool Mode: Move / Rotate / Scale */}
          <div style={{ display: "flex", gap: "4px", marginBottom: "8px" }}>
            <button
              className={`btn-uv-reset ${modelStore.transformMode === "translate" ? "active" : ""}`}
              style={{
                flex: 1,
                padding: "4px 2px",
                fontSize: "9.5px",
                background: modelStore.transformMode === "translate" ? "rgba(37,99,235,0.35)" : undefined,
                borderColor: modelStore.transformMode === "translate" ? "var(--neon-cyan)" : undefined,
                color: modelStore.transformMode === "translate" ? "#fff" : undefined
              }}
              onClick={() => modelStore.setTransformMode("translate")}
              title="Move (Translate) 3D Piece"
            >
              Move
            </button>
            <button
              className={`btn-uv-reset ${modelStore.transformMode === "rotate" ? "active" : ""}`}
              style={{
                flex: 1,
                padding: "4px 2px",
                fontSize: "9.5px",
                background: modelStore.transformMode === "rotate" ? "rgba(37,99,235,0.35)" : undefined,
                borderColor: modelStore.transformMode === "rotate" ? "var(--neon-cyan)" : undefined,
                color: modelStore.transformMode === "rotate" ? "#fff" : undefined
              }}
              onClick={() => modelStore.setTransformMode("rotate")}
              title="Rotate 3D Piece"
            >
              Rotate
            </button>
            <button
              className={`btn-uv-reset ${modelStore.transformMode === "scale" ? "active" : ""}`}
              style={{
                flex: 1,
                padding: "4px 2px",
                fontSize: "9.5px",
                background: modelStore.transformMode === "scale" ? "rgba(37,99,235,0.35)" : undefined,
                borderColor: modelStore.transformMode === "scale" ? "var(--neon-cyan)" : undefined,
                color: modelStore.transformMode === "scale" ? "#fff" : undefined
              }}
              onClick={() => modelStore.setTransformMode("scale")}
              title="Scale 3D Piece"
            >
              Scale
            </button>
          </div>

          {/* Hidden reference to subscribe MobX to transformVersion */}
          <span style={{ display: "none" }}>{modelStore.transformVersion}</span>

          <div className="transform-axis-row">
            <span>Position</span>
            <div className="triplet-inputs">
              <div className="cell-axis-val">X {(modelStore.selectedPiece?.mesh.position.x || 0).toFixed(2)}</div>
              <div className="cell-axis-val">Y {(modelStore.selectedPiece?.mesh.position.y || 0).toFixed(2)}</div>
              <div className="cell-axis-val">Z {(modelStore.selectedPiece?.mesh.position.z || 0).toFixed(2)}</div>
            </div>
          </div>
          <div className="transform-axis-row">
            <span>Rotation</span>
            <div className="triplet-inputs">
              <div className="cell-axis-val">X {(modelStore.selectedPiece?.mesh.rotation.x || 0).toFixed(2)}</div>
              <div className="cell-axis-val">Y {(modelStore.selectedPiece?.mesh.rotation.y || 0).toFixed(2)}</div>
              <div className="cell-axis-val">Z {(modelStore.selectedPiece?.mesh.rotation.z || 0).toFixed(2)}</div>
            </div>
          </div>
          <div className="transform-axis-row">
            <span>Scale</span>
            <div className="triplet-inputs">
              <div className="cell-axis-val">X {(modelStore.selectedPiece?.mesh.scale.x || 1).toFixed(2)}</div>
              <div className="cell-axis-val">Y {(modelStore.selectedPiece?.mesh.scale.y || 1).toFixed(2)}</div>
              <div className="cell-axis-val">Z {(modelStore.selectedPiece?.mesh.scale.z || 1).toFixed(2)}</div>
            </div>
          </div>
          <button
            className="btn-reset-full"
            onClick={() => {
              if (modelStore.selectedPiece?.mesh) {
                modelStore.selectedPiece.mesh.position.set(0, 0, 0);
                modelStore.selectedPiece.mesh.rotation.set(0, 0, 0);
                modelStore.selectedPiece.mesh.scale.set(1, 1, 1);
                modelStore.updateTransformGizmo();
              } else if (modelStore.currentModel) {
                modelStore.currentModel.position.set(0, 0, 0);
                modelStore.currentModel.rotation.set(0, 0, 0);
                modelStore.currentModel.scale.set(1, 1, 1);
                modelStore.updateTransformGizmo();
              }
            }}
          >
            Reset
          </button>
        </div>
      </StudioCard>
    </aside>
  );
});
