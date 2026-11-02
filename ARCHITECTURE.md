# Trikomi Studio Architecture & Technical Specification

## 1. System Vision & Paradigm
Trikomi Studio is a lightweight, headless-first, public-facing **Workstation Shell / UI Wrapper** for 3D garment visualization, canonical UV island organization, border-locked mesh decimation, and PBR fabric authoring.

### Critical Architectural Contract:
- **`trikomi-studio` is strictly a UI wrapper**:
  - Contains only UI presentation, view components, docks, modals, toolbars, and reactive store bindings.
  - **Zero standalone business logic, zero local math engines, and zero proprietary `.ts` files inside `trikomi-studio/src/`**.
  - No 3D scenes are initiated from scratch in the wrapper.
- **`@trikomi/core` & `@trikomi/core/studio` contain all engine capabilities**:
  - Lives inside `trikomi/packages/core/src/studio/`.
  - Reuses Trikomi's built-in core plugins (`TransformGizmoPlugin`, `OrbitControlsPlugin`, `EnvironmentPlugin`, `GLTFPlugin`, `MaterialRaycasterPlugin`, `ExportPlugin`, etc.).
  - Domain-specific engines:
    - `DecimationEngine`: Border-locked meshopt decimation preserving 3D silhouette contours and 2D UV seams.
    - `UVCanonicalEngine`: 2D UV canonical transforms, packing, island boundary extraction, and isotropic scaling.
    - `PBRMaterialSynthesizer`: Dynamic PBR fabric material generation with cloned instances per garment piece.
    - `StudioModelStore` & `StudioUVOrganizerStore`: MobX stores exported from `@trikomi/core/studio`.
    - `StudioSqliteService`: Persistent local storage for garments and configurations.

---

## 2. Package Separation & File Hierarchy

```
trikomi/packages/core/src/studio/
├── DecimationEngine.ts          # Border-locking meshopt decimation engine
├── GarmentAuditModule.ts        # Automated inspection & multi-angle snapshot helper
├── GarmentEngine.ts             # Garment stats, triangle counting, piece isolation
├── PBRMaterialSynthesizer.ts    # Fabric material synthesis & texture assignment
├── StudioModelStore.ts          # Studio 3D model state management
├── StudioUVOrganizerStore.ts    # Studio UV layout, packing & island transform state
├── StudioSqliteService.ts       # SQLite / IndexedDB garment persistence layer
├── StudioViewerManager.ts       # Trikomi ThreeViewer lifecycle helper
├── types.ts                     # Shared TypeScript domain contracts
└── index.ts                     # Single barrel export for @trikomi/core/studio

trikomi-studio/src/
├── components/                  # Headless UI views & panels
│   ├── studio/
│   │   ├── StudioCenterViewport.tsx  # 3D viewport mounting Trikomi viewer
│   │   ├── StudioLeftPanel.tsx       # Garment piece tree & hierarchy
│   │   ├── StudioRightPanel.tsx      # Fabric properties, decimation & audit
│   │   ├── StudioTopBar.tsx          # Shading modes, undo/redo & export
│   │   └── StudioBottomDock.tsx      # UV editor dock container
│   ├── UVCanvasView.tsx              # Reactive 2D UV canvas renderer
│   └── UVZoneEditorModal.tsx         # Canonical zone editor modal
├── studio.css                   # Semantic CSS classes (Zero Tailwind)
├── App.tsx                      # Main studio layout & splitters
├── main.tsx                     # Entry point
└── vite-env.d.ts                # TypeScript environment declarations
```

---

## 3. UI Shell Bindings
- All components in `trikomi-studio` import directly from `@trikomi/core/studio`:
  ```tsx
  import { modelStore, uvOrganizerStore } from "@trikomi/core/studio";
  ```
- Transform controls utilize Trikomi Core's standard `TransformGizmoPlugin` rather than duplicate plugins.
- Zero TypeScript warnings and zero build errors verified with `npx tsc --noEmit && pnpm run build`.
