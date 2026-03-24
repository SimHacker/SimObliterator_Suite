# GPU mesh deformation — prerequisites

Before implementing **GPU-side skeletal deformation** (see [webgpu-renderer-design.md §5](./webgpu-renderer-design.md) and the [status](./webgpu-renderer-status.md) doc), align the **CPU reference path** with what the compute pass will consume and produce.

1. **Contract:** Per-frame inputs are bone world transforms after `updateTransforms` (the same data `deformMesh` uses). Outputs are deformed positions and normals per vertex—**bit-exact** with the CPU path for regression tests, or document acceptable floating-point tolerances.
2. **Integration:** One compute pass (or dispatch) **before** the existing main render pass; same depth buffer and object-ID attachments; `drawMesh` reads from a GPU vertex buffer instead of a `Float32Array` from JS (or a hybrid during bring-up).
3. **Fallback:** If the device lacks required limits or compute fails, keep the current `deformMesh` + `drawMesh` path (feature-detect in `Renderer` or the stage).
4. **Profiling:** Measure frame time and upload size before and after; the goal is fewer bytes across the CPU–GPU boundary per character.
