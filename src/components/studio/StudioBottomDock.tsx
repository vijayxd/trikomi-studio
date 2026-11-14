import React, { useState } from "react";
import { observer } from "mobx-react-lite";
import { modelStore } from "@trikomi/core/studio";

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
  const [activeBottomTool, setActiveBottomTool] = useState<string>("materials");
  const [activeCat, setActiveCat] = useState<string>("all");
  const [matSearch, setMatSearch] = useState<string>("");
  const [activeSphereName, setActiveSphereName] = useState<string>("Metallic Blue");
  const [decimateVal, setDecimateVal] = useState<number>(72);
  const [isMaterialCollapsed, setIsMaterialCollapsed] = useState<boolean>(false);
  const [isDecimateCollapsed, setIsDecimateCollapsed] = useState<boolean>(false);

  // Decimation live stats calculation
  const baseTriangles = modelStore.modelMeta.triangles || 842730;
  const remainingRatio = (100 - decimateVal) / 100;
  const liveTriangles = Math.round(baseTriangles * remainingRatio);
  const liveVertices = Math.round(liveTriangles / 2);
  const liveFileSize = (12.4 * (1 - (decimateVal * 0.007))).toFixed(1);

  const getPerfLabel = () => {
    if (decimateVal >= 50) return "Excellent";
    if (decimateVal >= 25) return "Good";
    return "Heavy";
  };

  const handleApplySphere = (name: string, cat: string) => {
    setActiveSphereName(name);

    // Apply via Trikomi Core modelStore
    const matchingCurated = modelStore.curatedMaterialsList.find(m =>
      m.name.toLowerCase().includes(name.toLowerCase()) ||
      m.category?.toLowerCase() === cat.toLowerCase()
    );

    if (matchingCurated) {
      if (modelStore.selectedPiece) {
        modelStore.applyCuratedMaterialToPiece(modelStore.selectedPiece.mesh, matchingCurated);
      } else {
        modelStore.switchCuratedMaterial(matchingCurated.id);
      }
    }
    onShowToast?.(`Applied "${name}" shader to active garment`);
  };

  const spherePresets = [
    { name: "Metallic Blue", cat: "metal", sphereClass: "sphere-metallic-blue" },
    { name: "Carbon Fiber", cat: "carbon", sphereClass: "sphere-carbon" },
    { name: "Brushed Metal", cat: "metal", sphereClass: "sphere-brushed" },
    { name: "Leather", cat: "fabric", sphereClass: "sphere-leather" },
    { name: "Glossy Plastic", cat: "plastic", sphereClass: "sphere-plastic" },
    { name: "Matte Metal", cat: "metal", sphereClass: "sphere-matte" },
    { name: "Fabric Weave", cat: "fabric", sphereClass: "sphere-fabric" },
    { name: "Neon Glow", cat: "plastic", sphereClass: "sphere-neon" },
    { name: "Glass", cat: "glass", sphereClass: "sphere-glass" },
    { name: "Gold", cat: "metal", sphereClass: "sphere-gold" }
  ];

  const filteredSpheres = spherePresets.filter(s => {
    const matchesCat = activeCat === "all" || s.cat === activeCat;
    const matchesSearch = !matSearch || s.name.toLowerCase().includes(matSearch.toLowerCase());
    return matchesCat && matchesSearch;
  });

  if (collapsed) return null;

  return (
    <section className="bottom-workspace-section">
      {/* 3A. Bottom-Left Vertical Tool Strip */}
      <aside className="panel tool-strip-far-left">
        <button
          className={`tool-btn ${activeBottomTool === "shaders" ? "active" : ""}`}
          onClick={() => {
            setActiveBottomTool("shaders");
            onShowToast?.("Shader Presets tool");
          }}
          title="Shader Presets"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 0 0 0 18" />
          </svg>
        </button>

        <button
          className={`tool-btn ${activeBottomTool === "materials" ? "active" : ""}`}
          onClick={() => {
            setActiveBottomTool("materials");
            onShowToast?.("Material Library tool");
          }}
          title="Material Library"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </button>

        <button
          className={`tool-btn ${activeBottomTool === "textures" ? "active" : ""}`}
          onClick={() => {
            setActiveBottomTool("textures");
            onShowToast?.("Texture Maps tool");
          }}
          title="Texture Maps"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <circle cx="8.5" cy="8.5" r="1.5" />
            <polyline points="21 15 16 10 5 21" />
          </svg>
        </button>

        <button
          className={`tool-btn ${activeBottomTool === "decimate" ? "active" : ""}`}
          onClick={() => {
            setActiveBottomTool("decimate");
            onShowToast?.("Mesh Decimation tool");
          }}
          title="Mesh Decimation"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" /><line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
        </button>
      </aside>

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
              {activeBottomTool === "shaders" ? "PBR Shaders" : activeBottomTool === "textures" ? "Texture Maps" : "Material Library"}
            </span>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#38bdf8" }} />
          </div>
        ) : activeBottomTool === "textures" ? (
          <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 600, fontSize: "12.5px", color: "#f1f5f9" }}>
                Texture Channels & Maps ({modelStore.selectedPiece?.name || "Garment Mesh"})
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "10px", color: "#38bdf8", background: "rgba(56, 189, 248, 0.15)", padding: "2px 6px", borderRadius: "4px" }}>
                  Active Maps
                </span>
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

            <div style={{ display: "flex", gap: "10px", overflowX: "auto", flex: 1, alignItems: "center" }}>
              {/* Map 1: Base Color / Diffuse */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: "110px", background: "#0a0e17", padding: "6px", borderRadius: "6px", border: "1px solid #1e293b" }}>
                <span style={{ fontSize: "9.5px", color: "#94a3b8", fontWeight: "600" }}>Diffuse (Color)</span>
                <div style={{ width: "100%", height: "48px", background: "#1e293b", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", color: "#38bdf8" }}>
                  2048 × 2048
                </div>
                <span style={{ fontSize: "8.5px", color: "#10b981" }}>RGB 8-bit</span>
              </div>

              {/* Map 2: Normal (Bump) */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: "110px", background: "#0a0e17", padding: "6px", borderRadius: "6px", border: "1px solid #1e293b" }}>
                <span style={{ fontSize: "9.5px", color: "#94a3b8", fontWeight: "600" }}>Normal (Tangent)</span>
                <div style={{ width: "100%", height: "48px", background: "linear-gradient(135deg, #7c3aed 0%, #38bdf8 100%)", opacity: 0.8, borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", color: "#fff", fontWeight: "600" }}>
                  Tangent Space
                </div>
                <span style={{ fontSize: "8.5px", color: "#38bdf8" }}>OpenGL Normals</span>
              </div>

              {/* Map 3: Roughness / Gloss */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: "110px", background: "#0a0e17", padding: "6px", borderRadius: "6px", border: "1px solid #1e293b" }}>
                <span style={{ fontSize: "9.5px", color: "#94a3b8", fontWeight: "600" }}>Roughness</span>
                <div style={{ width: "100%", height: "48px", background: "#334155", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", color: "#cbd5e1" }}>
                  Rough: 0.82
                </div>
                <span style={{ fontSize: "8.5px", color: "#94a3b8" }}>Grayscale G-channel</span>
              </div>

              {/* Map 4: Ambient Occlusion */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: "110px", background: "#0a0e17", padding: "6px", borderRadius: "6px", border: "1px solid #1e293b" }}>
                <span style={{ fontSize: "9.5px", color: "#94a3b8", fontWeight: "600" }}>Occlusion (AO)</span>
                <div style={{ width: "100%", height: "48px", background: "#0f172a", borderRadius: "4px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", color: "#64748b" }}>
                  Baked Seams
                </div>
                <span style={{ fontSize: "8.5px", color: "#94a3b8" }}>R-Channel AO</span>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Top Header & Search Row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: 1 }}>
                <span style={{ fontWeight: 600, fontSize: "12.5px", color: "#f1f5f9", flexShrink: 0 }}>
                  {activeBottomTool === "shaders" ? "PBR Shader Presets" : "Material Library"}
                </span>
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
            <div style={{ display: "flex", alignItems: "center", gap: "6px", margin: "4px 0" }}>
              <button
                className={`mat-cat-btn ${activeCat === "all" ? "active" : ""}`}
                onClick={() => setActiveCat("all")}
              >
                <span>All</span>
                {activeCat === "all" && <span style={{ width: "4px", height: "4px", borderRadius: "50%", background: "#67e8f9" }} />}
              </button>
              <button
                className={`mat-cat-btn ${activeCat === "metal" ? "active" : ""}`}
                onClick={() => setActiveCat("metal")}
              >
                Metals
              </button>
              <button
                className={`mat-cat-btn ${activeCat === "plastic" ? "active" : ""}`}
                onClick={() => setActiveCat("plastic")}
              >
                Plastics
              </button>
              <button
                className={`mat-cat-btn ${activeCat === "fabric" ? "active" : ""}`}
                onClick={() => setActiveCat("fabric")}
              >
                Fabric
              </button>
              <button
                className={`mat-cat-btn ${activeCat === "glass" ? "active" : ""}`}
                onClick={() => setActiveCat("glass")}
              >
                Glass
              </button>
              <button
                className={`mat-cat-btn ${activeCat === "carbon" ? "active" : ""}`}
                onClick={() => setActiveCat("carbon")}
              >
                Carbon
              </button>
            </div>

            {/* 10 Shader Spheres Row */}
            <div style={{ display: "flex", alignItems: "stretch", gap: "8px", overflowX: "auto", paddingBottom: "2px" }}>
              {filteredSpheres.map((s) => {
                const isActive = activeSphereName === s.name;
                return (
                  <div
                    key={s.name}
                    className={`mat-card ${isActive ? "active" : ""}`}
                    onClick={() => handleApplySphere(s.name, s.cat)}
                  >
                    <div className={`sphere ${s.sphereClass}`} />
                    <span style={{ fontSize: "10.5px", color: isActive ? "#ffffff" : "#cbd5e1", fontWeight: 500, whiteSpace: "nowrap" }}>
                      {s.name}
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
                      modelStore.decimateModel?.(decimateVal / 100);
                      onShowToast?.(`Mesh decimation (${decimateVal}% reduction) applied`);
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
                      modelStore.revertDecimation?.();
                      onShowToast?.("Reverted to 100% original geometry");
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
