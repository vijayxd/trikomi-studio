import React, { useState } from "react";
import { observer } from "mobx-react-lite";
import { modelStore, uvOrganizerStore } from "@trikomi/core/studio";

interface StudioLeftPanelProps {
  collapsed?: boolean;
  onShowToast?: (msg: string) => void;
}

export const StudioLeftPanel: React.FC<StudioLeftPanelProps> = observer(({
  collapsed = false,
  onShowToast
}) => {
  const [activeTool, setActiveTool] = useState<string>("select");
  const [searchFilter, setSearchFilter] = useState("");
  const [isTreeCollapsed, setIsTreeCollapsed] = useState(false);

  const selectedMesh = modelStore.selectedPiece?.mesh;

  const getTransformVal = (type: "pos" | "rot" | "scl", axis: "x" | "y" | "z"): string => {
    if (!selectedMesh) return type === "scl" ? "1.00" : "0.00";
    if (type === "pos") return selectedMesh.position[axis].toFixed(2);
    if (type === "rot") return (selectedMesh.rotation[axis] * (180 / Math.PI)).toFixed(1);
    if (type === "scl") return selectedMesh.scale[axis].toFixed(2);
    return "0.00";
  };

  const handleTransformChange = (type: "pos" | "rot" | "scl", axis: "x" | "y" | "z", valStr: string) => {
    const num = parseFloat(valStr);
    if (isNaN(num) || !selectedMesh) return;
    if (type === "pos") selectedMesh.position[axis] = num;
    else if (type === "rot") selectedMesh.rotation[axis] = num * (Math.PI / 180);
    else if (type === "scl") selectedMesh.scale[axis] = num;

    modelStore.updateTransformGizmo?.();
  };

  const resetTransform = () => {
    if (selectedMesh) {
      selectedMesh.position.set(0, 0, 0);
      selectedMesh.rotation.set(0, 0, 0);
      selectedMesh.scale.set(1, 1, 1);
      modelStore.updateTransformGizmo?.();
      onShowToast?.(`Transform reset on ${modelStore.selectedPiece?.name || 'piece'}`);
    } else {
      modelStore.resetCamera?.();
      onShowToast?.("Camera reset to origin");
    }
  };

  const filteredPieces = modelStore.pieces.filter((p) =>
    searchFilter ? p.name.toLowerCase().includes(searchFilter.toLowerCase()) : true
  );

  if (collapsed) return null;

  return (
    <>
      {/* 2A. Far-Left Tool Strip */}
      <aside className="panel tool-strip-far-left">
        <button
          className={`tool-btn ${activeTool === "select" ? "active" : ""}`}
          onClick={() => {
            setActiveTool("select");
            if (modelStore.transformControls) {
              modelStore.transformControls.detach();
              modelStore.transformControls.enabled = false;
            }
            onShowToast?.("Active tool: Select (Q)");
          }}
          title="Select Tool (Q)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87a.5.5 0 0 0 .35-.85L6.35 2.85a.5.5 0 0 0-.85.36z" />
          </svg>
        </button>

        <button
          className={`tool-btn ${activeTool === "cursor" ? "active" : ""}`}
          onClick={() => {
            setActiveTool("cursor");
            modelStore.resetCamera?.();
            onShowToast?.("3D Cursor: Centered to origin (0, 0, 0)");
          }}
          title="3D Cursor / Origin (Center Camera)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="7" />
            <line x1="12" y1="2" x2="12" y2="22" />
            <line x1="2" y1="12" x2="22" y2="12" />
          </svg>
        </button>

        <button
          className={`tool-btn ${activeTool === "move" ? "active" : ""}`}
          onClick={() => {
            setActiveTool("move");
            modelStore.setTransformMode("translate");
            onShowToast?.("Active tool: Move (W)");
          }}
          title="Move (W)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <polyline points="5 9 2 12 5 15" />
            <polyline points="9 5 12 2 15 5" />
            <polyline points="15 19 12 22 9 19" />
            <polyline points="19 9 22 12 19 15" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <line x1="12" y1="2" x2="12" y2="22" />
          </svg>
        </button>

        <button
          className={`tool-btn ${activeTool === "rotate" ? "active" : ""}`}
          onClick={() => {
            setActiveTool("rotate");
            modelStore.setTransformMode("rotate");
            onShowToast?.("Active tool: Rotate (E)");
          }}
          title="Rotate (E)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
            <polyline points="21 3 21 8 16 8" />
          </svg>
        </button>

        <button
          className={`tool-btn ${activeTool === "scale" ? "active" : ""}`}
          onClick={() => {
            setActiveTool("scale");
            modelStore.setTransformMode("scale");
            onShowToast?.("Active tool: Scale (R)");
          }}
          title="Scale (R)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <polyline points="15 3 21 3 21 9" />
            <polyline points="9 21 3 21 3 15" />
            <line x1="21" y1="3" x2="14" y2="10" />
            <line x1="3" y1="21" x2="10" y2="14" />
          </svg>
        </button>

        <button
          className={`tool-btn ${activeTool === "uv-proj" ? "active" : ""}`}
          onClick={() => {
            setActiveTool("uv-proj");
            const res = uvOrganizerStore.arrangeAssignedUVs();
            onShowToast?.(`Canonical UV Projection applied (${res.packedCount} islands packed)`);
          }}
          title="Canonical UV Auto-Projection & Unwrap"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M8 8v5a2 2 0 0 0 4 0V8" />
            <path d="M14 8l2 7 2-7" />
          </svg>
        </button>

        <button
          className={`tool-btn ${activeTool === "normals" ? "active" : ""}`}
          onClick={() => {
            setActiveTool("normals");
            const count = modelStore.recomputeNormals?.();
            onShowToast?.(`Recomputed vertex normals across ${count} panels`);
          }}
          title="Recompute Surface Normals & Tangents"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="4" y="4" width="16" height="16" rx="3" />
            <circle cx="12" cy="12" r="4" />
          </svg>
        </button>

        <button
          className={`tool-btn ${activeTool === "hierarchy" ? "active" : ""}`}
          onClick={() => {
            setActiveTool("hierarchy");
            setIsTreeCollapsed(!isTreeCollapsed);
            onShowToast?.(isTreeCollapsed ? "Expanded Scene Graph" : "Collapsed Scene Graph");
          }}
          title="Toggle Hierarchy Tree"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
          </svg>
        </button>
      </aside>

      {/* 2B. Left Panel: Scene Explorer & Transform */}
      <aside className="panel scene-explorer-panel">
        {/* Scene Explorer Top Half */}
        <div className="scene-explorer-top">
          {/* Header Row with Model Curated Prev/Next */}
          <div className="panel-header-row">
            <span className="panel-title">Scene Explorer</span>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
                <button
                  className="tool-btn tool-btn-sm"
                  onClick={() => modelStore.loadPrevCuratedModel(uvOrganizerStore)}
                  title="Previous Curated Model"
                  disabled={modelStore.isLoadingCuratedModel}
                >
                  ‹
                </button>
                <span style={{ fontSize: "10px", fontFamily: "'JetBrains Mono', monospace", color: "var(--cyan-primary)" }}>
                  {modelStore.currentCuratedIndex >= 0 ? modelStore.currentCuratedIndex + 1 : 1}/{modelStore.filteredCuratedList.length || 40}
                </span>
                <button
                  className="tool-btn tool-btn-sm"
                  onClick={() => modelStore.loadNextCuratedModel(uvOrganizerStore)}
                  title="Next Curated Model"
                  disabled={modelStore.isLoadingCuratedModel}
                >
                  ›
                </button>
              </div>
              <svg
                className="panel-collapse-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                onClick={() => setIsTreeCollapsed(!isTreeCollapsed)}
              >
                <polyline points={isTreeCollapsed ? "6 9 12 15 18 9" : "18 15 12 9 6 15"} />
              </svg>
            </div>
          </div>

          {/* Search Objects Input */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
            <div className="search-input-box">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" style={{ marginRight: "6px", flexShrink: 0 }}>
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search objects..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
              />
            </div>
            <button
              className="tool-btn"
              title="Filter"
              style={{ background: "#0a0e17", border: "1px solid #1d2538", borderRadius: "6px" }}
              onClick={() => modelStore.toggleAllPiecesVisibility()}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
            </button>
          </div>

          {/* Tree Hierarchy List */}
          {!isTreeCollapsed && (
            <div className="tree-hierarchy-list" id="sceneTree">
              {/* Scene Root */}
              <div
                className={`tree-row ${!modelStore.selectedPiece ? "selected" : ""}`}
                onClick={() => {
                  modelStore.selectPiece(null);
                  onShowToast?.("Selected: Scene Root");
                }}
              >
                <div className="tree-row-left">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                  <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" fill="rgba(148, 163, 184, 0.2)"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
                  <span style={{ color: "#f1f5f9", fontWeight: 500 }}>Scene</span>
                </div>
              </div>

              {/* Environment */}
              <div className="tree-row" style={{ paddingLeft: "16px" }}>
                <div className="tree-row-left">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
                  <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" fill="rgba(148, 163, 184, 0.2)"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
                  <span>Environment</span>
                </div>
                <div className="tree-row-actions">
                  <span
                    title="Toggle Environment Lighting"
                    style={{ display: "inline-flex", cursor: "pointer" }}
                    onClick={() => {
                      modelStore.toggleEnvironmentVisibility?.();
                      onShowToast?.(modelStore.environmentVisible ? "Environment IBL: Visible" : "Environment IBL: Hidden");
                    }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={modelStore.environmentVisible ? "currentColor" : "#ef4444"}
                      strokeWidth="1.8"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                    </svg>
                  </span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                </div>
              </div>

              {/* Model_GRP */}
              <div className="tree-row" style={{ paddingLeft: "16px" }}>
                <div className="tree-row-left">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2"><polyline points="6 9 12 15 18 9" /></svg>
                  <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" fill="rgba(203, 213, 225, 0.2)"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" /></svg>
                  <span style={{ color: "#e2e8f0", fontWeight: 500 }}>
                    {modelStore.modelMeta.title || "Model_GRP"}
                  </span>
                </div>
                <div className="tree-row-actions">
                  <span
                    title="Toggle Garment Visibility"
                    style={{ display: "inline-flex", cursor: "pointer" }}
                    onClick={() => {
                      modelStore.toggleAllPiecesVisibility?.();
                      onShowToast?.("Toggled all garment pieces");
                    }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                    </svg>
                  </span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                </div>
              </div>

              {/* Garment Mesh Pieces */}
              {filteredPieces.map((piece) => {
                const isSelected = modelStore.selectedPiece?.id === piece.id;
                const isVisible = piece.visible !== false;

                return (
                  <div
                    key={piece.id}
                    className={`tree-row ${isSelected ? "selected" : ""}`}
                    style={{ paddingLeft: "28px" }}
                    onClick={() => {
                      modelStore.selectPiece(piece.mesh);
                      onShowToast?.(`Selected: ${piece.name}`);
                    }}
                  >
                    <div className="tree-row-left">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={isSelected ? "#22d3ee" : "#64748b"} strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={isSelected ? "#22d3ee" : "currentColor"}
                        strokeWidth="2"
                      >
                        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                      </svg>
                      <span style={{ fontWeight: isSelected ? 500 : 400, overflow: "hidden", textOverflow: "ellipsis" }}>
                        {piece.name}
                      </span>
                    </div>
                    <div className="tree-row-actions">
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={isVisible ? "currentColor" : "#ef4444"}
                        strokeWidth="1.8"
                        style={{ cursor: "pointer" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          modelStore.togglePieceVisibility(piece.id);
                        }}
                      >
                        {isVisible ? (
                          <>
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </>
                        ) : (
                          <>
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </>
                        )}
                      </svg>
                      <span
                        title={modelStore.isPieceLocked?.(piece.id) ? "Unlock piece" : "Lock piece from transform"}
                        style={{ display: "inline-flex", cursor: "pointer" }}
                        onClick={(e) => {
                          e.stopPropagation();
                          const locked = modelStore.togglePieceLock?.(piece.id);
                          onShowToast?.(locked ? `Locked ${piece.name}` : `Unlocked ${piece.name}`);
                        }}
                      >
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke={modelStore.isPieceLocked?.(piece.id) ? "#22d3ee" : "currentColor"}
                          strokeWidth="1.8"
                        >
                          <rect x="3" y="11" width="18" height="11" rx="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Lights */}
              <div className="tree-row" style={{ paddingLeft: "16px" }}>
                <div className="tree-row-left">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
                  <svg width="14" height="14" viewBox="0 0 24 24" stroke="#f59e0b" fill="#f59e0b" strokeWidth="1.5">
                    <path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z" />
                  </svg>
                  <span>Lights</span>
                </div>
                <div className="tree-row-actions">
                  <span
                    title="Toggle Directional Scene Lights"
                    style={{ display: "inline-flex", cursor: "pointer" }}
                    onClick={() => {
                      modelStore.toggleDirectionalLights?.();
                      onShowToast?.(modelStore.lightsVisible ? "Directional Lights: ON" : "Directional Lights: OFF");
                    }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={modelStore.lightsVisible ? "currentColor" : "#ef4444"}
                      strokeWidth="1.8"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                    </svg>
                  </span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                </div>
              </div>

              {/* Camera */}
              <div className="tree-row" style={{ paddingLeft: "16px" }}>
                <div className="tree-row-left">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
                  <svg width="14" height="14" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" fill="rgba(148, 163, 184, 0.3)">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" />
                  </svg>
                  <span>Camera</span>
                </div>
                <div className="tree-row-actions">
                  <span
                    title="Reset Camera Framing"
                    style={{ display: "inline-flex", cursor: "pointer" }}
                    onClick={() => {
                      modelStore.resetCamera?.();
                      onShowToast?.("Camera reset to default view");
                    }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                    >
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                    </svg>
                  </span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Transform Sub-Panel */}
        <div className="transform-subpanel">
          <div className="panel-header-row" style={{ marginBottom: "10px" }}>
            <span className="panel-title">Transform</span>
            <button
              onClick={resetTransform}
              title="Reset Transform"
              style={{ background: "transparent", border: "none", color: "#22d3ee", cursor: "pointer" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
                <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
                <path d="M16 16h5v5" />
              </svg>
            </button>
          </div>

          <div className="transform-rows">
            {/* Position */}
            <div className="transform-row">
              <span className="transform-label">Position</span>
              <div className="transform-inputs-grid">
                <div className="num-box"><span>X</span><input type="text" value={getTransformVal("pos", "x")} onChange={(e) => handleTransformChange("pos", "x", e.target.value)} /></div>
                <div className="num-box"><span>Y</span><input type="text" value={getTransformVal("pos", "y")} onChange={(e) => handleTransformChange("pos", "y", e.target.value)} /></div>
                <div className="num-box"><span>Z</span><input type="text" value={getTransformVal("pos", "z")} onChange={(e) => handleTransformChange("pos", "z", e.target.value)} /></div>
              </div>
            </div>

            {/* Rotation */}
            <div className="transform-row">
              <span className="transform-label">Rotation</span>
              <div className="transform-inputs-grid">
                <div className="num-box"><span>X</span><input type="text" value={getTransformVal("rot", "x")} onChange={(e) => handleTransformChange("rot", "x", e.target.value)} /></div>
                <div className="num-box"><span>Y</span><input type="text" value={getTransformVal("rot", "y")} onChange={(e) => handleTransformChange("rot", "y", e.target.value)} /></div>
                <div className="num-box"><span>Z</span><input type="text" value={getTransformVal("rot", "z")} onChange={(e) => handleTransformChange("rot", "z", e.target.value)} /></div>
              </div>
            </div>

            {/* Scale */}
            <div className="transform-row">
              <span className="transform-label">Scale</span>
              <div className="transform-inputs-grid">
                <div className="num-box"><span>X</span><input type="text" value={getTransformVal("scl", "x")} onChange={(e) => handleTransformChange("scl", "x", e.target.value)} /></div>
                <div className="num-box"><span>Y</span><input type="text" value={getTransformVal("scl", "y")} onChange={(e) => handleTransformChange("scl", "y", e.target.value)} /></div>
                <div className="num-box"><span>Z</span><input type="text" value={getTransformVal("scl", "z")} onChange={(e) => handleTransformChange("scl", "z", e.target.value)} /></div>
              </div>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
});
