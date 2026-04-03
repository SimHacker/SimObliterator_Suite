// Layered CPU/GPU character pipeline configuration and validation helpers.
//
// Three logical stages:
//   animation   — motion / skill evaluation → bone poses
//   deformation — bone poses → deformed mesh vertices and normals
//   rasterization — triangle draw (WGSL render pass)
//
// Animation and deformation are switchable between CPU and GPU implementations
// so we can develop, validate, and profile each layer independently.
//
// Rasterization is always WebGPU. There is no CPU rasterizer, no WebGL
// fallback, and no software renderer. The field is kept in the types for
// completeness (and possible future vertex-source variants like GPU-resident
// VBs vs CPU-uploaded arrays) but defaults to 'gpu' and should not be
// changed to 'cpu'.

import type { Vec3 } from './types.js';

/** One pipeline stage: CPU reference or GPU implementation. */
export type PipelineStageBackend = 'cpu' | 'gpu';

/**
 * Per-stage backend selection.
 * - `animation`: `'cpu'` (default) or `'gpu'` when GPU pose evaluation is implemented.
 * - `deformation`: `'cpu'` (default) or `'gpu'` when GPU compute skinning is implemented.
 * - `rasterization`: always `'gpu'` — WebGPU only; no CPU or WebGL path exists.
 */
export interface CharacterPipelineStages {
    animation: PipelineStageBackend;
    deformation: PipelineStageBackend;
    /** Always `'gpu'`. Kept for type completeness; changing to `'cpu'` has no effect. */
    rasterization: 'gpu';
}

export function defaultCharacterPipelineStages(): CharacterPipelineStages {
    return {
        animation: 'cpu',
        deformation: 'cpu',
        rasterization: 'gpu',
    };
}

export function mergeCharacterPipelineStages(
    partial?: Partial<CharacterPipelineStages>,
): CharacterPipelineStages {
    const base = defaultCharacterPipelineStages();
    if (partial) {
        if (partial.animation) base.animation = partial.animation;
        if (partial.deformation) base.deformation = partial.deformation;
    }
    return base;
}

/**
 * Which GPU character-pipeline stages are implemented.
 * Rasterization is always true (WebGPU is the only draw path).
 */
export interface GpuCharacterPipelineCaps {
    animation: boolean;
    deformation: boolean;
    /** Always true — rasterization is WebGPU only. */
    rasterization: true;
}

export function defaultGpuCharacterPipelineCaps(): GpuCharacterPipelineCaps {
    return {
        animation: false,
        deformation: false,
        rasterization: true,
    };
}

/**
 * Resolve requested backend when GPU is not ready: use CPU without failing.
 * Callers should log a one-time warning when `requested !== effective`.
 */
export function effectivePipelineBackend(
    requested: PipelineStageBackend,
    gpuSupported: boolean,
): PipelineStageBackend {
    if (requested === 'gpu' && !gpuSupported) return 'cpu';
    return requested;
}

export function gpuStageFallbackWarnings(
    stages: CharacterPipelineStages,
    caps: GpuCharacterPipelineCaps,
): string[] {
    const out: string[] = [];
    if (stages.animation === 'gpu' && !caps.animation) {
        out.push('pipeline.animation is "gpu" but GPU animation is not implemented; using CPU');
    }
    if (stages.deformation === 'gpu' && !caps.deformation) {
        out.push('pipeline.deformation is "gpu" but GPU deformation is not implemented; using CPU');
    }
    return out;
}

/** Optional readback of GPU deformation for validation (interleaved layout). */
export const DEFORMED_MESH_FLOATS_PER_VERTEX = 6;

export interface DeformedMeshReadbackKey {
    bodyIndex: number;
    meshIndex: number;
    vertexCount: number;
}

export interface DeformedMeshReadbackResult {
    /** Interleaved: for each vertex, px py pz nx ny nz */
    data: Float32Array;
    vertexCount: number;
}

/**
 * An inspection tap captures the output of a pipeline step into a CPU-side
 * Float32Array for comparison. One set of working buffers flows through the
 * pipeline; taps are optional snapshots taken after a step runs.
 *
 * When non-null, the pipeline runner copies the working buffer's contents
 * into the tap after the step completes. The same working buffer is then
 * reused for the next step (or the alternate backend for comparison).
 */
export interface InspectionTap {
    /** Captured data. Resized automatically to match the working buffer. */
    data: Float32Array;
    /** True if data was captured this frame. */
    captured: boolean;
}

export function createInspectionTap(floatCount: number): InspectionTap {
    return { data: new Float32Array(floatCount), captured: false };
}

export function resizeInspectionTap(tap: InspectionTap, floatCount: number): void {
    if (tap.data.length !== floatCount) {
        tap.data = new Float32Array(floatCount);
    }
    tap.captured = false;
}

