# WebGPU renderer — context handoff for first-stage implementation

**Purpose:** Copy this block (or point a fresh agent at this file) when starting the first stages of the WebGPU renderer. Goal: **Phase 1 parity only** — replace WebGL with WebGPU, keep the same public API and behavior (skinned mesh, motion blur, plumb bob). No new features.

---

## Canonical design

**Single source of truth:** `vitamoo/docs/WEBGPU-RENDERER-DESIGN.md`

- §1: WebGL → WebGPU upgrade (current surface, target surface, shader migration GLSL→WGSL, Phase 1 parity definition).
- §2–3: Advanced features (Sims-style pipeline, z-buffered sprites, terrain/walls/roofs, highlighting, pie menu) — **out of scope for first stages**.
- §4: Implementation order — we are doing **step 1** (parity) and **step 2** (setViewport + loader texture interface).
- §5: GPU-side skeletal deformation — **later**; ignore for now.

---

## Repo and stack

- **Repo:** `SimObliterator_Suite`, subpath `vitamoo/`.
- **Layers:**  
  - **vitamoo** (core): `vitamoo/vitamoo/` — parsers, skeleton, `deformMesh`, **Renderer** (WebGL), **loadTexture**.  
  - **mooshow** (runtime): `vitamoo/mooshow/src/` — `MooShowStage`, `ContentLoader`, animation loop; owns canvas and calls renderer.  
  - **vitamoospace** (app): SvelteKit app that uses mooshow; no direct renderer use.

---

## Current WebGL surface (what to replace)

| File | Role |
|------|------|
| `vitamoo/vitamoo/renderer.ts` | Single `Renderer` class. WebGL 1, one vertex + one fragment shader (GLSL). Methods: `clear`, `fadeScreen`, `setCamera`, `setCulling`, `drawMesh`, `drawDiamond`, `loadTexture` (static). Exposes `context` (WebGLRenderingContext) for texture upload. |
| `vitamoo/vitamoo/texture.ts` | `parseBMP(buffer)` (pure); `loadTexture(url, gl)` creates and uploads a WebGLTexture. |

**mooshow usage (must keep working):**

- `new Renderer(canvas)` then: `clear`, `context.viewport(…)`, `setCamera`, `fadeScreen`, `drawMesh(mesh, verts, norms, texture)`, `drawDiamond(x, y, z, scale, rotY, r, g, b, a)`.
- `loader.setGL(this._renderer.context)` so ContentLoader can create textures; loader later passes `WebGLTexture | null` into `drawMesh`.

**Stage render flow (each frame):** `fadeScreen` (motion blur) → `clear` → for each body: `deformMesh` → `drawMesh(..., texture)` → optionally `drawDiamond` (plumb bob). Depth test and backface culling on.

---

## Target WebGPU surface (Phase 1)

- **Device/queue:** `navigator.gpu.requestAdapter()` → `adapter.requestDevice()`; one `GPUDevice` + default `queue` for renderer lifetime.
- **Canvas:** `canvas.getContext('webgpu')`, configure with `device`, `format`, `alphaMode`. Resize and get current texture each frame.
- **Shaders:** WGSL. At least: (1) **Mesh pass** — vertex (position, normal, uv, MVP, light dir) → fragment (diffuse + texture, alpha, fade sentinel). (2) **Fullscreen quad** for `fadeScreen`. (3) **Diamond** — same mesh pipeline with solid color, or tiny dedicated pipeline.
- **Pipelines:** `GPURenderPipeline` for mesh, fullscreen quad, and diamond (if separate). Shared bind group layout for uniforms (projection, modelView, lightDir, alpha, fadeColor, texture/sampler).
- **Buffers:** Vertex/index `GPUBuffer`; small uniform buffer updated per frame or per draw. Mesh data: same as today (deformed verts/norms/UVs from CPU each frame) unless we add staging; for parity, uploading per draw is fine.
- **Textures:** `loadTexture(device, url)` (or renderer exposes a texture factory) returns a handle the renderer accepts in `drawMesh`. Upload via `queue.copyExternalImageToTexture` from `createImageBitmap` or from decoded BMP (parseBMP stays; upload path becomes WebGPU).
- **Public API preserved:** Same method names and signatures. Callers (stage, loader) must not touch WebGPU objects; they get either `device` or a texture-upload interface instead of `gl`. Replace `renderer.context` with `renderer.setViewport(x, y, w, h)` and a way for the loader to create textures (e.g. `renderer.getTextureFactory()` returning `{ createTextureFromUrl(url): Promise<TextureHandle> }` or pass `device` into loader).

---

## Concrete files to touch (first stages)

