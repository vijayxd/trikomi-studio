import React, { useRef, useEffect, useState } from "react";
import { observer } from "mobx-react-lite";
import { materialLibraryStore, MaterialSphereData, InspectionGeometryType } from "@trikomi/core/studio";
import {
  Search,
  RotateCcw,
  Sparkles,
  Layers,
  Plus,
  Sliders,
  Image as ImageIcon,
  Check,
  Trash2,
  Upload,
  Globe,
  Square,
  ShieldAlert,
  ChevronRight
} from "lucide-react";

export const StudioMaterialLibraryView: React.FC = observer(() => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeUploadChannel, setActiveUploadChannel] = useState<'diffuse' | 'normal' | 'roughness' | 'metalness' | 'alpha' | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    materialLibraryStore.initViewer(containerRef.current);

    return () => {
      materialLibraryStore.dispose();
    };
  }, []);

  const activeMat = materialLibraryStore.selectedMaterial;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && activeUploadChannel) {
      const url = URL.createObjectURL(file);
      materialLibraryStore.setTextureMap(activeUploadChannel, url);
      setActiveUploadChannel(null);
    }
  };

  const triggerUploadFor = (channel: 'diffuse' | 'normal' | 'roughness' | 'metalness' | 'alpha') => {
    setActiveUploadChannel(channel);
    fileInputRef.current?.click();
  };

  return (
    <div style={{ display: "flex", width: "100%", height: "100%", overflow: "hidden", position: "relative", background: "#070b12" }}>
      {/* Hidden file input for texture map uploads */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleFileUpload}
      />

      {/* LEFT COLUMN: Compact Material Catalog & Creator */}
      <aside
        style={{
          width: "270px",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          padding: "10px",
          background: "linear-gradient(180deg, #0e1422 0%, #0a0e17 100%)",
          borderRight: "1px solid #1a2234",
          zIndex: 10
        }}
      >
        {/* Header & New Material Action */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Layers size={14} color="#00e5ff" />
            <span style={{ fontSize: "12px", fontWeight: "700", color: "#f8fafc", letterSpacing: "0.4px" }}>
              Fabric Library
            </span>
          </div>
          <button
            className="studio-btn-primary"
            style={{ padding: "4px 8px", fontSize: "10.5px" }}
            onClick={() => materialLibraryStore.createCustomMaterial()}
            title="Create new empty PBR material"
          >
            <Plus size={12} />
            <span>New Fabric</span>
          </button>
        </div>

        {/* Search */}
        <div style={{ position: "relative", width: "100%" }}>
          <Search size={12} style={{ position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
          <input
            type="text"
            placeholder="Search fabrics..."
            value={materialLibraryStore.searchQuery}
            onChange={(e) => materialLibraryStore.setSearchQuery(e.target.value)}
            className="studio-input"
            style={{ width: "100%", paddingLeft: "26px", fontSize: "11px", padding: "5px 8px 5px 26px" }}
          />
        </div>

        {/* Category Filter Group */}
        <div className="studio-segmented-group" style={{ overflowX: "auto", flexShrink: 0 }}>
          {materialLibraryStore.categories.map((cat) => {
            const isActive = materialLibraryStore.categoryFilter === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => materialLibraryStore.setCategoryFilter(cat)}
                className={`studio-segmented-item ${isActive ? "active" : ""}`}
                style={{ fontSize: "9.5px", padding: "3px 8px" }}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Material Scrollable List */}
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px", paddingRight: "2px" }}>
          <span style={{ fontSize: "10px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", padding: "2px 4px" }}>
            Presets ({materialLibraryStore.filteredMaterials.length})
          </span>
          {materialLibraryStore.filteredMaterials.map((mat) => {
            const isSelected = activeMat?.id === mat.id;
            return (
              <div
                key={mat.id}
                onClick={() => materialLibraryStore.selectMaterial(mat.id)}
                className={`studio-slot-item ${isSelected ? "active" : ""}`}
                style={{ padding: "6px 8px" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                  {mat.thumbnailUrl ? (
                    <img
                      src={mat.thumbnailUrl}
                      alt={mat.name}
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "4px",
                        objectFit: "cover",
                        background: "#0f172a",
                        border: isSelected ? "1px solid #00e5ff" : "1px solid #1e293b"
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "4px",
                        background: mat.color || "#38bdf8",
                        border: isSelected ? "1px solid #00e5ff" : "1px solid #1e293b"
                      }}
                    />
                  )}
                  <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                    <span style={{ fontSize: "11px", fontWeight: "600", color: "#f8fafc", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {mat.name}
                    </span>
                    <span style={{ fontSize: "9px", color: "#64748b" }}>
                      {mat.category}
                    </span>
                  </div>
                </div>
                {isSelected && <ChevronRight size={13} color="#00e5ff" />}
              </div>
            );
          })}
        </div>
      </aside>

      {/* CENTER VIEWPORT: Big Hero 3D Inspection Stage */}
      <section style={{ flex: 1, height: "100%", position: "relative", overflow: "hidden" }}>
        <div ref={containerRef} style={{ width: "100%", height: "100%", outline: "none" }} />

        {/* Top-Left Floating Controls: Inspection Mesh Toggle & Framing */}
        <div style={{ position: "absolute", top: "12px", left: "14px", display: "flex", alignItems: "center", gap: "8px", zIndex: 10 }}>
          {/* Inspection Geometry Switcher */}
          <div className="studio-segmented-group" style={{ background: "rgba(10, 14, 23, 0.85)", backdropFilter: "blur(8px)" }}>
            <button
              className={`studio-segmented-item ${materialLibraryStore.inspectionGeometry === "sphere" ? "active" : ""}`}
              onClick={() => materialLibraryStore.setInspectionGeometry("sphere")}
              title="Material Sphere"
            >
              <Globe size={12} />
              <span>Sphere</span>
            </button>
            <button
              className={`studio-segmented-item ${materialLibraryStore.inspectionGeometry === "drape" ? "active" : ""}`}
              onClick={() => materialLibraryStore.setInspectionGeometry("drape")}
              title="Cloth Drape Simulation"
            >
              <Sparkles size={12} />
              <span>Drape</span>
            </button>
            <button
              className={`studio-segmented-item ${materialLibraryStore.inspectionGeometry === "swatch" ? "active" : ""}`}
              onClick={() => materialLibraryStore.setInspectionGeometry("swatch")}
              title="Flat Fabric Swatch"
            >
              <Square size={12} />
              <span>Swatch</span>
            </button>
          </div>

          <button
            className="studio-btn-secondary"
            onClick={() => materialLibraryStore.resetCamera()}
            title="Reset View Framing"
          >
            <RotateCcw size={12} />
            <span>Reset View</span>
          </button>

          <button
            className="studio-btn-secondary"
            onClick={() => materialLibraryStore.toggleDiffuseOnSpheres()}
            title="Toggle diffuse map visibility for surface weave inspection"
          >
            <Sparkles size={12} color={materialLibraryStore.showDiffuseOnSpheres ? "#00e5ff" : "#94a3b8"} />
            <span>{materialLibraryStore.showDiffuseOnSpheres ? "Diffuse: On" : "Clay Normals"}</span>
          </button>
        </div>

        {/* Viewport Info Watermark */}
        <div
          style={{
            position: "absolute",
            bottom: "14px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(10, 14, 23, 0.75)",
            backdropFilter: "blur(6px)",
            padding: "4px 12px",
            borderRadius: "16px",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            fontSize: "10px",
            color: "#94a3b8",
            pointerEvents: "none",
            display: "flex",
            alignItems: "center",
            gap: "6px"
          }}
        >
          <span>Active Material Hero Inspection</span>
          <span style={{ color: "#00e5ff" }}>•</span>
          <span>Left Drag to Orbit • Scroll to Zoom</span>
        </div>
      </section>

      {/* RIGHT COLUMN: PBR Map Slots & Parameter Tuning Studio */}
      {activeMat && (
        <aside
          style={{
            width: "320px",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            padding: "12px",
            background: "linear-gradient(180deg, #0e1422 0%, #0a0e17 100%)",
            borderLeft: "1px solid #1a2234",
            overflowY: "auto",
            zIndex: 10
          }}
        >
          {/* Active Material Title Card */}
          <div className="studio-card-panel">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "12px", height: "12px", borderRadius: "3px", background: activeMat.color || "#00e5ff" }} />
                <span style={{ fontSize: "12.5px", fontWeight: "700", color: "#f8fafc" }}>
                  {activeMat.name}
                </span>
              </div>
              <span style={{ fontSize: "9.5px", color: "#00e5ff", background: "rgba(0, 229, 255, 0.12)", padding: "2px 6px", borderRadius: "4px" }}>
                {activeMat.category}
              </span>
            </div>

            <div style={{ display: "flex", gap: "8px", alignItems: "center", marginTop: "6px" }}>
              <label style={{ fontSize: "10px", color: "#94a3b8" }}>Base Tint:</label>
              <input
                type="color"
                value={activeMat.color || "#ffffff"}
                onChange={(e) => materialLibraryStore.updateActiveMaterial({ color: e.target.value })}
                style={{ width: "26px", height: "24px", borderRadius: "4px", border: "1px solid #1e293b", cursor: "pointer", background: "transparent", padding: 0 }}
              />
              <input
                type="text"
                value={activeMat.name}
                onChange={(e) => materialLibraryStore.updateActiveMaterial({ name: e.target.value })}
                className="studio-input studio-input-sm"
                style={{ flex: 1 }}
              />
            </div>
          </div>

          {/* PBR Texture Map Slots Section */}
          <div className="studio-card-panel" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <span style={{ fontSize: "10.5px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              PBR Texture Channels
            </span>

            {/* 1. Base Color (Albedo / Diffuse) */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0a0e17", padding: "6px 8px", borderRadius: "6px", border: "1px solid #1e293b" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                {activeMat.diffuseMapUrl ? (
                  <img src={activeMat.diffuseMapUrl} alt="diffuse" style={{ width: "26px", height: "26px", borderRadius: "3px", objectFit: "cover" }} />
                ) : (
                  <div style={{ width: "26px", height: "26px", borderRadius: "3px", background: "#1e293b", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <ImageIcon size={12} color="#64748b" />
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: "11px", fontWeight: "600", color: "#f8fafc" }}>Base Color Map</span>
                  <span style={{ fontSize: "8.5px", color: activeMat.diffuseMapUrl ? "#34d399" : "#64748b" }}>
                    {activeMat.diffuseMapUrl ? "Channel Active" : "Empty (Color Tint Only)"}
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", gap: "4px" }}>
                <button className="studio-btn-secondary" style={{ padding: "3px 6px", fontSize: "9.5px" }} onClick={() => triggerUploadFor("diffuse")}>
                  <Upload size={11} /> {activeMat.diffuseMapUrl ? "Replace" : "Upload"}
                </button>
                {activeMat.diffuseMapUrl && (
                  <button className="tool-btn tool-btn-sm" onClick={() => materialLibraryStore.removeTextureMap("diffuse")} title="Clear Map">
                    <Trash2 size={11} color="#f87171" />
                  </button>
                )}
              </div>
            </div>

            {/* 2. Normal Map */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0a0e17", padding: "6px 8px", borderRadius: "6px", border: "1px solid #1e293b" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                {activeMat.normalMapUrl ? (
                  <img src={activeMat.normalMapUrl} alt="normal" style={{ width: "26px", height: "26px", borderRadius: "3px", objectFit: "cover" }} />
                ) : (
                  <div style={{ width: "26px", height: "26px", borderRadius: "3px", background: "#1e293b", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Layers size={12} color="#64748b" />
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: "11px", fontWeight: "600", color: "#f8fafc" }}>Normal Map</span>
                  <span style={{ fontSize: "8.5px", color: activeMat.normalMapUrl ? "#00e5ff" : "#64748b" }}>
                    {activeMat.normalMapUrl ? "Tangent Space Active" : "Empty"}
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", gap: "4px" }}>
                <button className="studio-btn-secondary" style={{ padding: "3px 6px", fontSize: "9.5px" }} onClick={() => triggerUploadFor("normal")}>
                  <Upload size={11} /> {activeMat.normalMapUrl ? "Replace" : "Upload"}
                </button>
                {activeMat.normalMapUrl && (
                  <button className="tool-btn tool-btn-sm" onClick={() => materialLibraryStore.removeTextureMap("normal")} title="Clear Map">
                    <Trash2 size={11} color="#f87171" />
                  </button>
                )}
              </div>
            </div>

            {/* 3. Roughness Map */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0a0e17", padding: "6px 8px", borderRadius: "6px", border: "1px solid #1e293b" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                {activeMat.roughnessMapUrl ? (
                  <img src={activeMat.roughnessMapUrl} alt="roughness" style={{ width: "26px", height: "26px", borderRadius: "3px", objectFit: "cover" }} />
                ) : (
                  <div style={{ width: "26px", height: "26px", borderRadius: "3px", background: "#1e293b", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Sliders size={12} color="#64748b" />
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: "11px", fontWeight: "600", color: "#f8fafc" }}>Roughness Map</span>
                  <span style={{ fontSize: "8.5px", color: activeMat.roughnessMapUrl ? "#fbbf24" : "#64748b" }}>
                    {activeMat.roughnessMapUrl ? "Grayscale Active" : "Value Controlled"}
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", gap: "4px" }}>
                <button className="studio-btn-secondary" style={{ padding: "3px 6px", fontSize: "9.5px" }} onClick={() => triggerUploadFor("roughness")}>
                  <Upload size={11} /> {activeMat.roughnessMapUrl ? "Replace" : "Upload"}
                </button>
                {activeMat.roughnessMapUrl && (
                  <button className="tool-btn tool-btn-sm" onClick={() => materialLibraryStore.removeTextureMap("roughness")} title="Clear Map">
                    <Trash2 size={11} color="#f87171" />
                  </button>
                )}
              </div>
            </div>

            {/* 4. Alpha / Opacity Map */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0a0e17", padding: "6px 8px", borderRadius: "6px", border: "1px solid #1e293b" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                {activeMat.alphaMapUrl ? (
                  <img src={activeMat.alphaMapUrl} alt="alpha" style={{ width: "26px", height: "26px", borderRadius: "3px", objectFit: "cover" }} />
                ) : (
                  <div style={{ width: "26px", height: "26px", borderRadius: "3px", background: "#1e293b", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Square size={12} color="#64748b" />
                  </div>
                )}
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: "11px", fontWeight: "600", color: "#f8fafc" }}>Alpha / Opacity</span>
                  <span style={{ fontSize: "8.5px", color: activeMat.alphaMapUrl ? "#a78bfa" : "#64748b" }}>
                    {activeMat.alphaMapUrl ? "Mask Active" : "Opaque"}
                  </span>
                </div>
              </div>
              <div style={{ display: "flex", gap: "4px" }}>
                <button className="studio-btn-secondary" style={{ padding: "3px 6px", fontSize: "9.5px" }} onClick={() => triggerUploadFor("alpha")}>
                  <Upload size={11} /> {activeMat.alphaMapUrl ? "Replace" : "Upload"}
                </button>
                {activeMat.alphaMapUrl && (
                  <button className="tool-btn tool-btn-sm" onClick={() => materialLibraryStore.removeTextureMap("alpha")} title="Clear Map">
                    <Trash2 size={11} color="#f87171" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Slider Tuning Parameters */}
          <div className="studio-card-panel" style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <span style={{ fontSize: "10.5px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              PBR Calibration Sliders
            </span>

            {/* Roughness Slider */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span style={{ fontSize: "10.5px", color: "#cbd5e1" }}>Roughness</span>
                <span style={{ fontSize: "10.5px", color: "#00e5ff", fontWeight: "600" }}>{activeMat.roughness.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={activeMat.roughness}
                onChange={(e) => materialLibraryStore.updateActiveMaterial({ roughness: parseFloat(e.target.value) })}
                style={{ width: "100%", accentColor: "#00e5ff", cursor: "pointer" }}
              />
            </div>

            {/* Metalness Slider */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span style={{ fontSize: "10.5px", color: "#cbd5e1" }}>Metalness</span>
                <span style={{ fontSize: "10.5px", color: "#00e5ff", fontWeight: "600" }}>{activeMat.metalness.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={activeMat.metalness}
                onChange={(e) => materialLibraryStore.updateActiveMaterial({ metalness: parseFloat(e.target.value) })}
                style={{ width: "100%", accentColor: "#00e5ff", cursor: "pointer" }}
              />
            </div>

            {/* Normal Strength */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                <span style={{ fontSize: "10.5px", color: "#cbd5e1" }}>Normal Strength</span>
                <span style={{ fontSize: "10.5px", color: "#00e5ff", fontWeight: "600" }}>{activeMat.normalStrength.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="3"
                step="0.05"
                value={activeMat.normalStrength}
                onChange={(e) => materialLibraryStore.updateActiveMaterial({ normalStrength: parseFloat(e.target.value) })}
                style={{ width: "100%", accentColor: "#00e5ff", cursor: "pointer" }}
              />
            </div>
          </div>
        </aside>
      )}
    </div>
  );
});
export default StudioMaterialLibraryView;
