# GPU mesh deformation — prerequisites

The **GPU deformation and animation path** described in [webgpu-renderer-design.md §5](./webgpu-renderer-design.md) is **implemented** in-tree; this page stays the **contract** for CPU/GPU agreement, fallback, and profiling when changing either path. For what is shipped vs open, read [webgpu-renderer-status.md](./webgpu-renderer-status.md).

Align the **CPU reference path** with what the compute pass consumes and produces whenever you extend the pipeline.

1. **Contract:** Per-frame inputs are bone world transforms after `updateTransforms` (the same data `deformMesh` uses). Outputs are deformed positions and normals per vertex—**bit-exact** with the CPU path for regression tests, or document acceptable floating-point tolerances.
2. **Integration:** One compute pass (or dispatch) **before** the existing main render pass; same depth buffer and object-ID attachments; `drawMesh` reads from a GPU vertex buffer instead of a `Float32Array` from JS (or a hybrid during bring-up).
3. **Fallback:** If the device lacks required limits or compute fails, keep the current `deformMesh` + `drawMesh` path (feature-detect in `Renderer` or the stage).
4. **Profiling:** Measure frame time and upload size before and after; the goal is fewer bytes across the CPU–GPU boundary per character.
