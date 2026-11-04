import React, { useRef, useEffect } from "react";
import { observer } from "mobx-react-lite";
import { materialLibraryStore } from "@trikomi/core/studio";
import { StudioCard } from "./StudioCard";
import { Search, RotateCcw, Sparkles, Layers, ShieldCheck, Tag } from "lucide-react";

export const StudioMaterialLibraryView: React.FC = observer(() => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    materialLibraryStore.initViewer(containerRef.current);

    return () => {
      materialLibraryStore.dispose();
    };
  }, []);

  const selected = materialLibraryStore.selectedMaterial;
  const availableMaps = selected?.maps ? Object.keys(selected.maps) : [];

  return (
    <div style={{ display: "flex", width: "100%", height: "100%", overflow: "hidden", position: "relative" }}>
      {/* Left Column: Material Grid Navigator & Filters */}
      <aside
        style={{
          width: "280px",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
          padding: "8px",
          background: "rgba(11, 15, 23, 0.95)",
          borderRight: "1px solid rgba(255, 255, 255, 0.08)",
          zIndex: 10
        }}
      >
        {/* Search & Stats */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "11px", fontWeight: "700", color: "#fff", display: "flex", alignItems: "center", gap: "5px" }}>
              <Layers size={13} color="var(--neon-cyan)" />
              <span>Fabric Library</span>
            </span>
            <span style={{ fontSize: "9px", color: "var(--neon-cyan)", background: "rgba(56, 189, 248, 0.15)", padding: "2px 6px", borderRadius: "10px" }}>
              {materialLibraryStore.filteredMaterials.length} Weaves
            </span>
          </div>

          <div style={{ position: "relative", width: "100%" }}>
            <Search size={12} style={{ position: "absolute", left: "8px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input
              type="text"
              placeholder="Filter fabric weave..."
              value={materialLibraryStore.searchQuery}
              onChange={(e) => materialLibraryStore.setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "5px 8px 5px 24px",
                fontSize: "10px",
                background: "rgba(0, 0, 0, 0.4)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                borderRadius: "4px",
                color: "#fff",
                outline: "none"
              }}
            />
          </div>

          {/* Category Chips */}
          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", maxHeight: "55px", overflowY: "auto" }}>
            {materialLibraryStore.categories.map((cat) => (
              <button
                key={cat}
                onClick={() => materialLibraryStore.setCategoryFilter(cat)}
                style={{
                  fontSize: "8.5px",
                  padding: "2px 6px",
                  borderRadius: "3px",
                  border: materialLibraryStore.categoryFilter === cat ? "1px solid var(--neon-cyan)" : "1px solid rgba(255,255,255,0.08)",
                  background: materialLibraryStore.categoryFilter === cat ? "rgba(56, 189, 248, 0.2)" : "rgba(0,0,0,0.3)",
                  color: materialLibraryStore.categoryFilter === cat ? "var(--neon-cyan)" : "var(--text-muted)",
                  cursor: "pointer"
                }}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Scrollable Materials List with Swatches */}
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px", paddingRight: "2px" }}>
          {materialLibraryStore.filteredMaterials.map((mat) => {
            const isSelected = selected?.id === mat.id;
            return (
              <div
                key={mat.id}
                onClick={() => materialLibraryStore.selectMaterial(mat.id)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "5px 6px",
                  borderRadius: "5px",
                  background: isSelected ? "rgba(56, 189, 248, 0.18)" : "rgba(0, 0, 0, 0.25)",
                  border: isSelected ? "1px solid var(--neon-cyan)" : "1px solid rgba(255, 255, 255, 0.05)",
                  cursor: "pointer",
                  transition: "all 0.15s ease"
                }}
              >
                <img
                  src={(mat as any).sphereThumbnailUrl || mat.thumbnailUrl}
                  alt={mat.name}
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "4px",
                    objectFit: "contain",
                    background: "rgba(0,0,0,0.4)",
                    border: isSelected ? "1px solid var(--neon-cyan)" : "1px solid rgba(255, 255, 255, 0.1)"
                  }}
                />
                <div style={{ display: "flex", flexDirection: "column", gap: "2px", flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: "10px", fontWeight: "600", color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {mat.name}
                  </span>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "8.5px", color: "var(--text-muted)" }}>
                    <span>{mat.category}</span>
                    <span style={{ color: "var(--neon-cyan)" }}>#{mat.index}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      {/* Center 3D Viewport: Real-time 3D Spheres Scene */}
      <section style={{ flex: 1, height: "100%", position: "relative" }}>
        <div ref={containerRef} style={{ width: "100%", height: "100%", outline: "none" }} />

        {/* Viewport Floating Overlay Controls */}
        <div style={{ position: "absolute", top: "10px", left: "10px", display: "flex", gap: "6px", zIndex: 10 }}>
          <button
            onClick={() => materialLibraryStore.resetCamera()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "4px 8px",
              fontSize: "9.5px",
              background: "rgba(11, 15, 23, 0.8)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              borderRadius: "4px",
              color: "#fff",
              cursor: "pointer"
            }}
            title="Reset Camera Framing"
          >
            <RotateCcw size={11} />
            <span>Reset Camera</span>
          </button>

          <button
            onClick={() => materialLibraryStore.toggleDiffuseOnSpheres()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "4px 8px",
              fontSize: "9.5px",
              background: materialLibraryStore.showDiffuseOnSpheres ? "rgba(16, 185, 129, 0.2)" : "rgba(11, 15, 23, 0.8)",
              border: materialLibraryStore.showDiffuseOnSpheres ? "1px solid #34d399" : "1px solid rgba(255, 255, 255, 0.15)",
              color: materialLibraryStore.showDiffuseOnSpheres ? "#34d399" : "#fff",
              borderRadius: "4px",
              cursor: "pointer"
            }}
            title="Toggle between printed fabric color vs clay/neutral base for normal audit"
          >
            <Sparkles size={11} />
            <span>{materialLibraryStore.showDiffuseOnSpheres ? "Diffuse: Visible" : "Clay / Normal Only"}</span>
          </button>
        </div>

        {/* Bottom Helper Hint */}
        <div
          style={{
            position: "absolute",
            bottom: "10px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(11, 15, 23, 0.75)",
            padding: "4px 12px",
            borderRadius: "15px",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            fontSize: "9px",
            color: "var(--text-muted)",
            pointerEvents: "none"
          }}
        >
          💡 Click any 3D Sphere to focus & inspect • Left click + Drag to Orbit • Scroll to Zoom
        </div>
      </section>

      {/* Right Column: Active Material Inspector & PBR Data */}
      {selected && (
        <aside
          style={{
            width: "300px",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            padding: "8px",
            background: "rgba(11, 15, 23, 0.95)",
            borderLeft: "1px solid rgba(255, 255, 255, 0.08)",
            overflowY: "auto",
            zIndex: 10
          }}
        >
          {/* Card 1: Active Material Profile */}
          <StudioCard title="Material Profile" flex="0 0 auto">
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                <img
                  src={selected.thumbnailUrl}
                  alt={selected.name}
                  style={{
                    width: "56px",
                    height: "56px",
                    borderRadius: "6px",
                    objectFit: "cover",
                    border: "1px solid var(--neon-cyan)"
                  }}
                />
                <div style={{ display: "flex", flexDirection: "column", gap: "2px", flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: "11px", fontWeight: "700", color: "#fff" }}>
                    {selected.name}
                  </span>
                  <span style={{ fontSize: "9.5px", color: "var(--neon-cyan)" }}>
                    {selected.category}
                  </span>
                  <span style={{ fontSize: "8.5px", color: "var(--text-muted)" }}>
                    ID: {selected.id}
                  </span>
                </div>
              </div>

              {/* Physical Fabric Properties */}
              {selected.physical && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px", background: "rgba(0,0,0,0.3)", padding: "6px", borderRadius: "4px" }}>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: "8px", color: "var(--text-muted)" }}>Weight</span>
                    <span style={{ fontSize: "10px", fontWeight: "600", color: "#fff" }}>{selected.physical.weight ?? 300} g/m²</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontSize: "8px", color: "var(--text-muted)" }}>Thickness</span>
                    <span style={{ fontSize: "10px", fontWeight: "600", color: "#fff" }}>{selected.physical.thickness ?? 0.5} mm</span>
                  </div>
                </div>
              )}
            </div>
          </StudioCard>

          {/* Card 2: PBR Channels Audit */}
          <StudioCard title="PBR Channels & Calibration" flex="0 0 auto">
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "9.5px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Normal Strength:</span>
                <span style={{ color: "var(--neon-cyan)", fontWeight: "600" }}>{selected.normalStrength}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Surface Roughness:</span>
                <span style={{ color: "var(--neon-cyan)", fontWeight: "600" }}>{selected.roughness}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Metalness:</span>
                <span style={{ color: "var(--neon-cyan)", fontWeight: "600" }}>{selected.metalness}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Tiling Repeat:</span>
                <span style={{ color: "var(--neon-cyan)", fontWeight: "600" }}>
                  {Array.isArray(selected.normalRepeat) ? `${selected.normalRepeat[0].toFixed(1)}x` : `${selected.normalRepeat}x`}
                </span>
              </div>

              {/* Available Texture Maps List */}
              <div style={{ marginTop: "6px", display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "8.5px", color: "var(--text-muted)", fontWeight: "600" }}>Available Channels:</span>
                <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                  {availableMaps.map((k) => (
                    <span
                      key={k}
                      style={{
                        fontSize: "8px",
                        padding: "2px 5px",
                        borderRadius: "3px",
                        background: k === "baseColor" ? "rgba(16, 185, 129, 0.2)" : k === "specular" ? "rgba(245, 158, 11, 0.2)" : "rgba(56, 189, 248, 0.15)",
                        color: k === "baseColor" ? "#34d399" : k === "specular" ? "#fbbf24" : "var(--neon-cyan)",
                        border: "1px solid rgba(255, 255, 255, 0.08)",
                        textTransform: "capitalize"
                      }}
                    >
                      {k === "baseColor" ? "Diffuse Map" : `${k} Map`}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </StudioCard>

          {/* Card 3: 2D Texture Previews */}
          <StudioCard title="Texture Map Previews" flex="1">
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", overflowY: "auto" }}>
              {selected.diffuseMapUrl && (
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <span style={{ fontSize: "8.5px", color: "var(--text-muted)" }}>Diffuse (Base Color):</span>
                  <img
                    src={selected.diffuseMapUrl}
                    alt="diffuse"
                    style={{ width: "100%", height: "100px", objectFit: "cover", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.1)" }}
                  />
                </div>
              )}

              {selected.normalMapUrl && (
                <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <span style={{ fontSize: "8.5px", color: "var(--text-muted)" }}>Normal Map (Weave Depth):</span>
                  <img
                    src={selected.normalMapUrl}
                    alt="normal"
                    style={{ width: "100%", height: "100px", objectFit: "cover", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.1)" }}
                  />
                </div>
              )}
            </div>
          </StudioCard>
        </aside>
      )}
    </div>
  );
});
