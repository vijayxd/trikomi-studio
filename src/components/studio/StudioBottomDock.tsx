import React, { useState } from "react";
import { observer } from "mobx-react-lite";
import { modelStore, uvOrganizerStore } from "@trikomi/core/studio";

interface StudioBottomDockProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onExportGLB: () => void;
  onShowToast?: (msg: string) => void;
}

export const StudioBottomDock: React.FC<StudioBottomDockProps> = observer(({
  collapsed = false,
  onToggleCollapse,
  onShowToast
}) => {
  const [activeBottomTool, setActiveBottomTool] = useState<"materials" | "textures">("materials");
  const [activeCat, setActiveCat] = useState<string>("all");
  const [matSearch, setMatSearch] = useState<string>("");
  const [onlyActiveMaps, setOnlyActiveMaps] = useState<boolean>(false);
  const [decimateVal, setDecimateVal] = useState<number>(72);
  const [decimateScope, setDecimateScope] = useState<"all" | "selected">("all");
  const [isMaterialCollapsed, setIsMaterialCollapsed] = useState<boolean>(false);
  const [isDecimateCollapsed, setIsDecimateCollapsed] = useState<boolean>(false);

  // Decimation target piece resolution
  const activeSelectedIds = modelStore.selectedPieceIds.length > 0
    ? modelStore.selectedPieceIds
    : (modelStore.selectedPiece ? [modelStore.selectedPiece.id] : []);
  const hasSelectedPiece = activeSelectedIds.length > 0;
  const isSelectedScope = decimateScope === "selected" && hasSelectedPiece;

  const targetPieces = isSelectedScope
    ? modelStore.pieces.filter(p => activeSelectedIds.includes(p.id))
    : modelStore.pieces;

  // Decimation live stats calculation
  const baseTriangles = (targetPieces.length > 0
    ? targetPieces.reduce((sum, p) => sum + (p.originalTriangles || p.triangles), 0)
    : modelStore.modelMeta.triangles) || 842730;

  const remainingRatio = (100 - decimateVal) / 100;
  const liveTriangles = Math.round(baseTriangles * remainingRatio);
  const liveVertices = Math.round(liveTriangles / 2);
  const liveFileSize = (12.4 * (1 - (decimateVal * 0.007))).toFixed(1);

  const getPerfLabel = () => {
    if (decimateVal >= 50) return "Excellent";
    if (decimateVal >= 25) return "Good";
    return "Heavy";
  };

  const renderSegmentedTabs = () => (
    <div style={{ display: "flex", background: "#0a0e17", padding: "2px", borderRadius: "6px", border: "1px solid #1e293b" }}>
      <button
        className={`mat-cat-btn ${activeBottomTool === "materials" ? "active" : ""}`}
        style={{ borderRadius: "4px", padding: "3px 10px", fontSize: "11px" }}
        onClick={() => {
          setActiveBottomTool("materials");
          onShowToast?.("Material Library view");
        }}
      >
        Materials
      </button>
      <button
        className={`mat-cat-btn ${activeBottomTool === "textures" ? "active" : ""}`}
        style={{ borderRadius: "4px", padding: "3px 10px", fontSize: "11px" }}
        onClick={() => {
          setActiveBottomTool("textures");
          onShowToast?.("Texture Maps view");
        }}
      >
        Texture Maps
      </button>
    </div>
  );

  const activeCuratedMat = modelStore.curatedMaterialsList.find(m => m.id === modelStore.selectedMaterialId) || modelStore.curatedMaterialsList[0];

  const handleApplyCuratedMat = (mat: any) => {
    if (modelStore.selectedPiece) {
      modelStore.applyCuratedMaterialToPiece(modelStore.selectedPiece.mesh, mat);
    } else {
      modelStore.switchCuratedMaterial(mat.id);
    }
    onShowToast?.(`Applied "${mat.name}" to garment`);
  };

  // Distinct categories from actual curated materials
  const availableCategories = [
    "all",
    ...Array.from(new Set(modelStore.curatedMaterialsList.map((m: any) => m.category).filter(Boolean)))
  ];

  const filteredCuratedMaterials = modelStore.curatedMaterialsList.filter((m: any) => {
    const matchesCat = activeCat === "all" || m.category === activeCat;
    const matchesSearch = !matSearch || m.name?.toLowerCase().includes(matSearch.toLowerCase()) || m.category?.toLowerCase().includes(matSearch.toLowerCase());
    return matchesCat && matchesSearch;
  });

  if (collapsed) return null;

  return (
    <section className="bottom-workspace-section">
      {/* 3B. Bottom-Center Panel: Material Library / Texture Channel Maps / Shaders */}
      <section className={`panel material-library-panel ${isMaterialCollapsed ? "collapsed" : ""}`}>
        {isMaterialCollapsed ? (
          <div
            style={{ display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "space-between", padding: "4px 0" }}
            onClick={() => setIsMaterialCollapsed(false)}
            title="Expand Material Library"
          >
            <button
              className="tool-btn tool-btn-sm"
              title="Expand Material Library"
              onClick={(e) => {
                e.stopPropagation();
                setIsMaterialCollapsed(false);
              }}
            >
              <svg className="panel-collapse-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
            <span className="panel-title-vertical">
              {activeBottomTool === "textures" ? "Texture Maps" : "Material Library"}
            </span>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#38bdf8" }} />
          </div>
        ) : activeBottomTool === "textures" ? (
          <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              {/* Left Side: Segmented Mode Tabs */}
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                {renderSegmentedTabs()}
                <span style={{ fontSize: "11px", color: "#64748b", marginLeft: "4px" }}>
                  ({modelStore.selectedPiece?.name || "Garment Mesh"})
                </span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  className="studio-btn-secondary"
                  style={{
                    padding: "2px 8px",
                    fontSize: "10px",
                    background: onlyActiveMaps ? "rgba(6, 182, 212, 0.2)" : "#0f172a",
                    border: onlyActiveMaps ? "1px solid #22d3ee" : "1px solid #1e293b",
                    color: onlyActiveMaps ? "#22d3ee" : "#94a3b8"
                  }}
                  onClick={() => setOnlyActiveMaps(!onlyActiveMaps)}
                  title="Toggle between showing all channels vs only loaded/active maps"
                >
                  <span>{onlyActiveMaps ? "Filter: Active Only" : "Show All Maps"}</span>
                </button>
                <button
                  className="tool-btn tool-btn-sm"
                  title="Collapse Material Library"
                  onClick={() => setIsMaterialCollapsed(true)}
                >
                  <svg className="panel-collapse-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
              </div>
            </div>

            <div style={{ display: "flex", gap: "10px", overflowX: "auto", flex: 1, alignItems: "flex-start", justifyContent: "flex-start" }}>
              {/* Map 1: Base Color / Diffuse */}
              {(!onlyActiveMaps || activeCuratedMat?.diffuseMapUrl) && (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: "120px", background: "#0a0e17", padding: "6px", borderRadius: "6px", border: "1px solid #1e293b", flexShrink: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "9.5px", color: "#94a3b8", fontWeight: "600" }}>Diffuse (Color)</span>
                    <span style={{ fontSize: "8px", color: activeCuratedMat?.diffuseMapUrl ? "#10b981" : "#64748b" }}>
                      {activeCuratedMat?.diffuseMapUrl ? "Active" : "None"}
                    </span>
                  </div>
                  {activeCuratedMat?.diffuseMapUrl ? (
                    <img
                      src={activeCuratedMat.diffuseMapUrl}
                      alt="diffuse"
                      style={{ width: "100%", height: "48px", objectFit: "cover", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.1)" }}
                    />
                  ) : (
                    <div style={{ width: "100%", height: "48px", background: "#1e293b", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", color: "#64748b" }}>
                      No Diffuse Map
                    </div>
                  )}
                  <span style={{ fontSize: "8px", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {activeCuratedMat?.name || "Active Garment"}
                  </span>
                </div>
              )}

              {/* Map 2: Normal (Bump) */}
              {(!onlyActiveMaps || activeCuratedMat?.normalMapUrl) && (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: "120px", background: "#0a0e17", padding: "6px", borderRadius: "6px", border: "1px solid #1e293b", flexShrink: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "9.5px", color: "#94a3b8", fontWeight: "600" }}>Normal (Tangent)</span>
                    <span style={{ fontSize: "8px", color: activeCuratedMat?.normalMapUrl ? "#00e5ff" : "#64748b" }}>
                      {activeCuratedMat?.normalMapUrl ? "Tangent" : "None"}
                    </span>
                  </div>
                  {activeCuratedMat?.normalMapUrl ? (
                    <img
                      src={activeCuratedMat.normalMapUrl}
                      alt="normal"
                      style={{ width: "100%", height: "48px", objectFit: "cover", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.1)" }}
                    />
                  ) : (
                    <div style={{ width: "100%", height: "48px", background: "#1e293b", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", color: "#64748b" }}>
                      No Normal Map
                    </div>
                  )}
                  <span style={{ fontSize: "8px", color: "#64748b" }}>
                    Scale: {activeCuratedMat?.normalStrength?.toFixed(2) ?? "1.00"}
                  </span>
                </div>
              )}

              {/* Map 3: Roughness / Gloss */}
              {(!onlyActiveMaps || activeCuratedMat?.maps?.glossiness) && (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: "120px", background: "#0a0e17", padding: "6px", borderRadius: "6px", border: "1px solid #1e293b", flexShrink: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "9.5px", color: "#94a3b8", fontWeight: "600" }}>Roughness</span>
                    <span style={{ fontSize: "8px", color: activeCuratedMat?.maps?.glossiness ? "#fbbf24" : "#64748b" }}>
                      {activeCuratedMat?.maps?.glossiness ? "Map Active" : `${((activeCuratedMat?.roughness ?? 0.65) * 100).toFixed(0)}%`}
                    </span>
                  </div>
                  {activeCuratedMat?.maps?.glossiness ? (
                    <img
                      src={activeCuratedMat.maps.glossiness}
                      alt="roughness"
                      style={{ width: "100%", height: "48px", objectFit: "cover", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.1)" }}
                    />
                  ) : (
                    <div style={{ width: "100%", height: "48px", background: "#1e293b", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", color: "#cbd5e1" }}>
                      Uniform Val: {activeCuratedMat?.roughness?.toFixed(2) ?? "0.65"}
                    </div>
                  )}
                  <span style={{ fontSize: "8px", color: "#64748b" }}>Micro-facet roughness</span>
                </div>
              )}

              {/* Map 4: Ambient Occlusion / Displacement */}
              {(!onlyActiveMaps || activeCuratedMat?.maps?.displacement) && (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: "120px", background: "#0a0e17", padding: "6px", borderRadius: "6px", border: "1px solid #1e293b", flexShrink: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "9.5px", color: "#94a3b8", fontWeight: "600" }}>Displacement / AO</span>
                    <span style={{ fontSize: "8px", color: activeCuratedMat?.maps?.displacement ? "#34d399" : "#64748b" }}>
                      {activeCuratedMat?.maps?.displacement ? "Active" : "Baked"}
                    </span>
                  </div>
                  {activeCuratedMat?.maps?.displacement ? (
                    <img
                      src={activeCuratedMat.maps.displacement}
                      alt="displacement"
                      style={{ width: "100%", height: "48px", objectFit: "cover", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.1)" }}
                    />
                  ) : (
                    <div style={{ width: "100%", height: "48px", background: "#0f172a", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", color: "#64748b" }}>
                      Standard AO
                    </div>
                  )}
                  <span style={{ fontSize: "8px", color: "#64748b" }}>Depth displacement</span>
                </div>
              )}

              {/* Map 5: Metalness Map (if present) */}
              {(!onlyActiveMaps || activeCuratedMat?.maps?.metalness) && (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: "120px", background: "#0a0e17", padding: "6px", borderRadius: "6px", border: "1px solid #1e293b", flexShrink: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "9.5px", color: "#94a3b8", fontWeight: "600" }}>Metalness</span>
                    <span style={{ fontSize: "8px", color: activeCuratedMat?.maps?.metalness ? "#a78bfa" : "#64748b" }}>
                      {activeCuratedMat?.maps?.metalness ? "Active" : "Dielectric"}
                    </span>
                  </div>
                  {activeCuratedMat?.maps?.metalness ? (
                    <img
                      src={activeCuratedMat.maps.metalness}
                      alt="metalness"
                      style={{ width: "100%", height: "48px", objectFit: "cover", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.1)" }}
                    />
                  ) : (
                    <div style={{ width: "100%", height: "48px", background: "#1e293b", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", color: "#64748b" }}>
                      Non-Metallic (0.0)
                    </div>
                  )}
                  <span style={{ fontSize: "8px", color: "#64748b" }}>Conductor reflection</span>
                </div>
              )}

              {/* Map 6: Alpha / Opacity Mask (if present) */}
              {(!onlyActiveMaps || activeCuratedMat?.maps?.alpha) && (
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: "120px", background: "#0a0e17", padding: "6px", borderRadius: "6px", border: "1px solid #1e293b", flexShrink: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: "9.5px", color: "#94a3b8", fontWeight: "600" }}>Alpha / Opacity</span>
                    <span style={{ fontSize: "8px", color: activeCuratedMat?.maps?.alpha ? "#38bdf8" : "#64748b" }}>
                      {activeCuratedMat?.maps?.alpha ? "Active" : "Opaque"}
                    </span>
                  </div>
                  {activeCuratedMat?.maps?.alpha ? (
                    <img
                      src={activeCuratedMat.maps.alpha}
                      alt="alpha"
                      style={{ width: "100%", height: "48px", objectFit: "cover", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.1)" }}
                    />
                  ) : (
                    <div style={{ width: "100%", height: "48px", background: "#1e293b", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", color: "#64748b" }}>
                      Fully Opaque
                    </div>
                  )}
                  <span style={{ fontSize: "8px", color: "#64748b" }}>Transparency cutout</span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            {/* Top Header & Search Row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
                {/* Segmented Mode Tabs */}
                {renderSegmentedTabs()}

                <div className="search-input-box" style={{ maxWidth: "260px" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" style={{ marginRight: "6px", flexShrink: 0 }}>
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search materials..."
                    value={matSearch}
                    onChange={(e) => setMatSearch(e.target.value)}
                  />
                </div>
              </div>
              <button
                className="tool-btn tool-btn-sm"
                title="Collapse Material Library"
                onClick={() => setIsMaterialCollapsed(true)}
              >
                <svg
                  className="panel-collapse-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>
            </div>

            {/* Category Filter Pills Row */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px", margin: "4px 0", overflowX: "auto" }}>
              {availableCategories.map((cat) => {
                const isActive = activeCat === cat;
                return (
                  <button
                    key={cat}
                    className={`mat-cat-btn ${isActive ? "active" : ""}`}
                    onClick={() => setActiveCat(cat)}
                    style={{ whiteSpace: "nowrap", textTransform: "capitalize" }}
                  >
                    <span>{cat}</span>
                    {isActive && <span style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#67e8f9" }} />}
                  </button>
                );
              })}
            </div>

            {/* Curated Fabric Material Cards Row */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "flex-start", gap: "8px", overflowX: "auto", paddingBottom: "4px" }}>
              {filteredCuratedMaterials.map((m: any) => {
                const isActive = modelStore.selectedMaterialId === m.id;
                const thumb = m.sphereThumbnailUrl || m.thumbnailUrl;
                return (
                  <div
                    key={m.id}
                    className={`mat-card ${isActive ? "active" : ""}`}
                    onClick={() => handleApplyCuratedMat(m)}
                    title={`${m.name} (${m.category})`}
                  >
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={m.name}
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "50%",
                          objectFit: "cover",
                          border: isActive ? "2px solid #00e5ff" : "1px solid rgba(255, 255, 255, 0.15)",
                          boxShadow: isActive ? "0 0 10px rgba(0, 229, 255, 0.4)" : "none"
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "50%",
                          background: "linear-gradient(135deg, #0284c7 0%, #0f172a 100%)",
                          border: isActive ? "2px solid #00e5ff" : "1px solid rgba(255, 255, 255, 0.15)"
                        }}
                      />
                    )}
                    <span style={{ fontSize: "10px", color: isActive ? "#ffffff" : "#cbd5e1", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "80px", marginTop: "4px" }}>
                      {m.name}
                    </span>
                    <span style={{ fontSize: "8px", color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "80px" }}>
                      {m.category}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* 3C. Bottom-Right Panel: Geometry & Decimation */}
      <aside className={`panel geometry-decimation-panel ${isDecimateCollapsed ? "collapsed" : ""}`}>
        {isDecimateCollapsed ? (
          <div
            style={{ display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "space-between", padding: "4px 0" }}
            onClick={() => setIsDecimateCollapsed(false)}
            title="Expand Geometry & Decimation"
          >
            <button
              className="tool-btn tool-btn-sm"
              title="Expand Geometry & Decimation"
              onClick={(e) => {
                e.stopPropagation();
                setIsDecimateCollapsed(false);
              }}
            >
              <svg className="panel-collapse-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <span className="panel-title-vertical">Decimation & Geometry</span>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#34d399" }} />
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 600, fontSize: "12.5px", color: "#f1f5f9" }}>
                Geometry & Decimation
              </span>
              <button
                className="tool-btn tool-btn-sm"
                title="Collapse Geometry & Decimation"
                onClick={() => setIsDecimateCollapsed(true)}
              >
                <svg
                  className="panel-collapse-icon"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>

            {/* Scope Selector: Overall vs Selected Piece */}
            <div style={{ display: "flex", gap: "4px", background: "#0a0e17", padding: "2px", borderRadius: "6px", border: "1px solid #1e293b", marginTop: "6px" }}>
              <button
                className={`mat-cat-btn ${decimateScope === "all" ? "active" : ""}`}
                style={{ flex: 1, borderRadius: "4px", padding: "2px 8px", fontSize: "10.5px", textAlign: "center" }}
                onClick={() => setDecimateScope("all")}
              >
                Overall
              </button>
              <button
                className={`mat-cat-btn ${decimateScope === "selected" ? "active" : ""}`}
                style={{
                  flex: 1,
                  borderRadius: "4px",
                  padding: "2px 8px",
                  fontSize: "10.5px",
                  textAlign: "center",
                  opacity: hasSelectedPiece ? 1 : 0.5
                }}
                onClick={() => {
                  if (hasSelectedPiece) {
                    setDecimateScope("selected");
                  } else {
                    onShowToast?.("Select a garment piece first");
                  }
                }}
                title={hasSelectedPiece ? `Target: ${modelStore.selectedPiece?.name || "Selected piece"}` : "Select a piece in 3D viewport or explorer first"}
              >
                {hasSelectedPiece ? `Selected (${activeSelectedIds.length})` : "Selected Piece"}
              </button>
            </div>

            {/* 2-Column Body */}
            <div className="stats-2col-layout">
              {/* Left Stats Column */}
              <div className="stats-col-left">
                <div className="stat-item-row">
                  <span className="stat-key">Triangles</span>
                  <span className="stat-val">{liveTriangles.toLocaleString()}</span>
                </div>
                <div className="stat-item-row">
                  <span className="stat-key">Vertices</span>
                  <span className="stat-val">{liveVertices.toLocaleString()}</span>
                </div>
                <div className="stat-item-row">
                  <span className="stat-key">Reduction</span>
                  <span className="stat-val" style={{ color: "#34d399", fontWeight: 600 }}>{decimateVal}%</span>
                </div>

                <div className="stat-divider" />

                <div className="stat-item-row">
                  <span className="stat-key">File Size</span>
                  <span className="stat-val">{liveFileSize} MB</span>
                </div>
                <div className="stat-item-row">
                  <span className="stat-key">Est. Perf.</span>
                  <span className="stat-perf-tag">
                    <span className="stat-perf-indicator" />
                    <span>{getPerfLabel()}</span>
                  </span>
                </div>
              </div>

              {/* Right Slider + Apply Button Column */}
              <div className="stats-col-right">
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "8px" }}>
                  <input
                    type="range"
                    min="5"
                    max="95"
                    value={decimateVal}
                    className="cyber-slider"
                    onChange={(e) => setDecimateVal(parseInt(e.target.value, 10))}
                  />
                  <div
                    style={{
                      padding: "4px 8px",
                      borderRadius: "4px",
                      background: "#0a0e17",
                      border: "1px solid #222d42",
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: "11px",
                      color: "#e2e8f0",
                      minWidth: "42px",
                      textAlign: "center"
                    }}
                  >
                    {decimateVal}%
                  </div>
                </div>

                <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
                  <button
                    className="btn-decimation-apply"
                    style={{ flex: 1 }}
                    onClick={() => {
                      const remainingRatio = Math.max(0.05, Math.min(1.0, (100 - decimateVal) / 100));
                      const targetIds = isSelectedScope ? activeSelectedIds : undefined;
                      modelStore.decimateModel?.(remainingRatio, uvOrganizerStore, targetIds);
                      onShowToast?.(
                        isSelectedScope
                          ? `Decimated selected piece (${decimateVal}% reduction)`
                          : `Overall mesh decimation (${decimateVal}% reduction) applied`
                      );
                    }}
                  >
                    Apply
                  </button>
                  <button
                    className="tool-btn"
                    style={{ padding: "6px 12px", borderRadius: "6px", fontSize: "11px", color: "#94a3b8" }}
                    title="Revert to Original Geometry"
                    onClick={() => {
                      setDecimateVal(0);
                      const targetIds = isSelectedScope ? activeSelectedIds : undefined;
                      modelStore.revertDecimation?.(uvOrganizerStore, targetIds);
                      onShowToast?.(
                        isSelectedScope
                          ? "Reverted selected piece to original geometry"
                          : "Reverted overall model to 100% original geometry"
                      );
                    }}
                  >
                    Reset
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </aside>
    </section>
  );
});
