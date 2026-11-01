import React, { useRef, useState, useEffect } from "react";
import { observer } from "mobx-react-lite";
import { uvOrganizerStore, GARMENT_TYPES } from "../store/uvOrganizerStore";
import { LayoutGrid, Plus, Trash2, RotateCcw, Check, Move, X, Download, Upload } from "lucide-react";

interface ZoneDragState {
  zoneId: string;
  mode: "move" | "nw" | "ne" | "se" | "sw";
  startX: number;
  startY: number;
  origMinU: number;
  origMaxU: number;
  origMinV: number;
  origMaxV: number;
  rectW: number;
  rectH: number;
}

export const UVZoneEditorModal = observer(() => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const jsonFileInputRef = useRef<HTMLInputElement | null>(null);
  const [activeDrag, setActiveDrag] = useState<ZoneDragState | null>(null);
  const [newZoneName, setNewZoneName] = useState("");

  useEffect(() => {
    if (activeDrag) {
      window.addEventListener("pointermove", handlePointerMove);
      window.addEventListener("pointerup", handlePointerUp);
      return () => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
      };
    }
  }, [activeDrag]);

  if (!uvOrganizerStore.showZoneEditorModal) return null;

  const handleJsonUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    const reader = new FileReader();
    reader.onload = (event: ProgressEvent<FileReader>) => {
      const result = event.target?.result;
      if (typeof result === "string") {
        const res = uvOrganizerStore.importZonesFromJSON(result);
        if (!res.success) {
          alert("Failed to load JSON backup: " + (res.error || "Unknown error"));
        }
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const zonesList = Object.values(uvOrganizerStore.zones);
  const selectedZone = (uvOrganizerStore.selectedZoneId && uvOrganizerStore.zones[uvOrganizerStore.selectedZoneId]) || zonesList[0];

  const handlePointerDown = (zoneId: string, mode: "move" | "nw" | "ne" | "se" | "sw", e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    uvOrganizerStore.setSelectedZone(zoneId);

    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const zone = uvOrganizerStore.zones[zoneId];
    if (!zone) return;

    setActiveDrag({
      zoneId,
      mode,
      startX: e.clientX,
      startY: e.clientY,
      origMinU: zone.uMin,
      origMaxU: zone.uMax,
      origMinV: zone.vMin,
      origMaxV: zone.vMax,
      rectW: rect.width,
      rectH: rect.height
    });
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (!activeDrag) return;
    const { zoneId, mode, startX, startY, origMinU, origMaxU, origMinV, origMaxV, rectW, rectH } = activeDrag;

    const deltaU = (e.clientX - startX) / rectW;
    const deltaV = -((e.clientY - startY) / rectH);

    const minSize = 0.04;
    let newMinU: number = origMinU;
    let newMaxU: number = origMaxU;
    let newMinV: number = origMinV;
    let newMaxV: number = origMaxV;

    if (mode === "move") {
      const w = origMaxU - origMinU;
      const h = origMaxV - origMinV;
      newMinU = Math.max(0, Math.min(1 - w, origMinU + deltaU));
      newMaxU = newMinU + w;
      newMinV = Math.max(0, Math.min(1 - h, origMinV + deltaV));
      newMaxV = newMinV + h;
    } else if (mode === "se") {
      newMaxU = Math.max(origMinU + minSize, Math.min(1, origMaxU + deltaU));
      newMinV = Math.max(0, Math.min(origMaxV - minSize, origMinV + deltaV));
    } else if (mode === "nw") {
      newMinU = Math.max(0, Math.min(origMaxU - minSize, origMinU + deltaU));
      newMaxV = Math.max(origMinV + minSize, Math.min(1, origMaxV + deltaV));
    } else if (mode === "ne") {
      newMaxU = Math.max(origMinU + minSize, Math.min(1, origMaxU + deltaU));
      newMaxV = Math.max(origMinV + minSize, Math.min(1, origMaxV + deltaV));
    } else if (mode === "sw") {
      newMinU = Math.max(0, Math.min(origMaxU - minSize, origMinU + deltaU));
      newMinV = Math.max(0, Math.min(origMaxV - minSize, origMinV + deltaV));
    }

    uvOrganizerStore.updateZoneBounds(zoneId, {
      uMin: parseFloat(newMinU.toFixed(3)),
      uMax: parseFloat(newMaxU.toFixed(3)),
      vMin: parseFloat(newMinV.toFixed(3)),
      vMax: parseFloat(newMaxV.toFixed(3))
    });
  };

  const handlePointerUp = () => {
    setActiveDrag(null);
  };

  const handleCreateZone = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newZoneName.trim() || "Custom Slot";
    const colors = ["#38bdf8", "#818cf8", "#34d399", "#f472b6", "#fbbf24", "#c084fc", "#f97316", "#2dd4bf"];
    const randColor = colors[zonesList.length % colors.length];
    uvOrganizerStore.addNewZone(name, randColor);
    setNewZoneName("");
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0, 0, 0, 0.8)",
        backdropFilter: "blur(12px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100
      }}
      onClick={() => uvOrganizerStore.setShowZoneEditorModal(false)}
    >
      <div
        style={{
          width: "920px",
          height: "640px",
          background: "#0b0f19",
          border: "1px solid rgba(255, 255, 255, 0.15)",
          borderRadius: "16px",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 60px rgba(0,0,0,0.8)",
          overflow: "hidden"
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: "14px 20px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "rgba(15, 23, 42, 0.6)"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <LayoutGrid size={20} color="#38bdf8" />
              <div>
                <div style={{ fontWeight: "700", fontSize: "14px", color: "#f8fafc" }}>
                  Canonical UV Slots Designer
                </div>
                <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                  Fixed slot zones for standardized pattern mapping
                </div>
              </div>
            </div>

            {/* Category Switcher Tabs: Topwear vs Bottomwear */}
            <div style={{ display: "flex", background: "rgba(30, 41, 59, 0.8)", padding: "3px", borderRadius: "8px", border: "1px solid rgba(255, 255, 255, 0.1)" }}>
              <button
                type="button"
                onClick={() => uvOrganizerStore.switchGarmentType(GARMENT_TYPES.TOPWEAR)}
                style={{
                  padding: "5px 12px",
                  borderRadius: "6px",
                  fontSize: "11px",
                  fontWeight: "700",
                  cursor: "pointer",
                  border: "none",
                  background: uvOrganizerStore.activeGarmentType === GARMENT_TYPES.TOPWEAR ? "#0284c7" : "transparent",
                  color: uvOrganizerStore.activeGarmentType === GARMENT_TYPES.TOPWEAR ? "#fff" : "#94a3b8",
                  transition: "all 0.15s ease"
                }}
              >
                👕 Topwear (T-Shirt/Hoodie/Tops)
              </button>
              <button
                type="button"
                onClick={() => uvOrganizerStore.switchGarmentType(GARMENT_TYPES.BOTTOMWEAR)}
                style={{
                  padding: "5px 12px",
                  borderRadius: "6px",
                  fontSize: "11px",
                  fontWeight: "700",
                  cursor: "pointer",
                  border: "none",
                  background: uvOrganizerStore.activeGarmentType === GARMENT_TYPES.BOTTOMWEAR ? "#0284c7" : "transparent",
                  color: uvOrganizerStore.activeGarmentType === GARMENT_TYPES.BOTTOMWEAR ? "#fff" : "#94a3b8",
                  transition: "all 0.15s ease"
                }}
              >
                👖 Bottomwear (Pants/Shorts)
              </button>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input
              type="file"
              ref={jsonFileInputRef}
              onChange={handleJsonUpload}
              accept=".json"
              style={{ display: "none" }}
            />

            <button
              className="btn btn-secondary"
              style={{ padding: "6px 10px", fontSize: "11px", gap: "5px" }}
              onClick={() => uvOrganizerStore.exportZonesAsJSON()}
              title="Download safe JSON backup of this canonical layout"
            >
              <Download size={13} color="#38bdf8" />
              <span>Export JSON</span>
            </button>

            <button
              className="btn btn-secondary"
              style={{ padding: "6px 10px", fontSize: "11px", gap: "5px" }}
              onClick={() => jsonFileInputRef.current?.click()}
              title="Upload and restore a saved UV layout JSON file"
            >
              <Upload size={13} color="#34d399" />
              <span>Import JSON</span>
            </button>

            <button
              className="btn btn-secondary"
              style={{ padding: "6px 10px", fontSize: "11px", gap: "5px" }}
              onClick={() => uvOrganizerStore.resetZonesToDefault()}
              title="Reset to default template"
            >
              <RotateCcw size={13} />
              <span>Reset</span>
            </button>

            <button
              className="btn btn-primary"
              style={{ padding: "6px 14px", fontSize: "12px", gap: "6px" }}
              onClick={() => {
                uvOrganizerStore.setShowZoneEditorModal(false);
                uvOrganizerStore.arrangeAssignedUVs();
              }}
            >
              <Check size={14} />
              <span>Apply & Save</span>
            </button>

            <button
              style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", padding: "4px" }}
              onClick={() => uvOrganizerStore.setShowZoneEditorModal(false)}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {/* Interactive UV Canvas Area (Square 480x480) */}
          <div
            style={{
              padding: "24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "#080c14",
              borderRight: "1px solid rgba(255, 255, 255, 0.08)"
            }}
          >
            <div
              ref={containerRef}
              style={{
                width: "480px",
                height: "480px",
                background: "#090d16",
                border: "2px solid rgba(56, 189, 248, 0.25)",
                borderRadius: "8px",
                position: "relative",
                backgroundImage: `
                  linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px),
                  linear-gradient(to bottom, rgba(255,255,255,0.06) 1px, transparent 1px)
                `,
                backgroundSize: "48px 48px",
                overflow: "hidden",
                boxShadow: "inset 0 0 40px rgba(0,0,0,0.8)"
              }}
            >
              <span style={{ position: "absolute", top: "6px", left: "8px", fontSize: "10px", color: "rgba(255,255,255,0.2)", pointerEvents: "none" }}>U: 0.0, V: 1.0 (Top)</span>
              <span style={{ position: "absolute", bottom: "6px", right: "8px", fontSize: "10px", color: "rgba(255,255,255,0.2)", pointerEvents: "none" }}>U: 1.0, V: 0.0 (Bottom)</span>

              {zonesList.map((z) => {
                const isSelected = selectedZone?.id === z.id;
                const left = z.uMin * 100;
                const top = (1 - z.vMax) * 100;
                const width = (z.uMax - z.uMin) * 100;
                const height = (z.vMax - z.vMin) * 100;

                return (
                  <div
                    key={z.id}
                    onPointerDown={(e) => handlePointerDown(z.id, "move", e)}
                    style={{
                      position: "absolute",
                      left: `${left}%`,
                      top: `${top}%`,
                      width: `${width}%`,
                      height: `${height}%`,
                      background: isSelected ? z.color + "33" : z.color + "18",
                      border: isSelected ? `2px solid ${z.color}` : `1.5px dashed ${z.color}aa`,
                      borderRadius: "6px",
                      cursor: "move",
                      userSelect: "none",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      padding: "4px 6px",
                      boxShadow: isSelected ? `0 0 16px ${z.color}55` : "none",
                      zIndex: isSelected ? 10 : 2
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ color: z.color, fontSize: "10px", fontWeight: "700" }}>{z.label}</span>
                      <Move size={10} color={z.color} />
                    </div>

                    <div style={{ fontSize: "8.5px", color: "rgba(255,255,255,0.6)" }}>
                      {(width).toFixed(0)}% × {(height).toFixed(0)}%
                    </div>

                    {isSelected && (
                      <>
                        <div
                          onPointerDown={(e) => handlePointerDown(z.id, "nw", e)}
                          style={{ position: "absolute", top: "-5px", left: "-5px", width: "10px", height: "10px", background: "#fff", border: `2px solid ${z.color}`, borderRadius: "50%", cursor: "nwse-resize" }}
                        />
                        <div
                          onPointerDown={(e) => handlePointerDown(z.id, "ne", e)}
                          style={{ position: "absolute", top: "-5px", right: "-5px", width: "10px", height: "10px", background: "#fff", border: `2px solid ${z.color}`, borderRadius: "50%", cursor: "nesw-resize" }}
                        />
                        <div
                          onPointerDown={(e) => handlePointerDown(z.id, "se", e)}
                          style={{ position: "absolute", bottom: "-5px", right: "-5px", width: "10px", height: "10px", background: "#fff", border: `2px solid ${z.color}`, borderRadius: "50%", cursor: "nwse-resize" }}
                        />
                        <div
                          onPointerDown={(e) => handlePointerDown(z.id, "sw", e)}
                          style={{ position: "absolute", bottom: "-5px", left: "-5px", width: "10px", height: "10px", background: "#fff", border: `2px solid ${z.color}`, borderRadius: "50%", cursor: "nesw-resize" }}
                        />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Control Panel */}
          <div style={{ flex: 1, padding: "20px", display: "flex", flexDirection: "column", gap: "16px", overflowY: "auto" }}>
            <form onSubmit={handleCreateZone} style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                placeholder="New zone (e.g. Pocket, Hood)"
                value={newZoneName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewZoneName(e.target.value)}
                style={{
                  flex: 1,
                  background: "rgba(30, 41, 59, 0.6)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  borderRadius: "6px",
                  padding: "8px 12px",
                  color: "#fff",
                  fontSize: "12px",
                  outline: "none"
                }}
              />
              <button className="btn btn-primary" type="submit" style={{ padding: "8px 12px", fontSize: "12px" }}>
                <Plus size={14} />
                <span>Add</span>
              </button>
            </form>

            {selectedZone && (
              <div style={{ background: "rgba(30, 41, 59, 0.4)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "10px", padding: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ width: "12px", height: "12px", borderRadius: "3px", background: selectedZone.color }} />
                    <span style={{ fontWeight: "700", fontSize: "13px", color: "#f8fafc" }}>
                      {selectedZone.label}
                    </span>
                  </div>
                  <button
                    onClick={() => uvOrganizerStore.deleteZone(selectedZone.id)}
                    style={{ background: "transparent", border: "none", color: "#f87171", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px", fontSize: "11px" }}
                    title="Remove slot"
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ fontSize: "10px", color: "#94a3b8" }}>U Min (Left)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max={selectedZone.uMax - 0.04}
                      value={selectedZone.uMin}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => uvOrganizerStore.updateZoneBounds(selectedZone.id, { uMin: parseFloat(e.target.value) })}
                      style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", color: "#fff", padding: "4px 8px", borderRadius: "4px", fontSize: "11px" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "10px", color: "#94a3b8" }}>U Max (Right)</label>
                    <input
                      type="number"
                      step="0.01"
                      min={selectedZone.uMin + 0.04}
                      max="1"
                      value={selectedZone.uMax}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => uvOrganizerStore.updateZoneBounds(selectedZone.id, { uMax: parseFloat(e.target.value) })}
                      style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", color: "#fff", padding: "4px 8px", borderRadius: "4px", fontSize: "11px" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "10px", color: "#94a3b8" }}>V Min (Bottom)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max={selectedZone.vMax - 0.04}
                      value={selectedZone.vMin}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => uvOrganizerStore.updateZoneBounds(selectedZone.id, { vMin: parseFloat(e.target.value) })}
                      style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", color: "#fff", padding: "4px 8px", borderRadius: "4px", fontSize: "11px" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "10px", color: "#94a3b8" }}>V Max (Top)</label>
                    <input
                      type="number"
                      step="0.01"
                      min={selectedZone.vMin + 0.04}
                      max="1"
                      value={selectedZone.vMax}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => uvOrganizerStore.updateZoneBounds(selectedZone.id, { vMax: parseFloat(e.target.value) })}
                      style={{ width: "100%", background: "#0f172a", border: "1px solid #334155", color: "#fff", padding: "4px 8px", borderRadius: "4px", fontSize: "11px" }}
                    />
                  </div>
                </div>

                <div style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <label style={{ fontSize: "10px", color: "#94a3b8" }}>Color Tag:</label>
                  <input
                    type="color"
                    value={selectedZone.color}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => uvOrganizerStore.updateZoneBounds(selectedZone.id, { color: e.target.value })}
                    style={{ width: "24px", height: "24px", borderRadius: "4px", border: "none", cursor: "pointer", background: "transparent" }}
                  />
                </div>
              </div>
            )}

            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ fontSize: "11px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase" }}>
                Active Slots ({zonesList.length})
              </span>
              {zonesList.map((z) => (
                <div
                  key={z.id}
                  onClick={() => uvOrganizerStore.setSelectedZone(z.id)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: "6px",
                    background: selectedZone?.id === z.id ? "rgba(56, 189, 248, 0.15)" : "rgba(30, 41, 59, 0.3)",
                    border: selectedZone?.id === z.id ? "1px solid #38bdf8" : "1px solid rgba(255, 255, 255, 0.05)",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ width: "10px", height: "10px", borderRadius: "3px", background: z.color }} />
                    <span style={{ fontSize: "12px", color: "#f8fafc", fontWeight: "600" }}>{z.label}</span>
                  </div>
                  <span style={{ fontSize: "10px", color: "#64748b" }}>
                    U: [{z.uMin}-{z.uMax}], V: [{z.vMin}-{z.vMax}]
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
