# 🤖 AGENTS.md — Trikomi Studio AI & Developer Operational Guidelines

[![Ecosystem](https://img.shields.io/badge/Ecosystem-Trikomi%203D%20Platform-00f0ff?style=for-the-badge)](https://trikomi.com)
[![Role](https://img.shields.io/badge/Role-3D%20Asset%20%26%20UV%20Studio-a855f7?style=for-the-badge)](https://trikomi.com)

---

## 📌 Context & Scope
`trikomi-studio` is the dedicated **3D Garment Asset & UV Canonical Studio** within the Trikomi platform. It bridges 3D garment ingestion (Style3D, CLO3D, OBJ/GLTF) with real-time WebGL/WebGPU canonical UV organization, PBR fabric simulation, mesh decimation, and print-ready GLB export.

---

## 🛡️ Trikomi Core Operational Rules & Safeguards

### 1. Trikomi Plugin / Addon Architecture Protocol:
- All 3D viewer and studio capabilities must be encapsulated as modular **Trikomi Viewer Plugins** implementing `ITrikomiStudioPlugin` / `TrikomiStudioPlugin` (conforming to `@trikomi/core`'s `ViewerPlugin` lifecycle: `onAttach`, `onDetach`, `onUpdate`, `onRender`).
- **NEVER** write ad-hoc monolithic 3D logic inside React components. React components serve purely as reactive headless views connected to MobX stores (`useViewerStore`, `modelStore`, `uvOrganizerStore`).

### 2. Zero-NPM Local Source Development Rule:
- In `vite.config.js`, `@trikomi/core` and its subpackages (`@trikomi/core/sportswear`, `@trikomi/core/viewer`, etc.) are aliased directly to the local SDK source at `/media/vijaykc/projects/trikomi/packages/core/src/index.ts`.
- Changes in the core engine must reflect immediately in Studio without local npm packing.

### 3. Absolute Transparency & Intent Communication (Trikomi Demo Rule):
- Before performing any action (reading files, executing commands, creating files, or editing code), state explicitly:
  - **WHAT**: Exact file paths, symbols, functions, or shell commands.
  - **WHY**: The precise rationale and context behind the step.
  - **WHERE**: The exact target repository and line numbers.
  - **FINDINGS / RESULT**: What was discovered or changed before taking the next step.

### 4. Preservation of UV Isotropy:
- When manipulating UV coordinates (organizer, decimation, transform tools), scale factors must remain strictly 1:1 isotropic to prevent stretching or distorting garment textures.

### 5. Unique Material Instances (No Highlight Leaks):
- Always clone materials (`baseMat.clone()`) per mesh piece so visual highlights (emissive `#00f0ff`, ghosting opacity `0.35`) never leak across different garment panels.

### 6. Non-Destructive Geometry:
- Always preserve `originalGeometry` and `originalTriangles` upon loading so modifiers (decimation, UV transforms) are always reversible without data loss.

### 7. Node.js & TypeScript Only — Strictly No Python:
- All scripts, scratches, test runners, and diagnostic utilities must use Node.js (`node` / `tsx`). Never write Python scripts.

### 8. Strictly No Tailwind CSS — Semantic Reusable Classes Only:
- Never use Tailwind CSS or inline utility strings.
- All styles must use clean, modular, reusable CSS classes with CSS custom properties (`var(--neon-cyan)`, `var(--radius-chassis)`) in `src/studio.css`.

### 9. HD & Desktop Responsive First (1366x768 & Up):
- Layouts must fit standard laptop HD resolution ($1366 \times 768$ and $1366 \times 610$ inner height) with **zero page scrollbars**, proportional flex scaling, and collapsible docks.

### 10. No Git Commits Without Explicit User Review:
- Never execute `git commit` or push changes unless explicitly instructed by the user after a successful review.

### 11. Zero TypeScript Warnings & Zero Build Errors:
- Always verify changes with `npx tsc --noEmit && pnpm run build` inside `trikomi-studio`.
