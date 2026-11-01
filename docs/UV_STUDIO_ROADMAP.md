# UV Studio Standalone Workstation: Multi-Phase Implementation Roadmap

This document outlines the structured phases, concrete action items, technical architectures, and validation checkpoints to turn the UV Studio into a full-featured, zero-external-software 3D garment manipulation suite.

---

## Architecture Overview & Phase Breakdown

```
Phase 1: Precision Interaction & Bidirectional Sync (Immediate UX)
   │
Phase 2: Island Manipulation & Transform Controls (Rotate / Flip / Scale)
   │
Phase 3: Seam Bleed Margins, Texel Density & Distortion Heatmaps
   │
Phase 4: Graphic Decal & Artwork Placement System (Print-Ready)
   │
Phase 5: Seam-Edge Connectivity & High-Res Blueprint Export
```

---

## Phase 1: Bidirectional 2D ↔ 3D Synchronous Highlighting & Selection

### Objective
Create instant, lag-free visual correspondence between the 2D UV canvas and the 3D garment viewport. When a user interacts with a 2D pattern island, the corresponding 3D panel illuminates in real time, and clicking a 3D panel instantly highlights and pans/frames its 2D UV island.

### Action Plan & Steps
1. **Store-Level State Synchronization**:
   - Add reactive states to `modelStore.ts` / `uvOrganizerStore.ts`:
     - `hoveredPieceId: string | null`
     - `selectedPieceIds: Set<string>` (supporting multi-selection via `Shift + Click`)
     - `focusPieceTrigger: { pieceId: string, timestamp: number } | null`
2. **2D UV Canvas Hover & Pick Detection**:
   - In `UVCanvasView.tsx`, enhance the pointer-move handler using point-in-polygon / island bounding box raycasting to compute the exact piece under the cursor at 60fps.
   - When hovering over an island, set `hoveredPieceId`. Render a high-contrast glowing silhouette outline on the 2D island in the UV canvas.
3. **3D Viewport Synchronous Reaction**:
   - In the 3D scene renderer, update the active piece's material dynamically on hover/select:
     - Emissive rim pulse (neon cyan `#38bdf8` or zone accent color).
     - Non-destructive outline mesh overlay using Three.js emissive pulse or edge highlight.
4. **3D → 2D Reverse Navigation**:
   - Clicking a 3D panel triggers `focusPieceTrigger`.
   - The 2D UV viewport smoothly frames, zooms, and flashes the corresponding UV island.

### Deliverables & Verification
- Zero latency hover response between 2D and 3D.
- Immediate clarity on complex panels (e.g. distinguishing left vs right pockets, inner vs outer waistbands).

---

## Phase 2: Island Transform Controls (Rotate, Flip, Scale, Center)

### Objective
Provide comprehensive 2D island transformation tools directly inside the UV canvas so clients never need to launch Blender or CLO3D just to fix rotated or mirrored UV patterns.

### Action Plan & Steps
1. **Geometric Island Pivot & Math Engine**:
   - Implement geometric center and bounding-box computation per piece UV island:
     - Island center $(U_c, V_c) = (\frac{u_{\min} + u_{\max}}{2}, \frac{v_{\min} + v_{\max}}{2})$.
   - Core transform algorithms:
     - **Rotate 90° Clockwise / Counter-Clockwise**: Rotate vertex coordinates around $(U_c, V_c)$.
     - **Arbitrary Angle Rotation**: Angle wheel / slider with angle snapping (15°, 45°, 90°).
     - **Horizontal Flip (Mirror U)**: $u' = 2 U_c - u$ (essential for symmetric sleeve/leg pattern alignment).
     - **Vertical Flip (Mirror V)**: $v' = 2 V_c - v$.
     - **Uniform / Free Scale Slider**: Scale vertices relative to island center.
     - **Reset to Original Unwrap**: Restore cached `geometry.userData.originalUv`.
2. **UI Toolbar & Context Menu**:
   - Add a sleek floating island action bar above the selected island in `UVCanvasView.tsx`:
     - Quick buttons: `[ ↺ -90° ]`, `[ ↻ +90° ]`, `[ ⇋ Flip H ]`, `[ ⇅ Flip V ]`, `[ 🎯 Center in Zone ]`, `[ ↺ Reset ]`.
3. **Interactive 2D Bounding Box Gizmo**:
   - Render transform handles (corner scale pins + top rotation pin) around the selected UV island for direct mouse manipulation.

### Deliverables & Verification
- Client can reorient fabric grain lines, fix inverted normals/UVs, and mirror patterns in one click.

---

## Phase 3: Seam Bleed Padding, Texel Density & Distortion Heatmaps

