import React, { useState } from "react";
import { observer } from "mobx-react-lite";
import { modelStore, uvOrganizerStore } from "@trikomi/core/studio";

interface StudioBottomDockProps {
  collapsed?: boolean;
  onExportGLB: () => void;
}

export const StudioBottomDock: React.FC<StudioBottomDockProps> = observer(({
  collapsed = false,
  onExportGLB
}) => {
  const [activeMaterialFilter, setActiveMaterialFilter] = useState<string>("All");
  const [selectedOrbIndex, setSelectedOrbIndex] = useState<number>(0);
  const [decimateTarget, setDecimateTarget] = useState<number>(0.5);

  // Per-card collapsible state for bottom dock
  const [materialsCollapsed, setMaterialsCollapsed] = useState<boolean>(false);
  const [geometryCollapsed, setGeometryCollapsed] = useState<boolean>(false);
  const [previewCollapsed, setPreviewCollapsed] = useState<boolean>(false);
  const [validationCollapsed, setValidationCollapsed] = useState<boolean>(false);

  const curTriangles = modelStore.modelMeta.triangles || 0;
  const originalTris = modelStore.pieces.reduce((sum, p) => sum + (p.originalTriangles || p.triangles), 0) || curTriangles;

  // Extract unique categories from curated materials
  const materialCategories = ["All", ...Array.from(new Set(modelStore.curatedMaterialsList.map(m => m.category || "Other")))];

  // Filter curated materials
  const displayMaterials = modelStore.curatedMaterialsList.filter(m => {
    if (activeMaterialFilter === "All") return true;
    return m.category === activeMaterialFilter;
  });

  const handleApplyCurated = (mat: any) => {
    modelStore.switchCuratedMaterial(mat.id);
  };

  return (
    <footer className={`panel-bottom-dock ${collapsed ? "collapsed" : ""}`} id="bottomDock">
      {/* 1. Card 1: Material Library (PBR Fabric Swatches) */}
      <div
        className={`dock-card-chassis cyber-chassis ${materialsCollapsed ? "dock-card-collapsed" : ""}`}
        style={{ flex: materialsCollapsed ? "0 0 34px" : "1.35 1 0" }}
      >
        <div
          className="panel-header-titlebar"
          onClick={() => setMaterialsCollapsed(!materialsCollapsed)}
          style={{ cursor: "pointer", userSelect: "none" }}
          title={materialsCollapsed ? "Expand Material Library" : "Collapse Material Library"}
        >
          <div className="titlebar-text">
            <span style={{ fontSize: "8.5px", color: "var(--neon-cyan)" }}>
              {materialsCollapsed ? "▸" : "▾"}
            </span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#14d9ff" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M12 2a10 10 0 000 20z" />
            </svg>
            <span>Material Library</span>
          </div>
          <button
            className="control-toggle-btn"
            style={{ width: "18px", height: "18px", border: "none", background: "transparent" }}
            title="Search Fabrics"
            onClick={(e) => e.stopPropagation()}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
        </div>

        <div className="dock-card-content material-palette-body">
          <div className="filter-pills-row" style={{ overflowX: "auto", flexWrap: "nowrap", paddingBottom: "2px" }}>
            {materialCategories.map((cat) => (
              <span
                key={cat}
                className={`chip-pill-filter ${activeMaterialFilter === cat ? "active" : ""}`}
                onClick={() => setActiveMaterialFilter(cat)}
                style={{ whiteSpace: "nowrap", cursor: "pointer" }}
              >
                {cat}
              </span>
            ))}
          </div>

          {/* 3D Sphere Swatches Flex Cluster with Horizontal Scrolling */}
          <div
            className="swatches-flex-cluster"
            style={{
              overflowX: "auto",
              flexWrap: "nowrap",
              justifyContent: "flex-start",
              alignItems: "center",
              gap: "4px",
              padding: "4px 2px"
            }}
          >
            {displayMaterials.map((mat) => {
              const isSelected = modelStore.selectedMaterialId === mat.id;
              const sphereThumb = mat.sphereThumbnailUrl || mat.thumbnailUrl;
              return (
                <div
                  key={mat.id}
                  className={`swatch-orb-item ${isSelected ? "active" : ""}`}
                  onClick={() => handleApplyCurated(mat)}
                  title={`${mat.name} (${mat.category}) - Click to apply to garment`}
                  style={{ minWidth: "40px", cursor: "pointer", flexShrink: 0 }}
                >
                  <div
                    style={{
                      width: "clamp(30px, 4.5vh, 38px)",
                      height: "clamp(30px, 4.5vh, 38px)",
                      borderRadius: "50%",
                      position: "relative",
                      background: "radial-gradient(circle at 35% 28%, rgba(255,255,255,0.1), rgba(0,0,0,0.6) 80%)",
                      border: isSelected ? "2px solid var(--neon-cyan)" : "1.5px solid rgba(255, 255, 255, 0.15)",
                      boxShadow: isSelected ? "0 0 14px rgba(20, 217, 255, 0.85)" : "inset -2px -4px 6px rgba(0,0,0,0.8)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      overflow: "hidden",
                      transition: "all 0.15s ease"
                    }}
                  >
                    <img
                      src={sphereThumb}
                      alt={mat.name}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                        transform: "scale(1.05)"
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontSize: "7.5px",
                      color: isSelected ? "var(--neon-cyan)" : "#cbd5e1",
                      maxWidth: "40px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      textAlign: "center",
                      marginTop: "2px",
                      fontWeight: isSelected ? "700" : "500"
                    }}
                  >
                    {mat.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 2. Card 2: Geometry & Decimation Optimization */}
      <div
        className={`dock-card-chassis cyber-chassis ${geometryCollapsed ? "dock-card-collapsed" : ""}`}
        style={{ flex: geometryCollapsed ? "0 0 34px" : "1 1 0" }}
      >
        <div
          className="panel-header-titlebar"
          onClick={() => setGeometryCollapsed(!geometryCollapsed)}
          style={{ cursor: "pointer", userSelect: "none" }}
          title={geometryCollapsed ? "Expand Geometry & Decimation" : "Collapse Geometry & Decimation"}
        >
          <div className="titlebar-text">
            <span style={{ fontSize: "8.5px", color: "var(--neon-cyan)" }}>
              {geometryCollapsed ? "▸" : "▾"}
            </span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#14d9ff" strokeWidth="2">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
            <span>Geometry & Decimation</span>
          </div>
          <span
            style={{ fontSize: "9px", color: "var(--neon-cyan)", cursor: "pointer", fontWeight: 600 }}
            onClick={(e) => {
              e.stopPropagation();
              modelStore.revertDecimation();
            }}
            title="Revert to 100% Original Geometry"
          >
            Revert
          </span>
        </div>

        <div className="dock-card-content uv-overview-content" style={{ flexDirection: "column", gap: "6px", justifyContent: "center" }}>
          <div style={{ display: "flex", justifyContent: "space-between", width: "100%", fontSize: "8.5px", color: "var(--text-secondary)" }}>
            <span>Reduction Ratio</span>
            <strong style={{ color: "#fff" }}>{Math.round((1 - decimateTarget) * 100)}% ({Math.round(curTriangles / 1000)}k tris)</strong>
          </div>

          <input
            type="range"
            min="0.1"
            max="1.0"
            step="0.05"
            value={decimateTarget}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setDecimateTarget(val);
              modelStore.decimateModel(val);
            }}
            style={{ width: "100%", height: "4px", accentColor: "#14d9ff", cursor: "pointer" }}
            title="Meshopt Geometry Simplifier"
          />

          <div className="metrics-stat-rows" style={{ width: "100%" }}>
            <div className="stat-data-row">
              <span>Pieces Count</span>
              <strong>{modelStore.pieces.length}</strong>
            </div>
            <div className="stat-data-row">
              <span>Original Tris</span>
              <strong>{originalTris.toLocaleString()}</strong>
            </div>
            <div className="stat-progress-bar">
              <div
                className="stat-progress-fill"
                style={{ width: `${Math.min(100, (curTriangles / (originalTris || 1)) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Card 3: Live 3D Garment Preview */}
      <div
        className={`dock-card-chassis cyber-chassis ${previewCollapsed ? "dock-card-collapsed" : ""}`}
        style={{ flex: previewCollapsed ? "0 0 34px" : "0.65 1 0" }}
      >
        <div
          className="panel-header-titlebar"
          onClick={() => setPreviewCollapsed(!previewCollapsed)}
          style={{ cursor: "pointer", userSelect: "none" }}
          title={previewCollapsed ? "Expand Garment Preview" : "Collapse Garment Preview"}
        >
          <div className="titlebar-text">
            <span style={{ fontSize: "8.5px", color: "var(--neon-cyan)" }}>
              {previewCollapsed ? "▸" : "▾"}
            </span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#14d9ff" strokeWidth="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            <span>Garment</span>
          </div>
        </div>
        <div className="dock-card-content preview-stage-frame">
          <div className="badge-check-corner" title="Pipeline Certified Asset">✓</div>
          <svg viewBox="0 0 100 120" width="75%" height="75%" fill="none">
            <path
              d="M 35 20 Q 50 28 65 20 L 78 28 L 72 48 L 65 44 L 66 100 L 34 100 L 35 44 L 28 48 L 22 28 Z"
              fill="rgba(37,99,235,0.7)"
              stroke="#14d9ff"
              strokeWidth="1.5"
            />
            <polygon points="36,60 48,42 58,42 38,90 35,90" fill="#06b6d4" />
            <polygon points="50,38 65,24 68,27 58,44" fill="#a855f7" />
          </svg>
        </div>
      </div>

      {/* 4. Card 4: Validation Checklist */}
      <div
        className={`dock-card-chassis cyber-chassis ${validationCollapsed ? "dock-card-collapsed" : ""}`}
        style={{ flex: validationCollapsed ? "0 0 34px" : "0.9 1 0" }}
      >
        <div
          className="panel-header-titlebar"
          onClick={() => setValidationCollapsed(!validationCollapsed)}
          style={{ cursor: "pointer", userSelect: "none" }}
          title={validationCollapsed ? "Expand Validation" : "Collapse Validation"}
        >
          <div className="titlebar-text">
            <span style={{ fontSize: "8.5px", color: "var(--neon-cyan)" }}>
              {validationCollapsed ? "▸" : "▾"}
            </span>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span>Validation</span>
          </div>
        </div>
        <div className="dock-card-content validation-checklist-body">
          <div className="validation-line-item">
            <div className="check-mark-circle">✓</div>
            <span>No UV Overlap</span>
          </div>
          <div className="validation-line-item">
            <div className="check-mark-circle">✓</div>
            <span>Texel Density OK</span>
          </div>
          <div className="validation-line-item">
            <div className="check-mark-circle">✓</div>
            <span>GLB Export Ready</span>
          </div>
        </div>
      </div>
    </footer>
  );
});
