# VitaMoo — `docs/`

Focused notes for the **WebGPU renderer** and related roadmap. The **full stack protocol** (layers, APIs, content formats) lives in the parent **[`../DOCUMENTATION.md`](../DOCUMENTATION.md)**. **Layer refactor history** is in **[`../REFACTOR-PLAN.md`](../REFACTOR-PLAN.md)**.

| File | Contents |
|------|----------|
| **[webgpu-renderer-design.md](./webgpu-renderer-design.md)** | **Specification:** current pipeline, object-ID layout, holodeck roadmap (§4), GPU deformation (§5), WGSL overview, display-list shapes. Update this when behavior or formats change. |
| **[webgpu-renderer-status.md](./webgpu-renderer-status.md)** | **Living status:** what is implemented vs planned, GitHub Pages deployment, file-level map, recommended next steps, out-of-scope list, links to sibling repos. |
| **[gpu-deformation-prerequisites.md](./gpu-deformation-prerequisites.md)** | **Checklist** before starting GPU skinning work (contract, integration, fallback, profiling). |

**Reading order:** [`webgpu-renderer-status.md`](./webgpu-renderer-status.md) for orientation, then [`webgpu-renderer-design.md`](./webgpu-renderer-design.md) for depth. Use the prerequisites doc when beginning §5 work.

---

## Accomplishments (shipped)

- **WebGPU character path:** WGSL mesh draw, depth, screen fade, plumb-bob meshes, BMP textures via `loadTexture`, object-ID pick buffer and `readObjectIdAt` (mooshow picking).
- **CPU animation integration:** `Practice.tick` → `updateTransforms` → `deformMesh` → per-frame vertex upload; stage loop in mooshow.
- **Logging:** Renderer / texture / deform / pick noise gated behind `Renderer.create(..., { verbose: true })`, `StageConfig.verbose`, or `?vitamooVerbose=1` (default quiet).
- **Documentation split:** One canonical **design** spec ([`webgpu-renderer-design.md`](./webgpu-renderer-design.md)), one **status/roadmap** doc ([`webgpu-renderer-status.md`](./webgpu-renderer-status.md)), and a **§5 prerequisites** checklist ([`gpu-deformation-prerequisites.md`](./gpu-deformation-prerequisites.md)). Implemented WGSL passes are summarized in **design §1.2** (not duplicated in status).

---

## Current stage

| Track | Stage |
|-------|--------|
| **WebGPU + characters (vitamoo + mooshow)** | **In use:** draw path, textures, picking, CPU deform. |
| **Holodeck (design §4)** | Steps 1–3 called out as done in the design doc; **background / walls / later §4 steps not started.** |
| **GPU skeletal deformation (§5)** | **Not started** — parallel to remaining Holodeck work. |
| **vitamoospace (app)** | Demo host; ships to GitHub Pages when `VITAMOOSPACE_PAGES_URL` is configured. |

---

## TODO (next engineering work)

See **[webgpu-renderer-status.md § Recommended next steps](./webgpu-renderer-status.md#recommended-next-steps)** for the two vertical slices (**Holodeck §4+** vs **§5 GPU deformation**). Short form:

- **Holodeck:** background layer before characters, then walls/roofs; then lighting/highlight API exposure in mooshow; pie menu when needed.
- **§5:** compute (or staged) deformation from bone matrices; GPU-resident deformed buffers; optional later: animation on GPU.
- **Polish:** bone-level object IDs for sub-mesh picking (design §2.3).

---

## Dependencies

| Kind | What |
|------|------|
| **Monorepo layers** | **vitamoo** (core: parsers, skeleton, `Renderer`, textures) → **mooshow** (stage, pick, hooks) → **vitamoospace** (SvelteKit app). |
| **Sibling design repos** | **obliterator-designs** (separate checkout): `designs/04-DISPLAY-LISTS-AND-GPU-RESOURCES.md`, `designs/05-SIMS1-WORLD-RENDER-LAYERS.md` — display lists + pools; Sims draw order. Same references as [webgpu-renderer-status.md § Related design docs](./webgpu-renderer-status.md#related-design-docs). |
| **Tooling** | **pnpm** workspace in `vitamoo/`; **WebGPU**-capable browser for the demo; **Node** for build/tests. |
| **Deploy** | GitHub Actions **`.github/workflows/pages.yml`** + repo secret `VITAMOOSPACE_PAGES_URL` for Pages. |

---

## History check (no lost content)

- **`webgpu-renderer-design.md`** is byte-identical to the last committed **`WEBGPU-RENDERER-DESIGN.md`** at `f5c3639` (342 lines).
- **Former `WEBGPU-HANDOFF-CONTEXT.md` (108 lines)** is covered by **`webgpu-renderer-status.md`** + **`gpu-deformation-prerequisites.md`** + **design §1.2** (WGSL list intentionally lives only in the design doc).