### Objective
Ensure textures look crisp and distortion-free across real-time 3D garments by preventing mipmap seam bleeding and providing visual distortion diagnostics.

### Action Plan & Steps
1. **Configurable Seam Bleed Margin (Island Padding)**:
   - Add an `Island Margin` slider (options: `2px`, `4px`, `8px`, `16px` at $2048\times 2048$ equivalent).
   - In `arrangeAssignedUVs()`, compute buffer bounding boxes with padding offsets so neighboring islands never bleed pixels during bilinear filtering or mipmapping.
2. **Texel Density Analyzer & Equalizer**:
   - Compute real 3D surface area (in $\text{cm}^2$) vs 2D UV polygon area (in UV units$^2$).
   - Add an **"Equalize Texel Density"** button: Automatically balances the UV scales of main garment pieces so fabric weave size is uniform across front, back, sleeves, and waistband.
3. **Real-Time Distortion Heatmap Shader**:
   - Implement a custom inspection shader or texture toggle:
     - **Green**: 1:1 isometric preservation (no stretch or compression).
     - **Blue**: UV compression (texture looks enlarged on 3D mesh).
     - **Red**: UV stretching (texture looks shrunk or squashed).
4. **Interactive Numbered Checkerboard**:
   - Provide high-contrast numbered checker patterns ($1\times1$, $2\times2$, $4\times4$, $8\times8$ frequency) to inspect seam alignment and texel uniformity.

### Deliverables & Verification
- Seamless rendering without artifact lines at panel edges.
- Guaranteed visual consistency of textures across panels of different physical sizes.

---

## Phase 4: Direct Graphic / Decal / Artwork Placement System

### Objective
Allow clients to upload graphics (brand logos, artwork prints, chest emblems, side stripes) and place, position, and blend them directly onto specific garment panels without Photoshop.

### Action Plan & Steps
1. **Graphic Asset Layer Model**:
   - Define a Decal Layer schema:
     ```ts
     interface GarmentDecalLayer {
       id: string;
       name: string;
       imageUrl: string;
       zoneId: string;
       targetPieceId?: string;
       u: number; // Normalized center [0, 1]
       v: number;
       scale: number;
       rotation: number;
       opacity: number;
       blendMode: "normal" | "multiply" | "overlay";
     }
     ```
2. **Interactive 2D Canvas Decal Gizmo**:
   - Clients can drag and drop PNG/SVG images directly onto a zone in the UV canvas.
   - Decal displays a bounding box with translation, rotation, and scaling handles.
3. **Dynamic Multi-Texture Blending Pipeline**:
   - Render decals onto an off-screen canvas compositor that bakes the decal seamlessly into the fabric diffuse texture in real time, or map via Three.js decal mesh / secondary UV layer.
4. **Decal Management Panel**:
   - Sidebar panel listing all active graphics, layer order (Z-index), visibility toggles, and delete buttons.

### Deliverables & Verification
- Clients can produce branded apparel mockups, customized team jerseys, and all-over-prints inside the browser.

---

## Phase 5: Seam Connectivity Navigation & Production Blueprint Export

### Objective
Connect pattern topology across sewing seams and produce production-ready documentation for factory tech packs and print houses.

### Action Plan & Steps
1. **Seam Edge Connectivity Graph**:
   - Compute shared 3D vertex positions along mesh boundary borders.
   - When a user hovers over an edge on the Left Leg front inseam in the UV view, the corresponding back inseam edge lights up in green on both 2D and 3D views.
2. **Production Blueprint Exporter**:
   - Export high-resolution $(2048\times 2048 \text{ or } 4096\times 4096)$ UV layouts:
     - Transparent background with colored zone boundaries.
     - Vector SVG or raster PNG options.
     - Option to overlay panel labels, triangle counts, and physical dimensions ($\text{cm}/\text{in}$).
3. **Factory Tech-Pack Spec Sheet**:
   - 1-click summary generation containing UV layout image, panel dimensions, zone allocations, and fabric catalog specs.

---

## Implementation Sequence & Milestones Summary

| Milestone | Phase | Key User Benefit | Estimated Complexity |
|---|---|---|---|
| **M1** | Phase 1 | Instant 2D ↔ 3D visual clarity & hover inspection | Moderate |
| **M2** | Phase 2 | Full 2D island transform tools (Rotate 90°, Mirror, Scale) | Moderate |
| **M3** | Phase 3 | Seam bleed margin padding + Texel density analyzer | Moderate |
| **M4** | Phase 4 | Direct logo/graphic placement and decal compositing | High |
| **M5** | Phase 5 | Seam edge linkage & High-Res Blueprint export | High |
