# WebGPU renderer — status and roadmap

**Role:** Living snapshot of the vitamoo WebGPU **`Renderer`**: what is shipped, what is next, and where to read the full specification. The **`Renderer`** is a framework for Sims-era and adjacent content (UI, tooling, editors); **skinned characters** are the first integrated slice.

**Deployment:** **vitamoospace** ships to **GitHub Pages** via `.github/workflows/pages.yml` when `VITAMOOSPACE_PAGES_URL` is set on the repository. The live demo is the reference for what is deployed.

---

## Specification (single source of truth)

**[webgpu-renderer-design.md](./webgpu-renderer-design.md)** — pipeline behavior, object-ID layout, holodeck plan, GPU deformation (§5), WGSL summary.

- §1: Current WebGPU surface (implemented APIs and files).
- §2–3: Advanced Sims-style pipeline (terrain, walls, highlighting, pie menu) — mostly future.
- §4: Holodeck implementation order (steps 1–3 done; next is step 4 onward).
- §5: GPU-side skeletal deformation — not started; parallel track to §4.

**WGSL:** Implemented passes are summarized in **§1.2** of [webgpu-renderer-design.md](./webgpu-renderer-design.md).

---

## Status snapshot

| Area | State |
|------|--------|
| WebGPU draw path (WGSL mesh, depth, fade, plumb-bob) | Done |
| Textures (`loadTexture`, `getTextureFactory`, mooshow loader) | Done |
| Object-ID buffer + `readObjectIdAt`; mooshow picking | Done |
| CPU animation | `Practice.tick`, `updateTransforms`, `deformMesh` in JS; deformed verts uploaded every frame |
| Console noise (renderer / texture / deform / pick) | Done: gated behind `Renderer.create(canvas, { verbose: true })`, `StageConfig.verbose`, or `?vitamooVerbose=1` (default quiet) |
| GPU allocation instrumentation | Done: `Renderer.create(..., { instrumentation })` and `StageConfig.gpuInstrumentation`; see [gpu-assets-tooling-roadmap.md](./gpu-assets-tooling-roadmap.md) |
| GPU skeletal deformation / compute | Not started (see §5 in design doc) |
| Holodeck background (terrain, sprites, walls) | Not started (§4 steps 4–5) |
| Highlight / selection tint in app | WGSL has `highlight` + `ambient` uniforms; mooshow does not expose setters yet (defaults only) |

---

## Repo and stack

- **Repo:** `SimObliterator_Suite`, subpath `vitamoo/`.
- **Layers:**
  - **vitamoo** (core): `vitamoo/vitamoo/` — parsers, skeleton, `deformMesh`, **Renderer** (WebGPU), **loadTexture**, `display-list.ts`, `procedural/diamond.ts`, `loaders/gltf.ts`.
  - **mooshow** (runtime): `vitamoo/mooshow/src/runtime/stage.ts` — stage loop, `Renderer.create`, `readObjectIdAt` for pick/hover, `setDebugSlice` for debug views.
  - **vitamoospace** (app): SvelteKit demo; no direct renderer use.

---

## Current WebGPU surface (as implemented)

| File | Role |
|------|------|
| `vitamoo/vitamoo/renderer.ts` | `Renderer.create(canvas, options?)` — optional `{ verbose?, instrumentation? }`. `clear`, `fadeScreen`, `setCamera`, `setCulling`, `drawMesh(…, objectId?)`, `drawDiamond(…, objectId?)`, `setViewport`, `endFrame`, `getTextureFactory`, `readObjectIdAt`, `setDebugSlice`, `setPlumbBobMeshes`, `setPlumbBobScale`. Dual attachments: three `r32uint` pick layers + swapchain color (see [README](../README.md)). |
| `vitamoo/vitamoo/texture.ts` | `parseBMP`; `loadTexture(device, queue, url, verbose?, instrumentation?)` → `TextureHandle` (`GPUTexture`). |
| `vitamoo/vitamoo/gpu-instrumentation.ts` | Types and optional callbacks for GPU buffer/texture allocate and destroy (viewport + loaded images). |

**mooshow:** `Renderer.create(canvas, { verbose })` → `setViewport`, `setTextureFactory`. Each frame: clear/fade → `setCamera` → per body `deformMesh(..., { verbose })` then `drawMesh` with `ObjectIdType` / body index / mesh index → plumb-bob draws → `endFrame`. Picking: `readObjectIdAt` (character and plumb-bob types). `setDebugSlice` wired from stage config / URL (`?debugSlice=`).

**Object-ID layout:** Matches §2.3 of [webgpu-renderer-design.md](./webgpu-renderer-design.md) (see `ObjectIdType` in vitamoo exports).

---

## Before GPU deformation work

See **[gpu-deformation-prerequisites.md](./gpu-deformation-prerequisites.md)** (contract, integration, fallback, profiling).

---

## Recommended next steps

Pick one track and ship a vertical slice.

**Holodeck track (§4 step 4+)**  
1. **Background layer:** First procedural or z-buffered background draw before characters (same depth buffer): minimal grid/quad + one texture, or one sprite path.  
2. **Walls/roofs** when the background path is stable.  
3. **§4 steps 6–8:** Expose lighting/highlight APIs on `Renderer` and drive hover/selection from mooshow; pie menu when the app needs it.

**Performance track (§5)**  
1. **GPU deformation (Option A):** Keep `Practice` on CPU; upload bone matrices each frame; compute shader (or staged compute) implements vitamoo’s Phase 0 / Phase 1 / blend model; draw from GPU-resident deformed buffer instead of streaming full vertex arrays from JS.  
2. **Option B** (later): move animation evaluation to GPU.

**Optional polish**  
- Bone-level id in the object-ID buffer (§2.3 TODO in [webgpu-renderer-design.md](./webgpu-renderer-design.md)) for mesh-part picking.
- **Censorship / mesh-bbox pixelization** (§3.11 in [webgpu-renderer-design.md](./webgpu-renderer-design.md)) — post-process or ID-aware mosaic for safe streams / policy.

---

## What is still out of scope until built

- Holodeck terrain, floors, walls, roofs, layered sprite authoring pipeline.
- GPU-side skeletal deformation and GPU-resident animation (§5).
- Pie menu passes (desaturate, vignette) and head-in-pie wiring in the app.
- Bbox-driven **pixelization / censorship** pass (design §3.11; not implemented).
- Display-list **executor** that consumes `DisplayListEntry[]` for the whole scene (types exist; stage still loops bodies explicitly).

---

## Related design docs

- **[gpu-assets-tooling-roadmap.md](./gpu-assets-tooling-roadmap.md)** — Resident GPU data, readback for object export (sprites / BMP / IFF), glTF interchange, streamed animation from clips.
- **[sims-content-pipeline-notes.md](./sims-content-pipeline-notes.md)** — 3DS Max note tracks, CMX Exporter, Transmogrifier/RugOMatic/ShowNTell, community sites, and how they map to VitaMoo browser tools.
- **[gltf-extras-metadata.md](./gltf-extras-metadata.md)** — glTF `extras` as the universal metadata layer: skeleton/suit/accessory tags, bone flags, skill metadata, time-keyed events, catalog data. Round-trip through Blender.
- **obliterator-designs/designs/04-DISPLAY-LISTS-AND-GPU-RESOURCES.md** — Display lists + resource pools.
- **obliterator-designs/designs/05-SIMS1-WORLD-RENDER-LAYERS.md** — Sims draw order.
- **[../REFACTOR-PLAN.md](../REFACTOR-PLAN.md)** — Layer split and refactor phases.
