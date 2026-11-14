import React, { useState, useEffect } from "react";
import { observer } from "mobx-react-lite";
import { modelStore, uvOrganizerStore } from "@trikomi/core/studio";
import { StudioTopBar, StudioMode } from "./components/studio/StudioTopBar";
import { StudioLeftPanel } from "./components/studio/StudioLeftPanel";
import { StudioCenterViewport } from "./components/studio/StudioCenterViewport";
import { StudioRightPanel } from "./components/studio/StudioRightPanel";
import { StudioBottomDock } from "./components/studio/StudioBottomDock";
import { StudioMaterialLibraryView } from "./components/studio/StudioMaterialLibraryView";
import { UVZoneEditorModal } from "./components/UVZoneEditorModal";

export const App = observer(() => {
  // Studio Mode: "uv" (current view) | "model" (pending) | "material"
  const [studioMode, setStudioMode] = useState<StudioMode>("uv");

  // Viewport Maximize state (3D and UV)
  const [isViewportMaximized, setIsViewportMaximized] = useState<boolean>(false);
  const [isUVMaximized, setIsUVMaximized] = useState<boolean>(false);

  // Panel Collapsible / Visibility state (Left Scene Explorer, UV Panel, Bottom Dock)
  const [isLeftPanelVisible, setIsLeftPanelVisible] = useState<boolean>(true);
  const [isUVPanelVisible, setIsUVPanelVisible] = useState<boolean>(true);
  const [isBottomDockVisible, setIsBottomDockVisible] = useState<boolean>(true);

  // Turntable animation state
  const [isTurntablePlaying, setIsTurntablePlaying] = useState<boolean>(false);

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<string>("");
  const [showToast, setShowToast] = useState<boolean>(false);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setShowToast(true);
    setTimeout(() => {
      setShowToast(false);
    }, 2200);
  };

  const handleToggleTurntable = () => {
    const nextState = modelStore.toggleTurntable();
    setIsTurntablePlaying(nextState);
    triggerToast(nextState ? "Turntable spin started" : "Turntable spin paused");
  };

  const handleToggleMaximize = () => {
    const nextMax = !isViewportMaximized;
    setIsViewportMaximized(nextMax);
    if (nextMax) setIsUVMaximized(false);
    triggerToast(nextMax ? "3D Viewport maximized" : "3D Viewport restored");
    setTimeout(() => modelStore.onResize?.(), 40);
  };

  const handleToggleUVMaximize = () => {
    const nextMax = !isUVMaximized;
    setIsUVMaximized(nextMax);
    if (nextMax) setIsViewportMaximized(false);
    triggerToast(nextMax ? "UV Viewport maximized" : "UV Viewport restored");
    setTimeout(() => uvOrganizerStore.resetUVViewport?.(), 40);
  };

  // Keyboard navigation & Shortcuts (Arrow keys for cycling models)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) {
        return;
      }

      // Undo / Redo Shortcuts (Ctrl+Z / Cmd+Z / Ctrl+Shift+Z / Cmd+Shift+Z / Ctrl+Y)
      if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z" || e.code === "KeyZ")) {
        e.preventDefault();
        e.stopPropagation();
        if (e.shiftKey) {
          const success = uvOrganizerStore.redo();
          triggerToast(success ? "Redid action (Ctrl+Shift+Z)" : "Nothing to redo");
        } else {
          const success = uvOrganizerStore.undo();
          triggerToast(success ? "Undid last action (Ctrl+Z)" : "Nothing to undo");
        }
        return;
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "y" || e.key === "Y" || e.code === "KeyY")) {
        e.preventDefault();
        e.stopPropagation();
        const success = uvOrganizerStore.redo();
        triggerToast(success ? "Redid action (Ctrl+Y)" : "Nothing to redo");
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        modelStore.loadPrevCuratedModel(uvOrganizerStore);
        triggerToast("Loaded previous model");
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        modelStore.loadNextCuratedModel(uvOrganizerStore);
        triggerToast("Loaded next model");
      } else if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        const hasSelection = modelStore.selectedPiece || modelStore.selectedPieceIds.length > 0;
        modelStore.focusOnSelected?.();
        uvOrganizerStore.focusSelectedIsland?.();
        triggerToast(hasSelection ? "Focused on selected piece" : "Framed entire model");
      } else if (e.key === "w" || e.key === "W") {
        modelStore.setActiveTool("move");
        triggerToast("Translate gizmo (W)");
      } else if (e.key === "e" || e.key === "E") {
        modelStore.setActiveTool("rotate");
        triggerToast("Rotate gizmo (E)");
      } else if (e.key === "r" || e.key === "R") {
        modelStore.setActiveTool("scale");
        triggerToast("Scale gizmo (R)");
      } else if (e.key === "q" || e.key === "Q") {
        modelStore.setActiveTool("select");
        triggerToast("Select mode (Q)");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="studio-shell">
      {/* 1. TOP NAVIGATION BAR */}
      <StudioTopBar
        currentMode={studioMode}
        onSelectMode={(mode) => {
          setStudioMode(mode);
          setTimeout(() => modelStore.onResize?.(), 30);
        }}
        isTurntablePlaying={isTurntablePlaying}
        onToggleTurntable={handleToggleTurntable}
        onExportGLB={() => modelStore.exportGLB()}
        onShowToast={triggerToast}
        isLeftPanelVisible={isLeftPanelVisible}
        onToggleLeftPanel={() => {
          const next = !isLeftPanelVisible;
          setIsLeftPanelVisible(next);
          triggerToast(next ? "Scene Explorer shown" : "Scene Explorer collapsed");
          setTimeout(() => modelStore.onResize?.(), 40);
        }}
        isUVPanelVisible={isUVPanelVisible}
        onToggleUVPanel={() => {
          const next = !isUVPanelVisible;
          setIsUVPanelVisible(next);
          triggerToast(next ? "UV Editor shown" : "UV Editor collapsed");
          setTimeout(() => {
            modelStore.onResize?.();
            uvOrganizerStore.resetUVViewport?.();
          }, 40);
        }}
        isBottomDockVisible={isBottomDockVisible}
        onToggleBottomDock={() => {
          const next = !isBottomDockVisible;
          setIsBottomDockVisible(next);
          triggerToast(next ? "Bottom Dock shown" : "Bottom Dock collapsed");
          setTimeout(() => modelStore.onResize?.(), 40);
        }}
      />

      {/* 2. MAIN WORKSPACE CONTAINER */}
      {studioMode === "material" ? (
        <main className="studio-main-workspace" style={{ padding: 0 }}>
          <StudioMaterialLibraryView />
        </main>
      ) : (
        <main className="studio-main-workspace">
          {/* Upper Workspace */}
          <section className={`upper-workspace-section ${isViewportMaximized ? "maximized-3d" : ""} ${isUVMaximized ? "maximized-uv" : ""} ${!isBottomDockVisible ? "bottom-collapsed" : ""}`}>
            {/* 2A & 2B. Far-Left Tool Strip + Scene Explorer & Transform */}
            {!isViewportMaximized && !isUVMaximized && (
              <StudioLeftPanel
                collapsed={!isLeftPanelVisible}
                onToggleCollapse={() => {
                  setIsLeftPanelVisible(false);
                  triggerToast("Scene Explorer collapsed");
                  setTimeout(() => modelStore.onResize?.(), 40);
                }}
                onShowToast={triggerToast}
              />
            )}

            {/* 2C. Center Panel: Interactive 3D Viewport */}
            {!isUVMaximized && (
              <StudioCenterViewport
                isMaximized={isViewportMaximized}
                onToggleMaximize={handleToggleMaximize}
                onShowToast={triggerToast}
              />
            )}

            {/* 2D. Right Panel: UV Editor & Operations */}
            {!isViewportMaximized && (
              <StudioRightPanel
                collapsed={!isUVPanelVisible}
                onToggleCollapse={() => {
                  setIsUVPanelVisible(false);
                  triggerToast("UV Editor collapsed");
                  setTimeout(() => modelStore.onResize?.(), 40);
                }}
                isMaximized={isUVMaximized}
                onToggleMaximize={handleToggleUVMaximize}
                onShowToast={triggerToast}
              />
            )}
          </section>

          {/* Lower Workspace (34.5% Height) */}
          {!isViewportMaximized && !isUVMaximized && (
            <StudioBottomDock
              collapsed={!isBottomDockVisible}
              onToggleCollapse={() => {
                setIsBottomDockVisible(false);
                triggerToast("Bottom Dock collapsed");
                setTimeout(() => modelStore.onResize?.(), 40);
              }}
              onExportGLB={() => modelStore.exportGLB()}
              onShowToast={triggerToast}
            />
          )}
        </main>
      )}

      {/* Canonical UV Blueprint Designer Modal */}
      {uvOrganizerStore.showZoneEditorModal && <UVZoneEditorModal />}

      {/* Floating Status Toast Notification */}
      <div className={`studio-toast ${showToast ? "show" : ""}`}>
        {toastMessage}
      </div>
    </div>
  );
});

export default App;
