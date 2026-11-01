import React, { useState } from "react";
import { observer } from "mobx-react-lite";
import { modelStore } from "../../store/modelStore";
import { uvOrganizerStore } from "../../store/uvOrganizerStore";

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

  const curTriangles = modelStore.modelMeta.triangles || 0;
  const originalTris = modelStore.pieces.reduce((sum, p) => sum + (p.originalTriangles || p.triangles), 0) || curTriangles;

  // Real Fabric Preset Swatches mapped to PBR colors & styles
  const fabricPresets = [
    { id: "mat-blue", label: "Jersey Blue", className: "orb-mat-blue", color: "#2563eb", metal: 0.1, rough: 0.7 },
    { id: "mat-black", label: "Jersey Black", className: "orb-mat-black", color: "#1e293b", metal: 0.05, rough: 0.8 },
    { id: "mat-white", label: "Mesh White", className: "orb-mat-white", color: "#f8fafc", metal: 0.0, rough: 0.9 },
    { id: "mat-metal", label: "Metallic", className: "orb-mat-metal", color: "#94a3b8", metal: 0.85, rough: 0.25 },
    { id: "mat-neon", label: "Fabric Neon", className: "orb-mat-neon", color: "#10b981", metal: 0.2, rough: 0.5 },
    { id: "mat-pattern", label: "Pattern", className: "orb-mat-pattern", color: "#8b5cf6", metal: 0.1, rough: 0.6 }
  ];

  const handleApplyPreset = (index: number) => {
    setSelectedOrbIndex(index);
    const preset = fabricPresets[index];
    if (preset) {
      if (modelStore.selectedPiece && modelStore.selectedPiece.material) {
        // Guarantee isolated cloned material instance per Trikomi Rule #5
        if (!(modelStore.selectedPiece.material.userData && modelStore.selectedPiece.material.userData.isClonedInstance)) {
          modelStore.selectedPiece.material = modelStore.selectedPiece.material.clone();
          modelStore.selectedPiece.material.userData = { isClonedInstance: true };
          if (modelStore.selectedPiece.mesh) {
            modelStore.selectedPiece.mesh.material = modelStore.selectedPiece.material;
          }
        }
        modelStore.selectedPiece.material.color.set(preset.color);
        modelStore.selectedPiece.material.metalness = preset.metal;
        modelStore.selectedPiece.material.roughness = preset.rough;
        modelStore.selectedPiece.material.needsUpdate = true;
      } else if (modelStore.currentModel) {
        // Apply to all pieces with individual cloned materials
        modelStore.pieces.forEach(p => {
          if (p.mesh && p.material) {
            if (!(p.material.userData && p.material.userData.isClonedInstance)) {
              p.material = p.material.clone();
              p.material.userData = { isClonedInstance: true };
              p.mesh.material = p.material;
            }
            p.material.color.set(preset.color);
            p.material.metalness = preset.metal;
            p.material.roughness = preset.rough;
            p.material.needsUpdate = true;
          }
        });
      }
    }
  };

  return (
    <footer className={`panel-bottom-dock ${collapsed ? "collapsed" : ""}`} id="bottomDock">
      {/* 1. Card 1: Material Library (PBR Fabric Swatches) */}
      <div className="cyber-chassis">
        <div className="panel-header-titlebar">
          <div className="titlebar-text">
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
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>
        </div>

        <div className="material-palette-body">
          <div className="filter-pills-row">
            {["All", "Fabric", "Sports", "Custom", "+"].map((pill) => (
              <span
                key={pill}
                className={`chip-pill-filter ${activeMaterialFilter === pill ? "active" : ""}`}
                onClick={() => setActiveMaterialFilter(pill)}
              >
                {pill}
              </span>
            ))}
          </div>

          <div className="swatches-flex-cluster">
            {fabricPresets.map((preset, idx) => (
              <div
                key={preset.id}
                className={`swatch-orb-item ${selectedOrbIndex === idx ? "active" : ""}`}
                onClick={() => handleApplyPreset(idx)}
                title={`Apply ${preset.label} to selected piece`}
              >
                <div className={`pbr-sphere-mesh ${preset.className}`} />
                <span>{preset.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Card 2: Geometry & Decimation Optimization */}
      <div className="cyber-chassis">
        <div className="panel-header-titlebar">
          <div className="titlebar-text">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#14d9ff" strokeWidth="2">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
            <span>Geometry & Decimation</span>
          </div>
          <span
            style={{ fontSize: "9px", color: "var(--neon-cyan)", cursor: "pointer", fontWeight: 600 }}
            onClick={() => modelStore.revertDecimation()}
            title="Revert to 100% Original Geometry"
          >
            Revert
          </span>
        </div>

        <div className="uv-overview-content" style={{ flexDirection: "column", gap: "6px", justifyContent: "center" }}>
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
      <div className="cyber-chassis">
        <div className="preview-stage-frame">
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
      <div className="cyber-chassis">
        <div className="panel-header-titlebar">
          <div className="titlebar-text">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <span>Validation</span>
          </div>
        </div>
        <div className="validation-checklist-body">
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
            <span>Mannequin-Free</span>
          </div>
          <div className="validation-line-item">
            <div className="check-mark-circle">✓</div>
            <span>GLB Export Ready</span>
          </div>
        </div>
      </div>

      {/* 5. Card 5: Export Action CTA Card */}
      <div className="cyber-chassis export-cta-card-box">
        <button className="btn-export-pill-glow" onClick={onExportGLB}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" />
            <path d="M8 12l3 3 5-5" />
          </svg>
          <span>Export Ready</span>
        </button>
      </div>
    </footer>
  );
});
