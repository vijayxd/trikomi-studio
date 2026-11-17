import React, { useState } from "react";
import { observer } from "mobx-react-lite";
import { modelStore, uvOrganizerStore, getFabricAssetUrl } from "@trikomi/core/studio";

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
  const [activeBottomTool, setActiveBottomTool] = useState<"materials" | "textures" | "active">("materials");
  const [activeCat, setActiveCat] = useState<string>("all");
  const [matSearch, setMatSearch] = useState<string>("");
  const [onlyActiveMaps, setOnlyActiveMaps] = useState<boolean>(false);
  const [decimateVal, setDecimateVal] = useState<number>(72);
  const [decimateScope, setDecimateScope] = useState<"all" | "selected">("all");
  const [isMaterialCollapsed, setIsMaterialCollapsed] = useState<boolean>(false);
  const [isDecimateCollapsed, setIsDecimateCollapsed] = useState<boolean>(false);
  const [isTileLocked, setIsTileLocked] = useState<boolean>(true);

  // Hidden upload ref for active piece texture maps
  const pieceFileInputRef = React.useRef<HTMLInputElement | null>(null);
  const [uploadTargetChannel, setUploadTargetChannel] = useState<"diffuse" | "normal" | "roughness" | "metalness" | "alpha" | "ao" | null>(null);
  const [activeTilingChannel, setActiveTilingChannel] = useState<"diffuse" | "normal" | "roughness" | "metalness" | "alpha" | "ao">("diffuse");

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
    <div style={{ display: "flex", background: "#0a0e17", padding: "2px", borderRadius: "6px", border: "1px solid #1e293b", gap: "2px" }}>
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
      <button
        className={`mat-cat-btn ${activeBottomTool === "active" ? "active" : ""}`}
        style={{ borderRadius: "4px", padding: "3px 10px", fontSize: "11px", position: "relative" }}
        onClick={() => {
          setActiveBottomTool("active");
          onShowToast?.("Active Piece Material inspector");
        }}
      >
        <span>Active Material</span>
        {modelStore.selectedPiece && (
          <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: "#00e5ff", display: "inline-block", marginLeft: "4px" }} />
        )}
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

  void (modelStore as any).materialVersion;

  const selectedPiece = modelStore.selectedPiece;
  const activePieceMat = selectedPiece?.material as any;
  const pieceDiffuseMap = activePieceMat?.map;
  const pieceNormalMap = activePieceMat?.normalMap;
  const pieceRoughnessMap = activePieceMat?.roughnessMap;
  const pieceMetalnessMap = activePieceMat?.metalnessMap;
  const pieceAlphaMap = activePieceMat?.alphaMap;
  const pieceAoMap = activePieceMat?.aoMap;

  const channelMapRecord: Record<string, any> = {
    diffuse: pieceDiffuseMap,
    normal: pieceNormalMap,
    roughness: pieceRoughnessMap,
    metalness: pieceMetalnessMap,
    alpha: pieceAlphaMap,
    ao: pieceAoMap
  };
  const activeTilingTexture = channelMapRecord[activeTilingChannel];
  const pieceRepeatX = activePieceMat?.userData?.repeatX 
    ?? activeTilingTexture?.repeat?.x 
    ?? activePieceMat?.map?.repeat?.x 
    ?? activePieceMat?.normalMap?.repeat?.x 
    ?? 1;
  const pieceRepeatY = activePieceMat?.userData?.repeatY 
    ?? activeTilingTexture?.repeat?.y 
    ?? activePieceMat?.map?.repeat?.y 
    ?? activePieceMat?.normalMap?.repeat?.y 
    ?? 1;
  const pieceNormalScale = activePieceMat?.normalScale?.x ?? 1.0;
  const pieceColorHex = activePieceMat?.color ? "#" + activePieceMat.color.getHexString() : "#ffffff";
  const pieceRoughness = activePieceMat?.roughness !== undefined ? activePieceMat.roughness : 0.8;
  const pieceMetalness = activePieceMat?.metalness !== undefined ? activePieceMat.metalness : 0.0;
  const pieceOpacity = activePieceMat?.opacity !== undefined ? activePieceMat.opacity : 1.0;

  const handlePieceFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && selectedPiece && uploadTargetChannel) {
      const url = URL.createObjectURL(file);
      modelStore.setPieceTextureMap(selectedPiece.id, uploadTargetChannel, url);
      onShowToast?.(`Updated ${uploadTargetChannel} texture on "${selectedPiece.name}"`);
      setUploadTargetChannel(null);
    }
  };

  return (
    <section className="bottom-workspace-section">
      {/* Hidden file input for texture map uploads on active piece */}
      <input
        ref={pieceFileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handlePieceFileUpload}
      />
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
              {activeBottomTool === "active" ? "Active Material" : activeBottomTool === "textures" ? "Texture Maps" : "Material Library"}
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
                      src={getFabricAssetUrl(activeCuratedMat.diffuseMapUrl)}
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
                      src={getFabricAssetUrl(activeCuratedMat.normalMapUrl)}
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
                      src={getFabricAssetUrl(activeCuratedMat.maps.glossiness)}
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
                      src={getFabricAssetUrl(activeCuratedMat.maps.displacement)}
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
                      src={getFabricAssetUrl(activeCuratedMat.maps.metalness)}
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
                      src={getFabricAssetUrl(activeCuratedMat.maps.alpha)}
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
        ) : activeBottomTool === "active" ? (
          /* Active Material Inspector View */
          <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {renderSegmentedTabs()}
                {selectedPiece ? (
                  <span style={{ fontSize: "11px", color: "#38bdf8", fontWeight: 500 }}>
                    Active Piece: {selectedPiece.name}
                  </span>
                ) : (
                  <span style={{ fontSize: "11px", color: "#64748b" }}>
                    (No piece selected — select a mesh piece in viewport or Scene Explorer)
                  </span>
                )}
              </div>
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

            {selectedPiece ? (
              <div style={{ display: "flex", gap: "16px", overflowX: "auto", flex: 1, alignItems: "stretch" }}>
                {/* Section 1: Names & Normals Control */}
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: "190px", background: "#0a0e17", padding: "8px", borderRadius: "6px", border: "1px solid #1e293b", flexShrink: 0 }}>
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    <label style={{ fontSize: "9px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Piece Name</label>
                    <input
                      type="text"
                      className="studio-input"
                      style={{ padding: "4px 6px", fontSize: "11px", background: "#0f172a", border: "1px solid #334155", color: "#f8fafc", borderRadius: "4px" }}
                      value={selectedPiece.name}
                      onChange={(e) => modelStore.updatePieceName(selectedPiece.id, e.target.value)}
                    />
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    <label style={{ fontSize: "9px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em" }}>Material Name</label>
                    <input
                      type="text"
                      className="studio-input"
                      style={{ padding: "4px 6px", fontSize: "11px", background: "#0f172a", border: "1px solid #334155", color: "#f8fafc", borderRadius: "4px" }}
                      value={activePieceMat?.name || "PieceMaterial"}
                      onChange={(e) => modelStore.updatePieceMaterialName(selectedPiece.id, e.target.value)}
                    />
                  </div>

                  <div style={{ display: "flex", gap: "6px", marginTop: "auto" }}>
                    <button
                      className="studio-btn-secondary"
                      style={{
                        flex: 1,
                        padding: "5px 6px",
                        fontSize: "10.5px",
                        background: "rgba(14, 165, 233, 0.15)",
                        border: "1px solid rgba(14, 165, 233, 0.4)",
                        color: "#38bdf8",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "4px"
                      }}
                      title="Flip surface vertex normals and winding order if mesh appears inside-out"
                      onClick={() => {
                        modelStore.flipPieceNormals(selectedPiece.id);
                        onShowToast?.(`Flipped normals for "${selectedPiece.name}"`);
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="17 1 21 5 17 9" />
                        <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                        <polyline points="7 23 3 19 7 15" />
                        <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                      </svg>
                      <span>Flip Normals</span>
                    </button>

                    <button
                      className="studio-btn-secondary"
                      style={{
                        flex: 1,
                        padding: "5px 6px",
                        fontSize: "10.5px",
                        background: (modelStore as any).isPieceDoubleSide?.(selectedPiece.id)
                          ? "rgba(168, 85, 247, 0.2)"
                          : "#0f172a",
                        border: (modelStore as any).isPieceDoubleSide?.(selectedPiece.id)
                          ? "1px solid #a855f7"
                          : "1px solid #334155",
                        color: (modelStore as any).isPieceDoubleSide?.(selectedPiece.id)
                          ? "#c084fc"
                          : "#94a3b8",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "4px"
                      }}
                      title="Toggle Double-Sided rendering (disables backface culling)"
                      onClick={() => {
                        const nowDouble = (modelStore as any).togglePieceDoubleSide?.(selectedPiece.id);
                        onShowToast?.(`Double-side: ${nowDouble ? "ON" : "OFF"} for "${selectedPiece.name}"`);
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 3v18" />
                        <path d="M3 9l9-6 9 6" />
                        <path d="M3 15l9 6 9-6" />
                      </svg>
                      <span>Double Side</span>
                    </button>

                    <button
                      className="studio-btn-secondary"
                      style={{
                        padding: "5px 8px",
                        fontSize: "10.5px",
                        background: "#0f172a",
                        border: "1px solid #334155",
                        color: "#94a3b8",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                      }}
                      title="Center pivot of this piece to its centroid"
                      onClick={() => {
                        modelStore.centerPiecePivot(selectedPiece.id);
                        onShowToast?.(`Centered pivot for "${selectedPiece.name}"`);
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="12" cy="12" r="10" />
                        <circle cx="12" cy="12" r="3" />
                        <line x1="12" y1="2" x2="12" y2="6" />
                        <line x1="12" y1="18" x2="12" y2="22" />
                        <line x1="2" y1="12" x2="6" y2="12" />
                        <line x1="18" y1="12" x2="22" y2="12" />
                      </svg>
                    </button>
                  </div>
                </div>

                {/* Section 1.5: Core PBR Material Properties (Color, Roughness, Metalness, Opacity) */}
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: "205px", background: "#0a0e17", padding: "8px", borderRadius: "6px", border: "1px solid #1e293b", flexShrink: 0 }}>
                  <span style={{ fontSize: "9.5px", color: "#38bdf8", fontWeight: "700", letterSpacing: "0.03em" }}>
                    Core Properties
                  </span>

                  {/* Base Color Picker & Hex */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "9.5px", color: "#cbd5e1", width: "50px" }}>Color:</span>
                    <input
                      type="color"
                      value={pieceColorHex}
                      onChange={(e) => modelStore.setPieceColor(selectedPiece.id, e.target.value)}
                      style={{
                        width: "24px",
                        height: "22px",
                        padding: "0",
                        background: "none",
                        border: "1px solid #334155",
                        borderRadius: "4px",
                        cursor: "pointer"
                      }}
                      title="Choose base tint color"
                    />
                    <input
                      type="text"
                      value={pieceColorHex.toUpperCase()}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (/^#[0-9A-F]{6}$/i.test(val)) {
                          modelStore.setPieceColor(selectedPiece.id, val);
                        }
                      }}
                      style={{
                        width: "60px",
                        padding: "2px 4px",
                        fontSize: "10px",
                        background: "#0f172a",
                        border: "1px solid #334155",
                        color: "#f8fafc",
                        borderRadius: "3px",
                        textAlign: "center",
                        fontFamily: "monospace"
                      }}
                    />
                  </div>

                  {/* Roughness Slider */}
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "9.5px", color: "#cbd5e1", width: "50px" }}>Rough:</span>
                    <input
                      type="range"
                      min="0.0"
                      max="1.0"
                      step="0.01"
                      value={pieceRoughness}
                      onChange={(e) => modelStore.setPieceRoughness(selectedPiece.id, parseFloat(e.target.value))}
                      style={{ flex: 1 }}
                      title="Surface Roughness (0.0 = Glossy/Smooth, 1.0 = Matte/Rough)"
                    />
                    <span style={{ width: "28px", fontSize: "10px", color: "#94a3b8", textAlign: "right" }}>
                      {pieceRoughness.toFixed(2)}
                    </span>
                  </div>

                  {/* Metalness Slider */}
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "9.5px", color: "#cbd5e1", width: "50px" }}>Metal:</span>
                    <input
                      type="range"
                      min="0.0"
                      max="1.0"
                      step="0.01"
                      value={pieceMetalness}
                      onChange={(e) => modelStore.setPieceMetalness(selectedPiece.id, parseFloat(e.target.value))}
                      style={{ flex: 1 }}
                      title="Metallic Luster (0.0 = Dielectric Fabric, 1.0 = Metal/Chrome)"
                    />
                    <span style={{ width: "28px", fontSize: "10px", color: "#94a3b8", textAlign: "right" }}>
                      {pieceMetalness.toFixed(2)}
                    </span>
                  </div>

                  {/* Alpha / Opacity Slider */}
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "auto" }}>
                    <span style={{ fontSize: "9.5px", color: "#cbd5e1", width: "50px" }}>Alpha:</span>
                    <input
                      type="range"
                      min="0.0"
                      max="1.0"
                      step="0.01"
                      value={pieceOpacity}
                      onChange={(e) => modelStore.setPieceOpacity(selectedPiece.id, parseFloat(e.target.value))}
                      style={{ flex: 1 }}
                      title="Opacity / Transparency (1.0 = Fully Opaque, 0.0 = Transparent)"
                    />
                    <span style={{ width: "28px", fontSize: "10px", color: "#94a3b8", textAlign: "right" }}>
                      {pieceOpacity.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* Section 2: Texture Channels (Diffuse, Normal, Roughness, Metallic, Alpha, AO) */}
                <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                  {/* Diffuse Slot */}
                  <div
                    onClick={() => setActiveTilingChannel("diffuse")}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                      minWidth: "130px",
                      background: "#0a0e17",
                      padding: "8px",
                      borderRadius: "6px",
                      border: activeTilingChannel === "diffuse" ? "1.5px solid #00e5ff" : "1px solid #1e293b",
                      cursor: "pointer",
                      boxShadow: activeTilingChannel === "diffuse" ? "0 0 10px rgba(0, 229, 255, 0.2)" : "none"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "9.5px", color: activeTilingChannel === "diffuse" ? "#00e5ff" : "#94a3b8", fontWeight: "600" }}>
                        Diffuse {activeTilingChannel === "diffuse" ? "●" : ""}
                      </span>
                      <span style={{ fontSize: "8.5px", color: pieceDiffuseMap ? "#10b981" : "#64748b" }}>
                        {pieceDiffuseMap ? "Loaded" : "None"}
                      </span>
                    </div>

                    <div style={{ width: "100%", height: "46px", background: "#0f172a", borderRadius: "4px", overflow: "hidden", border: "1px solid #1e293b", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {pieceDiffuseMap?.image?.src ? (
                        <img
                          src={pieceDiffuseMap.image.src}
                          alt="diffuse map"
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        <span style={{ fontSize: "9px", color: "#64748b" }}>No Map</span>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: "4px", marginTop: "auto" }} onClick={(e) => e.stopPropagation()}>
                      <button
                        className="studio-btn-secondary"
                        style={{ flex: 1, padding: "3px 6px", fontSize: "9.5px", background: "#1e293b", color: "#e2e8f0" }}
                        onClick={() => {
                          setUploadTargetChannel("diffuse");
                          pieceFileInputRef.current?.click();
                        }}
                      >
                        Upload
                      </button>
                      {pieceDiffuseMap && (
                        <button
                          className="studio-btn-secondary"
                          style={{ padding: "3px 6px", fontSize: "9.5px", background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.4)", color: "#f87171" }}
                          title="Remove diffuse texture"
                          onClick={() => {
                            modelStore.removePieceTextureMap(selectedPiece.id, "diffuse");
                            onShowToast?.("Removed diffuse map");
                          }}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Normal Slot */}
                  <div
                    onClick={() => setActiveTilingChannel("normal")}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                      minWidth: "130px",
                      background: "#0a0e17",
                      padding: "8px",
                      borderRadius: "6px",
                      border: activeTilingChannel === "normal" ? "1.5px solid #00e5ff" : "1px solid #1e293b",
                      cursor: "pointer",
                      boxShadow: activeTilingChannel === "normal" ? "0 0 10px rgba(0, 229, 255, 0.2)" : "none"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "9.5px", color: activeTilingChannel === "normal" ? "#00e5ff" : "#94a3b8", fontWeight: "600" }}>
                        Normal {activeTilingChannel === "normal" ? "●" : ""}
                      </span>
                      <span style={{ fontSize: "8.5px", color: pieceNormalMap ? "#00e5ff" : "#64748b" }}>
                        {pieceNormalMap ? "Tangent" : "None"}
                      </span>
                    </div>

                    <div style={{ width: "100%", height: "46px", background: "#0f172a", borderRadius: "4px", overflow: "hidden", border: "1px solid #1e293b", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {pieceNormalMap?.image?.src ? (
                        <img
                          src={pieceNormalMap.image.src}
                          alt="normal map"
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        <span style={{ fontSize: "9px", color: "#64748b" }}>No Map</span>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: "4px", marginTop: "auto" }} onClick={(e) => e.stopPropagation()}>
                      <button
                        className="studio-btn-secondary"
                        style={{ flex: 1, padding: "3px 6px", fontSize: "9.5px", background: "#1e293b", color: "#e2e8f0" }}
                        onClick={() => {
                          setUploadTargetChannel("normal");
                          pieceFileInputRef.current?.click();
                        }}
                      >
                        Upload
                      </button>
                      {pieceNormalMap && (
                        <button
                          className="studio-btn-secondary"
                          style={{ padding: "3px 6px", fontSize: "9.5px", background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.4)", color: "#f87171" }}
                          title="Remove normal map"
                          onClick={() => {
                            modelStore.removePieceTextureMap(selectedPiece.id, "normal");
                            onShowToast?.("Removed normal map");
                          }}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Roughness Slot */}
                  <div
                    onClick={() => setActiveTilingChannel("roughness")}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                      minWidth: "130px",
                      background: "#0a0e17",
                      padding: "8px",
                      borderRadius: "6px",
                      border: activeTilingChannel === "roughness" ? "1.5px solid #00e5ff" : "1px solid #1e293b",
                      cursor: "pointer",
                      boxShadow: activeTilingChannel === "roughness" ? "0 0 10px rgba(0, 229, 255, 0.2)" : "none"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "9.5px", color: activeTilingChannel === "roughness" ? "#00e5ff" : "#94a3b8", fontWeight: "600" }}>
                        Roughness {activeTilingChannel === "roughness" ? "●" : ""}
                      </span>
                      <span style={{ fontSize: "8.5px", color: pieceRoughnessMap ? "#fbbf24" : "#64748b" }}>
                        {pieceRoughnessMap ? "Grayscale" : "Value"}
                      </span>
                    </div>

                    <div style={{ width: "100%", height: "46px", background: "#0f172a", borderRadius: "4px", overflow: "hidden", border: "1px solid #1e293b", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {pieceRoughnessMap?.image?.src ? (
                        <img
                          src={pieceRoughnessMap.image.src}
                          alt="roughness map"
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        <span style={{ fontSize: "9px", color: "#64748b" }}>No Map</span>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: "4px", marginTop: "auto" }} onClick={(e) => e.stopPropagation()}>
                      <button
                        className="studio-btn-secondary"
                        style={{ flex: 1, padding: "3px 6px", fontSize: "9.5px", background: "#1e293b", color: "#e2e8f0" }}
                        onClick={() => {
                          setUploadTargetChannel("roughness");
                          pieceFileInputRef.current?.click();
                        }}
                      >
                        Upload
                      </button>
                      {pieceRoughnessMap && (
                        <button
                          className="studio-btn-secondary"
                          style={{ padding: "3px 6px", fontSize: "9.5px", background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.4)", color: "#f87171" }}
                          title="Remove roughness map"
                          onClick={() => {
                            modelStore.removePieceTextureMap(selectedPiece.id, "roughness");
                            onShowToast?.("Removed roughness map");
                          }}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Metalness Slot */}
                  <div
                    onClick={() => setActiveTilingChannel("metalness")}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                      minWidth: "130px",
                      background: "#0a0e17",
                      padding: "8px",
                      borderRadius: "6px",
                      border: activeTilingChannel === "metalness" ? "1.5px solid #00e5ff" : "1px solid #1e293b",
                      cursor: "pointer",
                      boxShadow: activeTilingChannel === "metalness" ? "0 0 10px rgba(0, 229, 255, 0.2)" : "none"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "9.5px", color: activeTilingChannel === "metalness" ? "#00e5ff" : "#94a3b8", fontWeight: "600" }}>
                        Metallic {activeTilingChannel === "metalness" ? "●" : ""}
                      </span>
                      <span style={{ fontSize: "8.5px", color: pieceMetalnessMap ? "#38bdf8" : "#64748b" }}>
                        {pieceMetalnessMap ? "Grayscale" : "Value"}
                      </span>
                    </div>

                    <div style={{ width: "100%", height: "46px", background: "#0f172a", borderRadius: "4px", overflow: "hidden", border: "1px solid #1e293b", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {pieceMetalnessMap?.image?.src ? (
                        <img
                          src={pieceMetalnessMap.image.src}
                          alt="metallic map"
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        <span style={{ fontSize: "9px", color: "#64748b" }}>No Map</span>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: "4px", marginTop: "auto" }} onClick={(e) => e.stopPropagation()}>
                      <button
                        className="studio-btn-secondary"
                        style={{ flex: 1, padding: "3px 6px", fontSize: "9.5px", background: "#1e293b", color: "#e2e8f0" }}
                        onClick={() => {
                          setUploadTargetChannel("metalness");
                          pieceFileInputRef.current?.click();
                        }}
                      >
                        Upload
                      </button>
                      {pieceMetalnessMap && (
                        <button
                          className="studio-btn-secondary"
                          style={{ padding: "3px 6px", fontSize: "9.5px", background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.4)", color: "#f87171" }}
                          title="Remove metallic map"
                          onClick={() => {
                            modelStore.removePieceTextureMap(selectedPiece.id, "metalness");
                            onShowToast?.("Removed metallic map");
                          }}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Alpha / Opacity Slot */}
                  <div
                    onClick={() => setActiveTilingChannel("alpha")}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                      minWidth: "130px",
                      background: "#0a0e17",
                      padding: "8px",
                      borderRadius: "6px",
                      border: activeTilingChannel === "alpha" ? "1.5px solid #00e5ff" : "1px solid #1e293b",
                      cursor: "pointer",
                      boxShadow: activeTilingChannel === "alpha" ? "0 0 10px rgba(0, 229, 255, 0.2)" : "none"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "9.5px", color: activeTilingChannel === "alpha" ? "#00e5ff" : "#94a3b8", fontWeight: "600" }}>
                        Alpha {activeTilingChannel === "alpha" ? "●" : ""}
                      </span>
                      <span style={{ fontSize: "8.5px", color: pieceAlphaMap ? "#a855f7" : "#64748b" }}>
                        {pieceAlphaMap ? "Mask Active" : "Opaque"}
                      </span>
                    </div>

                    <div style={{ width: "100%", height: "46px", background: "#0f172a", borderRadius: "4px", overflow: "hidden", border: "1px solid #1e293b", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {pieceAlphaMap?.image?.src ? (
                        <img
                          src={pieceAlphaMap.image.src}
                          alt="alpha map"
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        <span style={{ fontSize: "9px", color: "#64748b" }}>No Map</span>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: "4px", marginTop: "auto" }} onClick={(e) => e.stopPropagation()}>
                      <button
                        className="studio-btn-secondary"
                        style={{ flex: 1, padding: "3px 6px", fontSize: "9.5px", background: "#1e293b", color: "#e2e8f0" }}
                        onClick={() => {
                          setUploadTargetChannel("alpha");
                          pieceFileInputRef.current?.click();
                        }}
                      >
                        Upload
                      </button>
                      {pieceAlphaMap && (
                        <button
                          className="studio-btn-secondary"
                          style={{ padding: "3px 6px", fontSize: "9.5px", background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.4)", color: "#f87171" }}
                          title="Remove alpha map"
                          onClick={() => {
                            modelStore.removePieceTextureMap(selectedPiece.id, "alpha");
                            onShowToast?.("Removed alpha map");
                          }}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Ambient Occlusion (AO) Slot */}
                  <div
                    onClick={() => setActiveTilingChannel("ao")}
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                      minWidth: "130px",
                      background: "#0a0e17",
                      padding: "8px",
                      borderRadius: "6px",
                      border: activeTilingChannel === "ao" ? "1.5px solid #00e5ff" : "1px solid #1e293b",
                      cursor: "pointer",
                      boxShadow: activeTilingChannel === "ao" ? "0 0 10px rgba(0, 229, 255, 0.2)" : "none"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "9.5px", color: activeTilingChannel === "ao" ? "#00e5ff" : "#94a3b8", fontWeight: "600" }}>
                        AO {activeTilingChannel === "ao" ? "●" : ""}
                      </span>
                      <span style={{ fontSize: "8.5px", color: pieceAoMap ? "#10b981" : "#64748b" }}>
                        {pieceAoMap ? "Occlusion" : "None"}
                      </span>
                    </div>

                    <div style={{ width: "100%", height: "46px", background: "#0f172a", borderRadius: "4px", overflow: "hidden", border: "1px solid #1e293b", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {pieceAoMap?.image?.src ? (
                        <img
                          src={pieceAoMap.image.src}
                          alt="ao map"
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        <span style={{ fontSize: "9px", color: "#64748b" }}>No Map</span>
                      )}
                    </div>

                    <div style={{ display: "flex", gap: "4px", marginTop: "auto" }} onClick={(e) => e.stopPropagation()}>
                      <button
                        className="studio-btn-secondary"
                        style={{ flex: 1, padding: "3px 6px", fontSize: "9.5px", background: "#1e293b", color: "#e2e8f0" }}
                        onClick={() => {
                          setUploadTargetChannel("ao");
                          pieceFileInputRef.current?.click();
                        }}
                      >
                        Upload
                      </button>
                      {pieceAoMap && (
                        <button
                          className="studio-btn-secondary"
                          style={{ padding: "3px 6px", fontSize: "9.5px", background: "rgba(239, 68, 68, 0.15)", border: "1px solid rgba(239, 68, 68, 0.4)", color: "#f87171" }}
                          title="Remove ambient occlusion map"
                          onClick={() => {
                            modelStore.removePieceTextureMap(selectedPiece.id, "ao");
                            onShowToast?.("Removed AO map");
                          }}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section 3: UV Tilings (for active map) & Normal Strength Sliders */}
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", minWidth: "220px", background: "#0a0e17", padding: "8px", borderRadius: "6px", border: "1px solid #1e293b", flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <span style={{ fontSize: "9.5px", color: "#94a3b8", fontWeight: "600" }}>Tiling:</span>
                      <span style={{ fontSize: "9.5px", color: "#00e5ff", fontWeight: "700" }}>
                        All Maps
                      </span>
                    </div>
                    <button
                      className="studio-btn-secondary"
                      style={{
                        padding: "2px 6px",
                        fontSize: "9px",
                        background: isTileLocked ? "rgba(6, 182, 212, 0.2)" : "#0f172a",
                        border: isTileLocked ? "1px solid #22d3ee" : "1px solid #1e293b",
                        color: isTileLocked ? "#22d3ee" : "#64748b"
                      }}
                      onClick={() => setIsTileLocked(!isTileLocked)}
                      title="Keep 1:1 Isotropic Aspect Ratio (Repeat X = Repeat Y)"
                    >
                      {isTileLocked ? "🔗 Locked 1:1" : "Unlinked"}
                    </button>
                  </div>

                  {/* Tile Repeat X */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "9.5px", color: "#cbd5e1", width: "45px" }}>Tile X:</span>
                    <input
                      type="range"
                      min="0.1"
                      max="40"
                      step="0.1"
                      value={pieceRepeatX}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        const nextY = isTileLocked ? val : pieceRepeatY;
                        modelStore.setPieceTextureRepeat(selectedPiece.id, val, nextY, undefined, true);
                      }}
                      style={{ flex: 1 }}
                    />
                    <input
                      type="number"
                      min="0.01"
                      max="100"
                      step="0.1"
                      value={Number(pieceRepeatX.toFixed(2))}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 1;
                        const nextY = isTileLocked ? val : pieceRepeatY;
                        modelStore.setPieceTextureRepeat(selectedPiece.id, val, nextY, undefined, true);
                      }}
                      style={{ width: "48px", padding: "2px 4px", fontSize: "10px", background: "#0f172a", border: "1px solid #334155", color: "#f8fafc", borderRadius: "3px", textAlign: "right" }}
                    />
                  </div>

                  {/* Tile Repeat Y */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "9.5px", color: "#cbd5e1", width: "45px" }}>Tile Y:</span>
                    <input
                      type="range"
                      min="0.1"
                      max="40"
                      step="0.1"
                      value={pieceRepeatY}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        const nextX = isTileLocked ? val : pieceRepeatX;
                        modelStore.setPieceTextureRepeat(selectedPiece.id, nextX, val, undefined, true);
                      }}
                      style={{ flex: 1 }}
                    />
                    <input
                      type="number"
                      min="0.01"
                      max="100"
                      step="0.1"
                      value={Number(pieceRepeatY.toFixed(2))}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value) || 1;
                        const nextX = isTileLocked ? val : pieceRepeatX;
                        modelStore.setPieceTextureRepeat(selectedPiece.id, nextX, val, undefined, true);
                      }}
                      style={{ width: "48px", padding: "2px 4px", fontSize: "10px", background: "#0f172a", border: "1px solid #334155", color: "#f8fafc", borderRadius: "3px", textAlign: "right" }}
                    />
                  </div>

                  {/* Normal Scale / Strength */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "auto" }}>
                    <span style={{ fontSize: "9.5px", color: "#cbd5e1", width: "45px" }}>Bump:</span>
                    <input
                      type="range"
                      min="0.0"
                      max="3.0"
                      step="0.05"
                      value={pieceNormalScale}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        modelStore.setPieceNormalScale(selectedPiece.id, val);
                      }}
                      style={{ flex: 1 }}
                    />
                    <span style={{ width: "48px", fontSize: "10px", color: "#94a3b8", textAlign: "right" }}>
                      {pieceNormalScale.toFixed(2)}x
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "80px", color: "#64748b", fontSize: "12px", background: "#0a0e17", borderRadius: "6px", border: "1px dashed #1e293b" }}>
                Select any garment mesh piece to edit its material, tilings, textures, or flip surface normals.
              </div>
            )}
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
                const thumb = getFabricAssetUrl(m.sphereThumbnailUrl || m.thumbnailUrl);
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
