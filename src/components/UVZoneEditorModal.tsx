import React, { useRef, useState, useEffect } from "react";
import { observer } from "mobx-react-lite";
import { uvOrganizerStore, GARMENT_TYPES } from "@trikomi/core/studio";
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
  const [showAddCategoryInput, setShowAddCategoryInput] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

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

    uvOrganizerStore.resizeZoneByDelta(zoneId, mode, origMinU, origMaxU, origMinV, origMaxV, deltaU, deltaV);
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

  const handleAddCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newCategoryName.trim()) {
      uvOrganizerStore.addCustomGarmentCategory(newCategoryName.trim());
      setNewCategoryName("");
      setShowAddCategoryInput(false);
    }
  };

  return (
    <div
      className="studio-modal-backdrop"
      onClick={() => uvOrganizerStore.setShowZoneEditorModal(false)}
    >
      <div
        className="studio-modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="studio-modal-header">
          <div style={{ display: "flex", alignItems: "center", gap: "14px", flex: 1, overflow: "hidden" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
              <LayoutGrid size={18} color="#00e5ff" />
              <div>
                <div style={{ fontWeight: "600", fontSize: "13px", color: "#f8fafc" }}>
                  Canonical UV Slots Designer
                </div>
                <div style={{ fontSize: "10.5px", color: "#94a3b8" }}>
                  Fixed slot zones for standardized pattern mapping
                </div>
              </div>
            </div>

            {/* Category Switcher Tabs: Topwear, Bottomwear, + New Wear Sets */}
            <div className="studio-segmented-group" style={{ overflowX: "auto", flexShrink: 0, maxWidth: "420px" }}>
              {uvOrganizerStore.allGarmentTypes.map((cat) => {
                const isActive = uvOrganizerStore.activeGarmentType === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => uvOrganizerStore.switchGarmentType(cat.id)}
                    className={`studio-segmented-item ${isActive ? "active" : ""}`}
                    title={cat.label}
                  >
                    <span>{cat.icon || "✨"}</span>
                    <span>{cat.label}</span>
                    {cat.isCustom && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          uvOrganizerStore.removeCustomGarmentCategory(cat.id);
                        }}
                        style={{ marginLeft: "4px", opacity: 0.6, fontSize: "10px" }}
                        title="Delete custom set"
                      >
                        ×
                      </span>
                    )}
                  </button>
                );
              })}

              {/* + Add New Wear Set Button */}
              {showAddCategoryInput ? (
                <form onSubmit={handleAddCategorySubmit} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <input
                    type="text"
                    placeholder="e.g. Hats, Bags"
                    value={newCategoryName}
                    autoFocus
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    style={{
                      background: "#080c14",
                      border: "1px solid #38bdf8",
                      borderRadius: "4px",
                      color: "#fff",
                      fontSize: "10.5px",
                      padding: "2px 6px",
                      width: "80px",
                      outline: "none"
                    }}
                  />
                  <button
                    type="submit"
                    className="studio-btn-primary"
                    style={{ padding: "2px 6px", fontSize: "10px" }}
                  >
                    ✓
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddCategoryInput(false)}
                    style={{ background: "transparent", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "12px" }}
                  >
                    ×
                  </button>
                </form>
              ) : (
                <button
                  type="button"
                  className="studio-segmented-item"
                  style={{ color: "#38bdf8", border: "1px dashed rgba(56, 189, 248, 0.4)" }}
                  title="Create new wear set (e.g. Hats, Bags, Gloves)"
                  onClick={() => setShowAddCategoryInput(true)}
                >
                  <Plus size={12} />
                  <span>Add Set</span>
                </button>
              )}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
            <input
              type="file"
              ref={jsonFileInputRef}
              onChange={handleJsonUpload}
              accept=".json"
              style={{ display: "none" }}
            />

            <button
              className="studio-btn-secondary"
              onClick={() => uvOrganizerStore.exportZonesAsJSON()}
              title="Download safe JSON backup of this canonical layout"
            >
              <Download size={13} color="#38bdf8" />
              <span>Export</span>
            </button>

            <button
              className="studio-btn-secondary"
              onClick={() => jsonFileInputRef.current?.click()}
              title="Upload and restore a saved UV layout JSON file"
            >
              <Upload size={13} color="#34d399" />
              <span>Import</span>
            </button>

            <button
              className="studio-btn-secondary"
              onClick={() => uvOrganizerStore.resetZonesToDefault()}
              title="Reset to default template"
            >
              <RotateCcw size={13} />
              <span>Reset</span>
            </button>

            <button
              className="studio-btn-primary"
              onClick={() => {
                uvOrganizerStore.setShowZoneEditorModal(false);
                uvOrganizerStore.arrangeAssignedUVs();
              }}
            >
              <Check size={14} />
              <span>Apply</span>
            </button>

            <button
              className="tool-btn tool-btn-sm"
              style={{ marginLeft: "4px" }}
              title="Close modal"
              onClick={() => uvOrganizerStore.setShowZoneEditorModal(false)}
            >
              <X size={16} />
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
          <div style={{ flex: 1, padding: "16px", display: "flex", flexDirection: "column", gap: "14px", overflowY: "auto" }}>
            <form onSubmit={handleCreateZone} style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                placeholder="New zone (e.g. Pocket, Hood)"
                value={newZoneName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewZoneName(e.target.value)}
                className="studio-input"
                style={{ flex: 1 }}
              />
              <button className="studio-btn-primary" type="submit">
                <Plus size={13} />
                <span>Add</span>
              </button>
            </form>

            {selectedZone && (
              <div className="studio-card-panel">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ width: "12px", height: "12px", borderRadius: "3px", background: selectedZone.color }} />
                    <span style={{ fontWeight: "700", fontSize: "12.5px", color: "#f8fafc" }}>
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
                    <label style={{ fontSize: "10px", color: "#94a3b8", display: "block", marginBottom: "4px" }}>U Min (Left)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max={selectedZone.uMax - 0.04}
                      value={selectedZone.uMin}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => uvOrganizerStore.updateZoneBounds(selectedZone.id, { uMin: parseFloat(e.target.value) })}
                      className="studio-input studio-input-sm"
                      style={{ width: "100%" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "10px", color: "#94a3b8", display: "block", marginBottom: "4px" }}>U Max (Right)</label>
                    <input
                      type="number"
                      step="0.01"
                      min={selectedZone.uMin + 0.04}
                      max="1"
                      value={selectedZone.uMax}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => uvOrganizerStore.updateZoneBounds(selectedZone.id, { uMax: parseFloat(e.target.value) })}
                      className="studio-input studio-input-sm"
                      style={{ width: "100%" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "10px", color: "#94a3b8", display: "block", marginBottom: "4px" }}>V Min (Bottom)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max={selectedZone.vMax - 0.04}
                      value={selectedZone.vMin}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => uvOrganizerStore.updateZoneBounds(selectedZone.id, { vMin: parseFloat(e.target.value) })}
                      className="studio-input studio-input-sm"
                      style={{ width: "100%" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "10px", color: "#94a3b8", display: "block", marginBottom: "4px" }}>V Max (Top)</label>
                    <input
                      type="number"
                      step="0.01"
                      min={selectedZone.vMin + 0.04}
                      max="1"
                      value={selectedZone.vMax}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => uvOrganizerStore.updateZoneBounds(selectedZone.id, { vMax: parseFloat(e.target.value) })}
                      className="studio-input studio-input-sm"
                      style={{ width: "100%" }}
                    />
                  </div>
                </div>

                <div style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <label style={{ fontSize: "10px", color: "#94a3b8" }}>Color Tag:</label>
                  <input
                    type="color"
                    value={selectedZone.color}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => uvOrganizerStore.updateZoneBounds(selectedZone.id, { color: e.target.value })}
                    style={{ width: "24px", height: "24px", borderRadius: "4px", border: "1px solid #1e293b", cursor: "pointer", background: "transparent", padding: 0 }}
                  />
                </div>
              </div>
            )}

            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ fontSize: "10.5px", fontWeight: "700", color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Active Slots ({zonesList.length})
              </span>
              {zonesList.map((z) => (
                <div
                  key={z.id}
                  onClick={() => uvOrganizerStore.setSelectedZone(z.id)}
                  className={`studio-slot-item ${selectedZone?.id === z.id ? "active" : ""}`}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ width: "10px", height: "10px", borderRadius: "3px", background: z.color }} />
                    <span style={{ fontSize: "11.5px", color: "#f8fafc", fontWeight: "600" }}>{z.label}</span>
                  </div>
                  <span style={{ fontSize: "10px", color: "#64748b" }}>
                    U: [{z.uMin.toFixed(2)}-{z.uMax.toFixed(2)}], V: [{z.vMin.toFixed(2)}-{z.vMax.toFixed(2)}]
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
