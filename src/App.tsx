import React, { useState, useEffect } from "react";
import { observer } from "mobx-react-lite";
import { modelStore, uvOrganizerStore } from "@trikomi/core/studio";
import { StudioTopBar, StudioMode } from "./components/studio/StudioTopBar";
import { StudioLeftPanel } from "./components/studio/StudioLeftPanel";
import { StudioCenterViewport } from "./components/studio/StudioCenterViewport";
import { StudioRightPanel } from "./components/studio/StudioRightPanel";
import { StudioBottomDock } from "./components/studio/StudioBottomDock";
import { UVZoneEditorModal } from "./components/UVZoneEditorModal";

export const App = observer(() => {
  // Studio Mode State: "model" (default) | "uv" | "material" | "validation"
  const [studioMode, setStudioMode] = useState<StudioMode>("model");

  // Responsive Auto-Toggles
  const [showLeftSidebar, setShowLeftSidebar] = useState<boolean>(true);
  const [showRightPanel, setShowRightPanel] = useState<boolean>(true);
  const [showBottomDock, setShowBottomDock] = useState<boolean>(true);
  const [isViewportMaximized, setIsViewportMaximized] = useState<boolean>(false);

  // Auto-collapse right panel in pure "model" mode if user desires maximum 3D view, or keep open based on toggle
  const handleToggleLeft = () => {
    setShowLeftSidebar(!showLeftSidebar);
    setTimeout(() => modelStore.onResize?.(), 30);
  };

  const handleToggleRight = () => {
    setShowRightPanel(!showRightPanel);
    setTimeout(() => modelStore.onResize?.(), 30);
  };

  const handleToggleBottom = () => {
    setShowBottomDock(!showBottomDock);
    setTimeout(() => modelStore.onResize?.(), 30);
  };

  const handleToggleMaximize = () => {
    const nextMax = !isViewportMaximized;
    setIsViewportMaximized(nextMax);
    if (nextMax) {
      setShowLeftSidebar(false);
      setShowRightPanel(false);
      setShowBottomDock(false);
    } else {
      setShowLeftSidebar(true);
      setShowRightPanel(true);
      setShowBottomDock(true);
    }
    setTimeout(() => modelStore.onResize?.(), 50);
  };

  // Switch Modes
  const handleSelectMode = (mode: StudioMode) => {
    setStudioMode(mode);
    if (mode === "uv") {
      setShowRightPanel(true);
    }
    setTimeout(() => modelStore.onResize?.(), 30);
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
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        modelStore.loadNextCuratedModel(uvOrganizerStore);
      } else if (e.key === "f" || e.key === "F") {
        modelStore.resetCamera?.();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="studio-app">
      {/* Ambient Backdrop Lighting Elements */}
      <div className="ambient-glow-left" />
      <div className="ambient-glow-right" />
      <div className="sweep-light-line" />

      {/* 1. TOP BAR: Brand, 4 Studio Modes, Auto-Toggles, Camera & Export */}
      <StudioTopBar
        currentMode={studioMode}
        onSelectMode={handleSelectMode}
        showLeftSidebar={showLeftSidebar}
        onToggleLeftSidebar={handleToggleLeft}
        showRightPanel={showRightPanel}
        onToggleRightPanel={handleToggleRight}
        showBottomDock={showBottomDock}
        onToggleBottomDock={handleToggleBottom}
        onExportGLB={() => modelStore.exportGLB()}
      />

      {/* 2. MIDDLE WORKSPACE ROW (Fluid Flex Real-Estate) */}
      <main className="workspace-row">
        {/* Left Panel: Scene Explorer, Transforms, Quick Tools */}
        <StudioLeftPanel collapsed={!showLeftSidebar} />

        {/* Center 3D Viewport: Real Three.js Canvas, Pedestal, Viewport Toolbar */}
        <StudioCenterViewport
          isMaximized={isViewportMaximized}
          onToggleMaximize={handleToggleMaximize}
        />

        {/* Right Panel: UV Studio & 2D Inspector (Active in UV Mode, collapsible) */}
        <StudioRightPanel collapsed={!showRightPanel} />
      </main>

      {/* 3. BOTTOM DOCK TRAY: 5 Dedicated Cards (Material, Geometry, Preview, Validation, Export) */}
      <StudioBottomDock
        collapsed={!showBottomDock}
        onExportGLB={() => modelStore.exportGLB()}
      />

      {/* Canonical UV Blueprint Designer Modal */}
      {uvOrganizerStore.showZoneEditorModal && <UVZoneEditorModal />}
    </div>
  );
});

export default App;
