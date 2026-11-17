import React, { useState } from "react";
import { observer } from "mobx-react-lite";
import { modelStore, uvOrganizerStore } from "@trikomi/core/studio";
import { UVCanvasView } from "../UVCanvasView";

interface StudioRightPanelProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onShowToast?: (msg: string) => void;
  isMaximized?: boolean;
  onToggleMaximize?: () => void;
}

export const StudioRightPanel: React.FC<StudioRightPanelProps> = observer(({
  collapsed = false,
  onToggleCollapse,
  onShowToast,
  isMaximized = false,
  onToggleMaximize
}) => {
  const getTargetPieceIds = (): string[] => {
    if (modelStore.selectedPieceIds.length > 0) return [...modelStore.selectedPieceIds];
    if (modelStore.selectedPiece) return [modelStore.selectedPiece.id];
    return [];
  };

  const targetIds = getTargetPieceIds();

  return (
    <aside
      className="panel uv-editor-panel"
      id="uvStudio"
      style={{ display: collapsed ? "none" : undefined }}
    >
      {/* UV Editor Top Tab Bar */}
      <div className="uv-top-tab-bar">
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span className="uv-tab-active-title">UV Editor ({uvOrganizerStore.uvResolution}×{uvOrganizerStore.uvResolution})</span>
          <button
            style={{
              background: "#141c2e",
              border: "1px solid #232f46",
              borderRadius: "4px",
              color: "#38bdf8",
              cursor: "pointer",
              fontSize: "10px",
              padding: "2px 6px"
            }}
            title="Cycle UV Map Resolution (1K / 2K / 4K)"
            onClick={() => {
              const currentRes = uvOrganizerStore.uvResolution;
              const nextRes = currentRes === 1024 ? 2048 : currentRes === 2048 ? 4096 : 1024;
              uvOrganizerStore.setUVResolution(nextRes);
              onShowToast?.(`UV Canvas Resolution: ${nextRes}×${nextRes}`);
            }}
          >
            {uvOrganizerStore.uvResolution === 1024 ? "1K" : uvOrganizerStore.uvResolution === 2048 ? "2K" : "4K"}
          </button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <button
            className="uv-blueprint-btn"
            title="Launch Canonical UV Blueprint Designer"
            onClick={() => {
              uvOrganizerStore.setShowZoneEditorModal(true);
              onShowToast?.("Opened Canonical UV Slots Designer");
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
            <span>Blueprint</span>
          </button>
          <button
            className="tool-btn tool-btn-sm"
            style={{ background: "#141c2e", border: "1px solid #232f46" }}
            title={isMaximized ? "Exit Fullscreen (UV)" : "Fullscreen UV Viewport"}
            onClick={onToggleMaximize}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
          </button>
          <button
            className="tool-btn tool-btn-sm"
            style={{ background: "#141c2e", border: "1px solid #232f46" }}
            title="Collapse UV Panel"
            onClick={onToggleCollapse}
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
      </div>

      {/* UV Sub-Toolbar */}
      <div className="uv-sub-toolbar">
        <div className="uv-sub-toolbar-cluster">
          <button
            className={`tool-btn tool-btn-sm ${targetIds[0] && uvOrganizerStore.isPiecePinned(targetIds[0]) ? "active" : ""}`}
            title="Pin Island (Lock Position)"
            onClick={() => {
              if (targetIds[0]) {
                const pinned = uvOrganizerStore.togglePinPiece(targetIds[0]);
                onShowToast?.(pinned ? "Pinned island position (locked)" : "Unpinned island");
              } else {
                onShowToast?.("Select an island to pin/unpin");
              }
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <circle cx="12" cy="12" r="8" />
              <path d="M12 8v8M8 12h8" />
            </svg>
          </button>

          <button
            className={`tool-btn tool-btn-sm ${uvOrganizerStore.snappingEnabled ? "active" : ""}`}
            title="Toggle Magnetic UV Snapping"
            onClick={() => {
              const snap = uvOrganizerStore.toggleSnapping();
              onShowToast?.(snap ? "Magnetic Snapping: Enabled" : "Magnetic Snapping: Disabled");
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>

          {/* Save UV Layout to Google Drive Button */}
          <button
            className="tool-btn tool-btn-sm"
            style={{
              color: "#00f0ff",
              borderColor: "rgba(0, 240, 255, 0.4)",
              background: "rgba(0, 240, 255, 0.08)"
            }}
            title="Save UV Layout delta directly to Google Drive"
            onClick={async () => {
              onShowToast?.("Saving UV layout to Google Drive...");
              const res = await uvOrganizerStore.saveUVLayoutToDisk();
              if (res.success) {
                onShowToast?.("UV layout saved to Google Drive successfully!");
              } else {
                onShowToast?.("Could not save UV layout");
              }
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <button
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "2px 8px",
              borderRadius: "4px",
              background: "#141c2e",
              border: "1px solid #232f46",
              fontSize: "11px",
              color: "#cbd5e1",
              cursor: "pointer"
            }}
            onClick={() => {
              uvOrganizerStore.resetUVViewport?.();
              onShowToast?.("Zoom reset to 100%");
            }}
          >
            <span>100%</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      </div>

      {/* Split Body: UV Grid Canvas (Left) + UV Operations Sidebar (Right) */}
      <div className="uv-split-body">
        {/* Left UV Canvas Mount */}
        <div className="uv-grid-bg">
          <UVCanvasView />
        </div>

        {/* Right Sidebar: UV Operations, Transform, Island Management */}
        <div className="uv-ops-sidebar">
          {/* UV Operations */}
          <div>
            <div className="uv-ops-section-title">UV Operations</div>
            <button
              className="uv-op-btn"
              onClick={() => {
                uvOrganizerStore.arrangeAssignedUVs();
                onShowToast?.("Packed UV islands with optimal texel efficiency");
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2" style={{ flexShrink: 0 }}>
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
              </svg>
              <span>Pack</span>
            </button>

            <button
              className="uv-op-btn"
              onClick={() => {
                uvOrganizerStore.autoAlignZonePanels(undefined, targetIds.length > 1 ? targetIds : undefined);
                onShowToast?.("UV islands auto-aligned to axis");
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2" style={{ flexShrink: 0 }}>
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M12 8v8M8 12h8" />
              </svg>
              <span>Auto Align</span>
            </button>

            <button
              className="uv-op-btn"
              onClick={() => {
                const res = uvOrganizerStore.equalizeTexelDensity();
                onShowToast?.(`Equalized texel density across ${res.updatedCount} islands`);
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="2" style={{ flexShrink: 0 }}>
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <line x1="8" y1="10" x2="16" y2="10" /><line x1="8" y1="14" x2="16" y2="14" />
              </svg>
              <span>Equalize</span>
            </button>
          </div>

          {/* Transform 2x2 Grid */}
          <div>
            <div className="uv-ops-section-title">Transform</div>
            <div className="uv-2x2-grid">
              <button
                className="uv-grid-btn"
                onClick={() => {
                  if (targetIds.length > 0) {
                    uvOrganizerStore.rotatePiecesGroupUV(targetIds, 90);
                    onShowToast?.(`Rotated ${targetIds.length} UV island(s) 90°`);
                  } else {
                    onShowToast?.("Select an island to rotate");
                  }
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" /><polyline points="21 3 21 8 16 8" />
                </svg>
                <span>Rotate</span>
              </button>

              <button
                className="uv-grid-btn"
                onClick={() => {
                  if (targetIds.length > 0) {
                    uvOrganizerStore.flipPiecesGroupUV(targetIds, "horizontal");
                    onShowToast?.(`Mirrored ${targetIds.length} UV island(s) horizontally`);
                  } else {
                    onShowToast?.("Select an island to mirror");
                  }
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <line x1="12" y1="3" x2="12" y2="21" /><polygon points="8 7 3 12 8 17 8 7" /><polygon points="16 7 21 12 16 17 16 7" />
                </svg>
                <span>Mirror</span>
              </button>

              <button
                className="uv-grid-btn"
                onClick={() => {
                  if (targetIds.length > 0) {
                    uvOrganizerStore.centerPiecesGroupInZone(targetIds);
                    uvOrganizerStore.focusSelectedIsland();
                    onShowToast?.(`Centered ${targetIds.length} UV island(s)`);
                  } else {
                    uvOrganizerStore.focusSelectedIsland();
                    onShowToast?.("Centered UV viewport");
                  }
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="12" cy="12" r="3" /><path d="M12 2v3m0 14v3M2 12h3m14 0h3" />
                </svg>
                <span>Center</span>
              </button>

              <button
                className="uv-grid-btn"
                onClick={() => {
                  const count = uvOrganizerStore.resetAllPiecesToOriginalFactoryUV();
                  onShowToast?.(`Restored original UV layout across ${count} pieces`);
                }}
                title="Reset to Original Mesh UV Layout"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" />
                </svg>
                <span>Reset</span>
              </button>
            </div>
          </div>

          {/* Island Management 2x1 Grid */}
          <div>
            <div className="uv-ops-section-title">Island Management</div>
            <div className="uv-2x2-grid">
              <button
                className="uv-grid-btn"
                onClick={() => {
                  const allIds = modelStore.pieces.map(p => p.id);
                  modelStore.selectPiecesByIds(allIds);
                  onShowToast?.(`Selected all ${allIds.length} UV islands`);
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="3" y="3" width="18" height="18" rx="2" strokeDasharray="3 2" /><path d="M9 12l2 2 4-4" />
                </svg>
                <span>Select All</span>
              </button>

              <button
                className="uv-grid-btn"
                onClick={() => {
                  modelStore.deselectPiece(true);
                  onShowToast?.("Cleared UV selection");
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
                <span>Clear</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
});
