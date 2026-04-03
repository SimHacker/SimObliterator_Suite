// VitaMoo — main entry point.
// Loads Sims 1 character data and renders via WebGPU.
//
// Supports both text formats (CMX, SKN — the development tools)
// and binary formats (BCF, BMF, CFP — the game runtime).

export {
    Vec2, Vec3, Quat, Bone, SkeletonData, MeshData, SuitData, SkillData,
    MotionData, BoneData, SkinData, BoneBinding, BlendBinding, Face, CMXFile,
} from './types.js';

export {
    parseCMX, parseSKN,
    parseBCF, parseBMF, parseCFP,
    writeCMX, writeSKN, writeReport,
    writeBCF, writeBMF, writeCFP,
} from './parser.js';

export { buildSkeleton, findRoot, findBone, updateTransforms, deformMesh } from './skeleton.js';
export type { DeformMeshOptions } from './skeleton.js';

export {
    defaultCharacterPipelineStages,
    mergeCharacterPipelineStages,
    defaultGpuCharacterPipelineCaps,
    effectivePipelineBackend,
    gpuStageFallbackWarnings,
    defaultPipelineValidationSettings,
    mergePipelineValidationSettings,
    compareCpuVec3ToGpuInterleaved,
    compareDeformedMeshCpuVsGpuInterleaved,
    DEFORMED_MESH_FLOATS_PER_VERTEX,
} from './character-pipeline.js';
export type {
    PipelineStageBackend,
    CharacterPipelineStages,
    GpuCharacterPipelineCaps,
    DeformedMeshReadbackKey,
    DeformedMeshReadbackResult,
    PipelineValidationSettings,
    Float32BatchCompareResult,
    DeformationCompareSummary,
} from './character-pipeline.js';

export {
    PipelineBuffer,
    packBoneTransforms,
    createBoneTransformBuffer,
    packDeformedMesh,
    createDeformedMeshBuffer,
    BONE_TRANSFORM_FLOATS,
    DEFORMED_VERTEX_FLOATS,
} from './pipeline-buffer.js';
export type { PipelineBufferAuthority, PipelineBufferOptions } from './pipeline-buffer.js';

export { GpuMeshCache } from './gpu-mesh-cache.js';
export type { CachedMeshGpuData } from './gpu-mesh-cache.js';
export {
    Renderer,
    ObjectIdType,
    SubObjectId,
    MeshFragmentDebugMode,
    MESH_FRAGMENT_DEBUG_MODE_MAX,
    meshFragmentDebugModeLabel,
} from './renderer.js';
export type { MeshFragmentDebugModeId, RendererCreateOptions } from './renderer.js';
export type {
    GpuResourceKind,
    GpuResourceAllocatedEvent,
    GpuResourceDestroyedEvent,
    GpuInstrumentationCallbacks,
} from './gpu-instrumentation.js';
export {
    DataReader, TextReader, BinaryReader, BinaryWriter,
    buildDeltaTable, decompressFloats, compressFloats,
} from './reader.js';

export { parseBMP, loadTexture } from './texture.js';
export type { TextureHandle } from './texture.js';
export { Practice, RepeatMode } from './animation.js';

export { createDiamondMesh } from './procedural/diamond.js';
export type { ProceduralMeshFactory } from './procedural/index.js';
export { transformMesh } from './display-list.js';
export { loadGltfMeshes } from './loaders/gltf.js';
export type {
    DisplayListEntry,
    DisplayListEntryStatic,
    DisplayListEntrySkinned,
    DisplayListEntryUI,
    DisplayListEntryLegacy,
    Transform3D,
    Transform3DFull,
    DisplayListLayer,
    PickingOptions,
} from './display-list.js';