export function captureInspectionTap(tap: InspectionTap, source: Float32Array): void {
    if (tap.data.length !== source.length) {
        tap.data = new Float32Array(source.length);
    }
    tap.data.set(source);
    tap.captured = true;
}

/** Per-stage inspection taps for CPU and GPU outputs. */
export interface PipelineInspectionTaps {
    deformationCpu: InspectionTap | null;
    deformationGpu: InspectionTap | null;
    animationCpu: InspectionTap | null;
    animationGpu: InspectionTap | null;
}

export function defaultPipelineInspectionTaps(): PipelineInspectionTaps {
    return {
        deformationCpu: null,
        deformationGpu: null,
        animationCpu: null,
        animationGpu: null,
    };
}

export interface PipelineValidationSettings {
    enabled: boolean;
    /** Run CPU deformation even when gpu is the active backend, capture to tap, and compare. */
    compareDeformation: boolean;
    /** Run CPU animation even when gpu is active, capture to tap, and compare. */
    compareAnimation: boolean;
    maxAbsError: number;
    /** Cap console spam per mesh per frame. */
    maxLoggedVertices: number;
    /** 1 = every validated frame. */
    everyNFrames: number;
    /** If true, throw after logging first mismatch (dev only). */
    throwOnMismatch: boolean;
}

export function defaultPipelineValidationSettings(): PipelineValidationSettings {
    return {
        enabled: false,
        compareAnimation: false,
        compareDeformation: false,
        maxAbsError: 1e-4,
        maxLoggedVertices: 16,
        everyNFrames: 1,
        throwOnMismatch: false,
    };
}

export function mergePipelineValidationSettings(
    partial?: Partial<PipelineValidationSettings>,
): PipelineValidationSettings {
    return { ...defaultPipelineValidationSettings(), ...partial };
}

/**
 * Compare two Float32Array inspection taps with the same interleaved layout.
 * Both must be DEFORMED_MESH_FLOATS_PER_VERTEX (6) floats per vertex.
 */
export function compareInspectionTaps(
    a: Float32Array,
    b: Float32Array,
    epsilon: number,
): { maxAbsDiff: number; mismatchCount: number; firstMismatchIndex: number } {
    let maxAbsDiff = 0;
    let mismatchCount = 0;
    let firstMismatchIndex = -1;
    const n = Math.min(a.length, b.length);
    for (let i = 0; i < n; i++) {
        const d = Math.abs(a[i] - b[i]);
        if (d > maxAbsDiff) maxAbsDiff = d;
        if (d > epsilon) {
            mismatchCount++;
            if (firstMismatchIndex < 0) firstMismatchIndex = i;
        }
    }
    if (a.length !== b.length) {
        mismatchCount += Math.abs(a.length - b.length);
        if (firstMismatchIndex < 0) firstMismatchIndex = n;
    }
    return { maxAbsDiff, mismatchCount, firstMismatchIndex };
}

export interface Float32BatchCompareResult {
    maxAbsDiff: number;
    mismatchCount: number;
    firstMismatchVertex: number;
}

const STRIDE = DEFORMED_MESH_FLOATS_PER_VERTEX;

/**
 * Compare CPU Vec3[] to interleaved GPU floats. `componentOffset` is 0 for position triples, 3 for normals.
 */
export function compareCpuVec3ToGpuInterleaved(
    cpu: Vec3[],
    gpu: Float32Array,
    componentOffset: 0 | 3,
    epsilon: number,
): Float32BatchCompareResult {
    let maxAbsDiff = 0;
    let mismatchCount = 0;
    let firstMismatchVertex = -1;
    const n = cpu.length;
    for (let i = 0; i < n; i++) {
        const o = i * STRIDE + componentOffset;
        if (o + 2 >= gpu.length) {
            if (firstMismatchVertex < 0) firstMismatchVertex = i;
            mismatchCount++;
            continue;
        }
        const dx = Math.abs(cpu[i].x - gpu[o]);
        const dy = Math.abs(cpu[i].y - gpu[o + 1]);
        const dz = Math.abs(cpu[i].z - gpu[o + 2]);
        const m = Math.max(dx, dy, dz);
        if (m > maxAbsDiff) maxAbsDiff = m;
        if (m > epsilon) {
            mismatchCount++;
            if (firstMismatchVertex < 0) firstMismatchVertex = i;
        }
    }
    return { maxAbsDiff, mismatchCount, firstMismatchVertex };
}

export interface DeformationCompareSummary {
    positions: Float32BatchCompareResult;
    normals: Float32BatchCompareResult;
}

export function compareDeformedMeshCpuVsGpuInterleaved(
    cpuVerts: Vec3[],
    cpuNorms: Vec3[],
    gpu: Float32Array,
    epsilon: number,
): DeformationCompareSummary {
    return {
        positions: compareCpuVec3ToGpuInterleaved(cpuVerts, gpu, 0, epsilon),
        normals: compareCpuVec3ToGpuInterleaved(cpuNorms, gpu, 3, epsilon),
    };
}
