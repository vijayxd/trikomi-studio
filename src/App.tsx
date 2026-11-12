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
  // Studio Mode: "model" | "uv" | "material" | "validation"
  const [studioMode, setStudioMode] = useState<StudioMode>("model");

  // Viewport Maximize state
  const [isViewportMaximized, setIsViewportMaximized] = useState<boolean>(false);

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
    const nextState = !isTurntablePlaying;
    setIsTurntablePlaying(nextState);
    triggerToast(nextState ? "Turntable preview started" : "Turntable preview paused");
  };

  const handleToggleMaximize = () => {
    const nextMax = !isViewportMaximized;
    setIsViewportMaximized(nextMax);
    triggerToast(nextMax ? "Viewport maximized" : "Viewport restored");
    setTimeout(() => modelStore.onResize?.(), 40);
  };

  // Keyboard navigation & Shortcuts (Arrow keys for cycling models)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT")) {
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
        modelStore.resetCamera?.();
        triggerToast("Camera reset to Frame");
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
      />

      {/* 2. MAIN WORKSPACE CONTAINER */}
      {studioMode === "material" ? (
        <main className="studio-main-workspace" style={{ padding: 0 }}>
          <StudioMaterialLibraryView />
        </main>
      ) : (
        <main className="studio-main-workspace">
          {/* Upper Workspace (65.5% Height) */}
          <section className={`upper-workspace-section ${isViewportMaximized ? "maximized-3d" : ""}`}>
            {/* 2A & 2B. Far-Left Tool Strip + Scene Explorer & Transform */}
            {!isViewportMaximized && (
              <StudioLeftPanel onShowToast={triggerToast} />
            )}

            {/* 2C. Center Panel: Interactive 3D Viewport */}
            <StudioCenterViewport
              isMaximized={isViewportMaximized}
              onToggleMaximize={handleToggleMaximize}
              onShowToast={triggerToast}
            />

            {/* 2D. Right Panel: UV Editor & Operations */}
            {!isViewportMaximized && (
              <StudioRightPanel onShowToast={triggerToast} />
            )}
          </section>

          {/* Lower Workspace (34.5% Height) */}
          {!isViewportMaximized && (
            <StudioBottomDock
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
