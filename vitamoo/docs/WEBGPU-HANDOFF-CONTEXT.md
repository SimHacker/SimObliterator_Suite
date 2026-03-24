# WebGPU renderer — context and next pass

**Purpose:** Handoff doc for the vitamoo WebGPU **`Renderer`**: a framework meant to support broader Sims content and plug-ins (UI, visualization, editors); character animation is the first integrated slice. Use this file to iterate on the next pass.

**Deployment:** **vitamoospace** ships to **GitHub Pages** via `.github/workflows/pages.yml` when `VITAMOOSPACE_PAGES_URL` is set on the repository. The live demo is the current reference for “what shipped.”

---

## Canonical design

**Single source of truth:** `vitamoo/docs/WEBGPU-RENDERER-DESIGN.md`

- §1: Current WebGPU surface (what is implemented).
- §2–3: Advanced features (Sims-style pipeline, terrain/walls/roofs, highlighting, pie menu) — mostly future.
- §4: Holodeck implementation order (steps 1–3 done; next is step 4 onward).
- §5: GPU-side skeletal deformation — not started; parallel track to §4.

---

## Status snapshot (matches tree)

| Area | State |
|------|--------|
| WebGPU draw path (WGSL mesh, depth, fade, plumb-bob) | Done |
| Textures (`loadTexture`, `getTextureFactory`, mooshow loader) | Done |
| Object-ID buffer + `readObjectIdAt`; mooshow picking | Done |
| CPU animation | `Practice.tick`, `updateTransforms`, `deformMesh` in JS; deformed verts uploaded every frame |
| Console noise (renderer / texture / deform / pick) | **Done:** gated behind `Renderer.create(canvas, { verbose: true })`, `StageConfig.verbose`, or `?vitamooVerbose=1` (default quiet) |
| GPU skeletal deformation / compute | Not started (see §5) |
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
| `vitamoo/vitamoo/renderer.ts` | `Renderer.create(canvas, options?)` — optional `{ verbose?: boolean }`. `clear`, `fadeScreen`, `setCamera`, `setCulling`, `drawMesh(…, objectId?)`, `drawDiamond(…, objectId?)`, `setViewport`, `endFrame`, `getTextureFactory`, `readObjectIdAt`, `setDebugSlice`, `setPlumbBobMeshes`, `setPlumbBobScale`. Dual attachments: three `r32uint` pick layers + swapchain color (see README). |
| `vitamoo/vitamoo/texture.ts` | `parseBMP`; `loadTexture(device, queue, url, verbose?)` → `TextureHandle` (`GPUTexture`). |

**mooshow:** `Renderer.create(canvas, { verbose })` → `setViewport`, `setTextureFactory`. Each frame: clear/fade → `setCamera` → per body `deformMesh(..., { verbose })` then `drawMesh` with `ObjectIdType` / body index / mesh index → plumb-bob draws → `endFrame`. Picking: `readObjectIdAt` (character and plumb-bob types). `setDebugSlice` wired from stage config / URL (`?debugSlice=`).

**Object-ID layout:** Matches §2.3 of the design doc: `vec4u(type, objectId, subObjectId, 0)` in the uint attachment (see `ObjectIdType` in vitamoo exports).

---

## Pre–§5 checklist (before GPU deformation work)

Use this when starting the **Performance track** so the CPU and GPU paths stay aligned.

1. **Contract:** Document per-frame inputs: bone world transforms after `updateTransforms` (same data `deformMesh` uses). Outputs: deformed positions/normals per vertex, bit-exact with CPU path for regression tests (or document acceptable tolerances).
2. **Integration:** One compute pass (or dispatch) before the existing main render pass; same depth buffer and object-ID attachments; `drawMesh` reads from a GPU vertex buffer instead of a `Float32Array` from JS (or a hybrid during bring-up).
3. **Fallback:** If `device` lacks required limits or compute fails, keep the current `deformMesh` + `drawMesh` path (feature-detect in `Renderer` or stage).
4. **Profiling:** Measure frame time and upload size before/after; goal is fewer bytes across the CPU–GPU boundary per character.

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
- Bone-level id in the object-ID buffer (§2.3 TODO in `WEBGPU-RENDERER-DESIGN.md`) for mesh-part picking.

---

## Shader reference (current WGSL)

- **Mesh:** Positions/normals/UVs; uniforms include projection, modelView, lightDir, alpha, fadeColor, hasTexture, ambient, diffuseFactor, highlight (vec4), idType/objectId/subObjectId, debugMode. Fragment writes object-id output and color output; diffuse + texture; highlight mix when `highlight.a > 0`.
- **Fullscreen quad:** Fade only; writes zero object id where dual-target is active.
- **Diamond:** Mesh pipeline branch, solid color, optional object id.

---

## What is still out of scope until built

- Holodeck terrain, floors, walls, roofs, layered sprite authoring pipeline.
- GPU-side skeletal deformation and GPU-resident animation (§5).
- Pie menu passes (desaturate, vignette) and head-in-pie wiring in the app.
- Display-list **executor** that consumes `DisplayListEntry[]` for the whole scene (types exist; stage still loops bodies explicitly).

---

## Related design docs

- **obliterator-designs/designs/04-DISPLAY-LISTS-AND-GPU-RESOURCES.md** — Display lists + resource pools.
- **obliterator-designs/designs/05-SIMS1-WORLD-RENDER-LAYERS.md** — Sims draw order.
- **vitamoo/REFACTOR-PLAN.md** — Broader refactor status.