1. **vitamoo/vitamoo/renderer.ts**  
   Replace WebGL with WebGPU: init device/canvas, WGSL shader modules, pipelines (mesh, fullscreen quad, diamond), buffer uploads, texture bindings. Keep: `clear`, `setCamera`, `setCulling`, `drawMesh(mesh, verts, norms, texture)`, `drawDiamond(...)`, `fadeScreen`. Add: `setViewport(x, y, w, h)`. Remove or replace: `get context()` with a texture factory or explicit `setDevice(device)` for the loader.

2. **vitamoo/vitamoo/texture.ts**  
   `loadTexture(url, gl)` → `loadTexture(device, queue, url)` (or `loadTexture(device, queue, url)` returning a `GPUTexture` / opaque handle). Use `createImageBitmap` + `queue.copyExternalImageToTexture` for browser images; for BMP, keep `parseBMP`, then create `GPUTexture` and copy `ImageBitmap` or raw RGBA. Export a type for “texture handle” (e.g. `GPUTexture` or wrapper) so renderer and loader agree.

3. **vitamoo/mooshow/src/runtime/content-loader.ts**  
   Today: `setGL(gl: WebGLRenderingContext)`. Change to accept WebGPU device (or renderer’s texture factory): e.g. `setDevice(device: GPUDevice)` or `setTextureFactory(factory: { createTextureFromUrl(url: string): Promise<TextureHandle> })`. Store that and use it when loading textures; return the same handle type that `drawMesh` accepts.

4. **vitamoo/mooshow/src/runtime/stage.ts**  
   Replace `this._renderer.context.viewport(0, 0, w, h)` with `this._renderer.setViewport(0, 0, w, h)`. Replace `this.loader.setGL(this._renderer.context)` with the new loader API (e.g. `this.loader.setDevice(this._renderer.device)` or `this.loader.setTextureFactory(this._renderer.getTextureFactory())`). No other stage logic changes for parity.

5. **vitamoo/vitamoo/vitamoo.ts** (exports)  
   Ensure `Renderer` and texture types (and `loadTexture` if still public) are exported; add any new types (e.g. `TextureHandle`) if needed.

---

## Shader migration (GLSL → WGSL) — reference

- **Vertex:** `aPosition`, `aNormal`, `aTexCoord` → `@location(0)` position, `@location(1)` normal, `@location(2)` texCoord. Output position, uv, normal to fragment. Uniforms: `uProjection`, `uModelView` (or combined `uModelViewProjection`).
- **Fragment:** `vTexCoord`, `vNormal` from vertex; `uniform sampler` + `texture_2d`, `uHasTexture`, `uLightDir`, `uAlpha`, `uFadeColor`. Same math: if `uFadeColor` is “use fade” sentinel, output fade color; else diffuse + texture or untextured gray. WGSL: `textureSample`, `textureSampleLevel`, `@binding`/`@group`.
- **Fullscreen quad:** vertex outputs NDC position; fragment solid color (fade). No texture.
- **Diamond:** reuse mesh pipeline with solid color and no texture, or minimal dedicated pipeline.

---

## What NOT to do in first stages

- No object-ID pass, no picking buffer, no layered sprites.
- No terrain, floors, walls, roofs, or display-list pipeline (see obliterator-designs: `designs/04-DISPLAY-LISTS-AND-GPU-RESOURCES.md`, `designs/05-SIMS1-WORLD-RENDER-LAYERS.md` for later).
- No GPU-side skeletal deformation (WEBGPU-RENDERER-DESIGN §5).
- No highlight/selection/feedback uniforms, no pie menu.
- No change to animation or deformation logic (still CPU `deformMesh` → upload deformed verts each frame).

---

## Success criteria (Phase 1)

- vitamoospace (and legacy demo if still runnable) start and run with WebGPU.
- Same visual behavior: skinned characters, motion blur trail, plumb bob, textures from content index.
- No `webgl` or `WebGLRenderingContext` in the render path; `canvas.getContext('webgpu')` and WGSL only.
- mooshow and stage only use the preserved renderer API and the new loader texture interface; no raw WebGPU in app or runtime except inside renderer/texture.

---

## Related design docs (for later phases)

- **obliterator-designs/designs/04-DISPLAY-LISTS-AND-GPU-RESOURCES.md** — Save/lot → display lists + resource pools for fast WebGPU draw (terrain, tiles, walls, roofs, object sprites).
- **obliterator-designs/designs/05-SIMS1-WORLD-RENDER-LAYERS.md** — Original Sims draw order (static → dynamic → 3D people); useful when adding background layers.
- **vitamoo/REFACTOR-PLAN.md** — Current refactor status; WebGPU is “beyond Phase 5.”

---

*Handoff written for a fresh agent starting the first stages of the WebGPU renderer. Update this file when Phase 1 is done or when the contract changes.*
