// VitaMoo — main entry point.
// Loads Sims 1 character data and renders via WebGPU.
//
// Supports both text formats (CMX, SKN — the development tools)
// and binary formats (BCF, BMF, CFP — the game runtime).

export {
    Vec2, Vec3, Quat, Bone, SkeletonData, MeshData, SuitData, SkillData,
    MotionData, BoneData, SkinData, BoneBinding, BlendBinding, Face, CMXFile,
    quatNlerp,
    quatConjugate,
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
    defaultPipelineInspectionTaps,
    createInspectionTap,
    resizeInspectionTap,
    captureInspectionTap,
    compareInspectionTaps,
    compareCpuVec3ToGpuInterleaved,
    compareDeformedMeshCpuVsGpuInterleaved,
    compareBoneTransforms,
    compareDeformedVertices,
    DEFORMED_MESH_FLOATS_PER_VERTEX,
} from './character-pipeline.js';
export type {
    PipelineStageBackend,
    CharacterPipelineStages,
    GpuCharacterPipelineCaps,
    PipelineValidationSettings,
    PipelineInspectionTaps,
    InspectionTap,
    Float32BatchCompareResult,
    DeformationCompareSummary,
    BoneTransformCompareResult,
    DeformedVertexCompareResult,
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

export { GpuMeshCache, GPU_MESH_RAW_BONE_BIND_CACHE_KEY } from './gpu-mesh-cache.js';
export type { CachedMeshGpuData, GpuMeshBoneBindContext } from './gpu-mesh-cache.js';

export { GpuDeformer } from './gpu-deformer.js';
export { GpuAnimator } from './gpu-animator.js';
export type { PracticeGpuParams } from './gpu-animator.js';
export { GpuSkillCache, skeletonGpuBindingKey } from './gpu-skill-cache.js';
export type { CachedSkillGpuData } from './gpu-skill-cache.js';
export { GpuWorldTransform, worldTransformIdentity } from './gpu-world-transform.js';
export type { WorldTransformParams } from './gpu-world-transform.js';
export { GpuUniformPool, GpuVertexBufferPool } from './gpu-buffer-pool.js';
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
export { Practice, RepeatMode, applyPractices } from './animation.js';
export type { RepeatModeType, PracticeOptions, SkeletonEventHandler } from './animation.js';

export { createDiamondMesh } from './procedural/diamond.js';
export type { ProceduralMeshFactory } from './procedural/index.js';
export { transformMesh, transformMeshUpright } from './display-list.js';
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
