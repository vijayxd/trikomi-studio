import React, { useState } from "react";
import { observer } from "mobx-react-lite";
import { RotateCw, RotateCcw, FlipHorizontal, FlipVertical, Crosshair, Undo2 } from "lucide-react";
import { modelStore, uvOrganizerStore } from "@trikomi/core/studio";
import { UVCanvasView } from "../UVCanvasView";
import { StudioCard } from "./StudioCard";

interface StudioRightPanelProps {
  collapsed?: boolean;
}

export const StudioRightPanel: React.FC<StudioRightPanelProps> = observer(({ collapsed = false }) => {
  const [isUVMaximized, setIsUVMaximized] = useState(false);

  const getTargetPieceIds = (): string[] => {
    if (modelStore.selectedPieceIds.length > 0) return [...modelStore.selectedPieceIds];
    if (modelStore.selectedPiece) return [modelStore.selectedPiece.id];
    return [];
  };

  const targetIds = getTargetPieceIds();
  const selectedCount = targetIds.length;
  const primaryPiece = selectedCount > 0 
    ? modelStore.pieces.find(p => p.id === targetIds[0]) 
    : null;

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

          {/* Zones Visibility Mode Toggle: All Canonical Zones vs Only Identified/Active Zones */}
          <button
            className={`btn-uv-sub-tab ${uvOrganizerStore.zoneDisplayMode === "all" ? "active" : ""}`}
            style={{ marginLeft: "6px", fontSize: "10px", padding: "2px 8px" }}
            onClick={() => uvOrganizerStore.toggleZoneDisplayMode()}
            title={uvOrganizerStore.zoneDisplayMode === "all" ? "Displaying All Canonical Zones (Click to show Identified Zones only)" : "Displaying Identified Panel Zones only (Click to show All Zones)"}
          >
            {uvOrganizerStore.zoneDisplayMode === "all" ? "All Zones" : "Identified Only"}
          </button>
        </div>

        {/* Right Topbar Actions: Auto Pack, Auto Detect, Focus Island, Reset Viewport & Fullscreen Viewport */}
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
            onClick={() => {
              uvOrganizerStore.autoDetectPatternAssignments(true);
              uvOrganizerStore.arrangeAssignedUVs();
            }}
            title="Auto-Detect Layout & Arrange into Canonical Zones"
          >
            Arrange
          </button>
          <button
            className="btn-uv-sub-tab"
            style={{ color: "#38bdf8", borderColor: "rgba(56, 189, 248, 0.4)" }}
            onClick={() => uvOrganizerStore.autoAlignZonePanels(undefined, targetIds.length > 1 ? targetIds : undefined)}
            title="Auto-Align Multi-Panels in Selected Zone or Multi-Selection (Y Paint-Line Leveling & X De-overlap)"
          >
            Auto Align
          </button>
          <button
            className="btn-uv-sub-tab"
            style={{ color: "var(--neon-cyan)", borderColor: "rgba(20, 217, 255, 0.4)", fontWeight: "600" }}
            onClick={async () => {
              const res = await uvOrganizerStore.saveUVLayoutToDisk();
              if (res.success) {
                alert("UV layout saved successfully!");
              }
            }}
            title="Save lightweight UV layout delta JSON (entities & positions only)"
          >
            Save UV
          </button>
          <button
            className="control-toggle-btn"
            style={{ width: "24px", height: "24px" }}
            onClick={() => uvOrganizerStore.focusSelectedIsland()}
            title="Focus & Frame Selected Island (F key)"
          >
            <Crosshair size={12} />
          </button>
          <button
            className="control-toggle-btn"
            style={{ width: "24px", height: "24px" }}
            onClick={() => uvOrganizerStore.resetUVViewport()}
            title="Reset UV Viewport View (100% Centered)"
          >
            <RotateCcw size={12} />
          </button>
          <button
            className={`control-toggle-btn ${isUVMaximized ? "active" : ""}`}
            style={{ width: "24px", height: "24px", marginLeft: "2px" }}
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
        {/* 2D Canvas Stage: Clean Hardware-Accelerated WebGL UV Viewport with 2D Move & Scale Gizmo */}
        <div className="uv-2d-canvas-box" style={{ position: "relative", minWidth: 0, height: "100%", overflow: "hidden" }}>
          <UVCanvasView />
        </div>

        {/* UV Inspector Column with Collapsible StudioCards */}
        <aside className="uv-inspector-panel" style={{ minWidth: 0, height: "100%", overflowY: "auto" }}>
          {/* Card 1: Essential Layout & Pipeline Tools */}
          <StudioCard title="UV Tools" flex="0 0 auto">
            <div className="uv-actions-tile-grid" style={{ gridTemplateColumns: "repeat(3, 1fr)" }}>
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
                onClick={() => uvOrganizerStore.autoAlignZonePanels(undefined, targetIds.length > 1 ? targetIds : undefined)}
                style={{ cursor: "pointer" }}
                title="Auto-align multi-piece panels in selected zone or selection (Y-Paint Line leveling + ≥50% Stacking retention + X-Margin spacing)"
              >
                <div className="tile-icon-square" style={{ color: "#38bdf8" }}>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="4" y1="6" x2="20" y2="6" />
                    <line x1="4" y1="12" x2="20" y2="12" />
                    <line x1="4" y1="18" x2="20" y2="18" />
                  </svg>
                </div>
                <span>Auto Align</span>
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
                <span>Equalize</span>
              </div>
            </div>

            {/* UV Blueprint & JSON Layout Export */}
            <div style={{ padding: "0 6px 6px", display: "flex", gap: "4px" }}>
              <button
                className="btn-uv-reset"
                style={{ flex: 1, padding: "4px", fontSize: "9px" }}
                onClick={() => uvOrganizerStore.saveUVLayoutToDisk()}
                title="Save entity-based UV layout JSON to disk"
              >
                Save Layout JSON
              </button>
              <button
                className="btn-uv-reset"
                style={{ flex: 1, padding: "4px", fontSize: "9px" }}
                onClick={() => uvOrganizerStore.exportProductionBlueprint(2048, "png")}
                title="Export 2048x2048 high-resolution transparent blueprint PNG"
              >
                Blueprint (2K)
              </button>
            </div>
          </StudioCard>

          {/* Card: Universal Fabric Normal Map Audit */}
          <StudioCard title="Fabric Normal Audit" flex="0 0 auto">
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-secondary)", fontWeight: "500" }}>Fabric Normal:</span>
                <button
                  className="btn-uv-sub-tab"
                  style={{
                    padding: "2px 8px",
                    background: modelStore.universalFabricNormalEnabled ? "rgba(56, 189, 248, 0.2)" : "rgba(255, 255, 255, 0.05)",
                    color: modelStore.universalFabricNormalEnabled ? "var(--neon-cyan)" : "var(--text-muted)",
                    borderColor: modelStore.universalFabricNormalEnabled ? "var(--neon-cyan)" : "transparent"
                  }}
                  onClick={() => {
                    modelStore.universalFabricNormalEnabled = !modelStore.universalFabricNormalEnabled;
                    if (modelStore.universalFabricNormalEnabled) {
                      modelStore.applyUniversalFabricNormal();
                    } else {
                      // Revert to original normal map
                      modelStore.pieces.forEach(p => {
                        if (p.material && p.material.userData.originalNormalMap !== undefined) {
                          p.material.normalMap = p.material.userData.originalNormalMap;
                          p.material.needsUpdate = true;
                        }
                      });
                    }
                  }}
                >
                  {modelStore.universalFabricNormalEnabled ? "Enabled" : "Disabled"}
                </button>
              </div>

              {modelStore.universalFabricNormalEnabled && (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {/* Curated Fabric Material Selector */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "9px", color: "var(--text-muted)" }}>
                        Fabric Library ({modelStore.curatedMaterialsList.length} Curated):
                      </span>
                      {modelStore.curatedMaterialsList.find(m => m.id === modelStore.selectedMaterialId)?.category && (
                        <span style={{ fontSize: "8.5px", color: "var(--neon-cyan)", background: "rgba(56, 189, 248, 0.1)", padding: "1px 5px", borderRadius: "3px" }}>
                          {modelStore.curatedMaterialsList.find(m => m.id === modelStore.selectedMaterialId)?.category}
                        </span>
                      )}
                    </div>

                    {/* 3D Sphere Swatch Grid (Visual Selection) */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(5, 1fr)",
                        gap: "4px",
                        maxHeight: "135px",
                        overflowY: "auto",
                        background: "rgba(0, 0, 0, 0.35)",
                        padding: "5px",
                        borderRadius: "5px",
                        border: "1px solid rgba(255, 255, 255, 0.08)"
                      }}
                    >
                      {modelStore.curatedMaterialsList.map(m => {
                        const isSelected = modelStore.selectedMaterialId === m.id;
                        const thumbSrc = m.sphereThumbnailUrl || m.thumbnailUrl;
                        return (
                          <div
                            key={m.id}
                            draggable={true}
                            onDragStart={(e) => {
                              e.dataTransfer.setData("application/json", JSON.stringify(m));
                              e.dataTransfer.setData("text/plain", JSON.stringify(m));
                              e.dataTransfer.effectAllowed = "copy";
                            }}
                            onClick={() => modelStore.switchCuratedMaterial(m.id)}
                            title={`${m.name} (${m.category}) - Drag onto any garment mesh panel or click to apply`}
                            style={{
                              position: "relative",
                              cursor: "grab",
                              borderRadius: "4px",
                              padding: "2px",
                              background: isSelected ? "rgba(56, 189, 248, 0.25)" : "rgba(255, 255, 255, 0.03)",
                              border: isSelected ? "1.5px solid var(--neon-cyan)" : "1px solid rgba(255, 255, 255, 0.08)",
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              transition: "all 0.15s ease"
                            }}
                          >
                            <img
                              src={thumbSrc}
                              alt={m.name}
                              style={{
                                width: "100%",
                                aspectRatio: "1 / 1",
                                objectFit: "contain",
                                borderRadius: "3px"
                              }}
                            />
                            <span
                              style={{
                                fontSize: "7.5px",
                                color: isSelected ? "var(--neon-cyan)" : "var(--text-muted)",
                                width: "100%",
                                textAlign: "center",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                marginTop: "1px",
                                fontWeight: isSelected ? "600" : "normal"
                              }}
                            >
                              {m.name}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Material Dropdown with Category and Name */}
                    <select
                      value={modelStore.selectedMaterialId}
                      onChange={(e) => modelStore.switchCuratedMaterial(e.target.value)}
                      style={{
                        background: "rgba(0,0,0,0.6)",
                        color: "var(--text-primary)",
                        border: "1px solid rgba(56, 189, 248, 0.3)",
                        borderRadius: "4px",
                        padding: "3px 6px",
                        fontSize: "9px",
                        outline: "none",
                        cursor: "pointer"
                      }}
                    >
                      {modelStore.curatedMaterialsList.map(m => (
                        <option key={m.id} value={m.id} style={{ background: "#0d131f" }}>
                          {m.name} ({m.category})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Visual Preview Swatch & PBR Specs */}
                  {(() => {
                    const activeMat = modelStore.curatedMaterialsList.find(m => m.id === modelStore.selectedMaterialId);
                    if (!activeMat) return null;
                    const availableMaps = activeMat.maps ? Object.keys(activeMat.maps) : [];
                    const activeThumb = activeMat.sphereThumbnailUrl || activeMat.thumbnailUrl;
                    return (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "5px",
                          background: "rgba(0,0,0,0.35)",
                          padding: "5px",
                          borderRadius: "4px",
                          border: "1px solid rgba(255,255,255,0.06)"
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <img
                            src={activeThumb}
                            alt={activeMat.name}
                            style={{
                              width: "42px",
                              height: "42px",
                              borderRadius: "4px",
                              objectFit: "contain",
                              background: "rgba(0,0,0,0.4)",
                              border: "1px solid rgba(56, 189, 248, 0.4)"
                            }}
                          />
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px", flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: "9.5px", fontWeight: "600", color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {activeMat.name}
                            </span>
                            <div style={{ display: "flex", gap: "6px", fontSize: "8.5px", color: "var(--text-muted)" }}>
                              <span>Rough: <strong style={{ color: "var(--neon-cyan)" }}>{activeMat.roughness ?? 0.6}</strong></span>
                              <span>Scale: <strong style={{ color: "var(--neon-cyan)" }}>{activeMat.normalStrength ?? 1.0}</strong></span>
                              {activeMat.physical?.weight && (
                                <span>{activeMat.physical.weight} g/m²</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Available Map Badges & Diffuse Toggle */}
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "3px", borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                          <div style={{ display: "flex", gap: "3px", flexWrap: "wrap" }}>
                            {availableMaps.map(mKey => (
                              <span
                                key={mKey}
                                style={{
                                  fontSize: "7.5px",
                                  padding: "1px 4px",
                                  borderRadius: "2px",
                                  background: mKey === "baseColor" ? "rgba(16, 185, 129, 0.2)" : mKey === "specular" ? "rgba(245, 158, 11, 0.2)" : "rgba(56, 189, 248, 0.15)",
                                  color: mKey === "baseColor" ? "#34d399" : mKey === "specular" ? "#fbbf24" : "var(--neon-cyan)",
                                  border: "1px solid rgba(255,255,255,0.08)",
                                  textTransform: "capitalize"
                                }}
                              >
                                {mKey === "baseColor" ? "Diffuse" : mKey}
                              </span>
                            ))}
                          </div>

                          {activeMat.diffuseMapUrl && (
                            <button
                              className="btn-uv-sub-tab"
                              style={{
                                padding: "1px 6px",
                                fontSize: "8px",
                                background: modelStore.applyDiffuseMapEnabled ? "rgba(16, 185, 129, 0.25)" : "rgba(255,255,255,0.05)",
                                color: modelStore.applyDiffuseMapEnabled ? "#34d399" : "var(--text-muted)",
                                borderColor: modelStore.applyDiffuseMapEnabled ? "#34d399" : "transparent"
                              }}
                              onClick={() => modelStore.toggleDiffuseMap()}
                              title="Toggle between real fabric diffuse texture and clean 3D garment base color"
                            >
                              {modelStore.applyDiffuseMapEnabled ? "Diffuse: ON" : "Diffuse: OFF"}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Tiling Repeat Slider */}
                  <div style={{ display: "flex", justifyContent: "space-between", color: "var(--text-muted)", fontSize: "9px" }}>
                    <span>Tiling Repeat (Trims excluded)</span>
                    <span style={{ color: "var(--neon-cyan)", fontWeight: "600" }}>{modelStore.universalNormalRepeat}x</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="80"
                    step="1"
                    value={modelStore.universalNormalRepeat}
                    onChange={(e) => modelStore.setUniversalNormalRepeat(parseFloat(e.target.value))}
                    style={{ width: "100%", accentColor: "var(--neon-cyan)", cursor: "pointer" }}
                  />
                </div>
              )}
            </div>
          </StudioCard>

          {/* Card 2: Transform Subcard (Dedicated Rotate, Mirror, Alignment & Reset) */}
          <StudioCard title="Transform" flex="0 0 auto">
            <div className="uv-transform-form">
              {/* Selected Target Island Indicator */}
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "4px 6px",
                background: "rgba(0,0,0,0.3)",
                borderRadius: "5px",
                border: "1px solid rgba(255,255,255,0.06)",
                marginBottom: "4px"
              }}>
                <span style={{ fontSize: "9px", color: "var(--text-muted)" }}>Target:</span>
                <span style={{
                  fontSize: "9.5px",
                  fontWeight: "600",
                  color: selectedCount > 0 ? "var(--neon-cyan)" : "var(--text-secondary)",
                  maxWidth: "130px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap"
                }}>
                  {primaryPiece ? (selectedCount > 1 ? `${selectedCount} Islands Selected` : primaryPiece.name) : "No Island Selected"}
                </span>
              </div>

              {/* Angle Row: Rotate CCW & CW */}
              <div className="transform-axis-row">
                <span>Angle</span>
                <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                  <button
                    className="btn-uv-reset"
                    style={{ flex: 1, padding: "4px 3px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
                    onClick={() => {
                      if (targetIds.length > 0) {
                        uvOrganizerStore.rotatePiecesGroupUV(targetIds, -90);
                      }
                    }}
                    title="Rotate 90° Counter-Clockwise"
                  >
                    <RotateCcw size={11} />
                    <span>-90°</span>
                  </button>
                  <button
                    className="btn-uv-reset"
                    style={{ flex: 1, padding: "4px 3px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
                    onClick={() => {
                      if (targetIds.length > 0) {
                        uvOrganizerStore.rotatePiecesGroupUV(targetIds, 90);
                      }
                    }}
                    title="Rotate 90° Clockwise"
                  >
                    <RotateCw size={11} />
                    <span>+90°</span>
                  </button>
                </div>
              </div>

              {/* Mirror Row: Flip Horizontal (U) & Vertical (V) */}
              <div className="transform-axis-row">
                <span>Mirror</span>
                <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                  <button
                    className="btn-uv-reset"
                    style={{ flex: 1, padding: "4px 3px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
                    onClick={() => {
                      if (targetIds.length > 0) {
                        uvOrganizerStore.flipPiecesGroupUV(targetIds, "horizontal");
                      }
                    }}
                    title="Flip Horizontal (Mirror U axis)"
                  >
                    <FlipHorizontal size={11} />
                    <span>Flip U</span>
                  </button>
                  <button
                    className="btn-uv-reset"
                    style={{ flex: 1, padding: "4px 3px", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
                    onClick={() => {
                      if (targetIds.length > 0) {
                        uvOrganizerStore.flipPiecesGroupUV(targetIds, "vertical");
                      }
                    }}
                    title="Flip Vertical (Mirror V axis)"
                  >
                    <FlipVertical size={11} />
                    <span>Flip V</span>
                  </button>
                </div>
              </div>

              {/* Action Buttons: Center in Zone & Reset Island */}
              <div className="uv-dual-buttons" style={{ marginTop: "4px" }}>
                <button
                  className="btn-uv-reset"
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
                  onClick={() => {
                    if (targetIds.length > 0) {
                      uvOrganizerStore.centerPiecesGroupInZone(targetIds);
                    }
                  }}
                  title="Center Island in Assigned Zone"
                >
                  <Crosshair size={11} />
                  <span>Center</span>
                </button>
                <button
                  className="btn-uv-apply"
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
                  onClick={() => {
                    if (targetIds.length > 0) {
                      uvOrganizerStore.resetPiecesGroupUV(targetIds);
                    }
                  }}
                  title="Reset Island UV to Canonical Zone Layout"
                >
                  <Undo2 size={11} />
                  <span>Reset Island</span>
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
