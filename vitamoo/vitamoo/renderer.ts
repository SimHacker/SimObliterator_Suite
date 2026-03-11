// VitaMoo WebGPU renderer — draws deformed meshes with textures.
// Phase 1 parity with previous WebGL renderer: same public API.
/// <reference types="@webgpu/types" />

import { Vec3, MeshData } from './types.js';
import { loadTexture } from './texture.js';

export type TextureHandle = import('./texture.js').TextureHandle;

const MESH_VERTEX_WGSL = `
struct Uniforms {
    projection: mat4x4f,
    modelView: mat4x4f,
    lightDir: vec3f,
    alpha: f32,
    fadeColor: vec3f,
    hasTexture: u32,
}
@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var tex: texture_2d<f32>;
@group(0) @binding(2) var samp: sampler;

struct VertexInput {
    @location(0) position: vec3f,
    @location(1) normal: vec3f,
    @location(2) texCoord: vec2f,
}
struct VertexOutput {
    @builtin(position) position: vec4f,
    @location(0) texCoord: vec2f,
    @location(1) normal: vec3f,
}
@vertex
fn vertexMain(input: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    out.position = u.projection * u.modelView * vec4f(input.position, 1.0);
    out.texCoord = input.texCoord;
    out.normal = input.normal;
    return out;
}
@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4f {
    if (u.fadeColor.r >= 0.0) {
        return vec4f(u.fadeColor, u.alpha);
    }
    let n = normalize(input.normal);
    let L = normalize(u.lightDir);
    let diffuse = max(dot(n, L), 0.0);
    let light = 0.25 + 0.75 * diffuse;
    if (u.hasTexture != 0u) {
        let texColor = textureSample(tex, samp, input.texCoord);
        return vec4f(texColor.rgb * light, texColor.a * u.alpha);
    }
    return vec4f(vec3f(0.7, 0.7, 0.8) * light, u.alpha);
}
`;

const QUAD_VERTEX_WGSL = `
struct Uniforms {
    alpha: f32,
    fadeColor: vec3f,
}
@group(0) @binding(0) var<uniform> u: Uniforms;
struct VertexOutput {
    @builtin(position) position: vec4f,
}
@vertex
fn vertexMain(@location(0) position: vec3f) -> VertexOutput {
    var out: VertexOutput;
    out.position = vec4f(position, 1.0);
    return out;
}
@fragment
fn fragmentMain() -> @location(0) vec4f {
    return vec4f(u.fadeColor, u.alpha);
}
`;

function perspective(fov: number, aspect: number, near: number, far: number): Float32Array {
    const f = 1.0 / Math.tan(fov * Math.PI / 360);
    const nf = 1 / (near - far);
    return new Float32Array([
        f / aspect, 0, 0, 0,
        0, f, 0, 0,
        0, 0, (far + near) * nf, -1,
        0, 0, 2 * far * near * nf, 0,
    ]);
}

function lookAt(
    ex: number, ey: number, ez: number,
    cx: number, cy: number, cz: number,
    ux: number, uy: number, uz: number,
): Float32Array {
    let fx = cx - ex, fy = cy - ey, fz = cz - ez;
    let fl = Math.sqrt(fx * fx + fy * fy + fz * fz);
    fx /= fl; fy /= fl; fz /= fl;
    let sx = fy * uz - fz * uy, sy = fz * ux - fx * uz, sz = fx * uy - fy * ux;
    let sl = Math.sqrt(sx * sx + sy * sy + sz * sz);
    sx /= sl; sy /= sl; sz /= sl;
    const uux = sy * fz - sz * fy, uuy = sz * fx - sx * fz, uuz = sx * fy - sy * fx;
    return new Float32Array([
        sx, uux, -fx, 0,
        sy, uuy, -fy, 0,
        sz, uuz, -fz, 0,
        -(sx * ex + sy * ey + sz * ez),
        -(uux * ex + uuy * ey + uuz * ez),
        fx * ex + fy * ey + fz * ez, 1,
    ]);
}

const FADE_SENTINEL = -1;
const UNIFORM_SIZE = 256;
const QUAD_UNIFORM_SIZE = 16;

export class Renderer {
    private static loggedMeshes = new Set<string>();

    private device!: GPUDevice;
    private queue!: GPUQueue;
    private context!: GPUCanvasContext;
    private format!: GPUTextureFormat;
    private viewport = { x: 0, y: 0, w: 0, h: 0 };
    private depthTexture: GPUTexture | null = null;
    private meshPipeline!: GPURenderPipeline;
    private meshPipelineNoCull!: GPURenderPipeline;
    private quadPipeline!: GPURenderPipeline;
    private meshBindGroupLayout!: GPUBindGroupLayout;
    private quadBindGroupLayout!: GPUBindGroupLayout;
    private uniformBuffer!: GPUBuffer;
    private quadUniformBuffer!: GPUBuffer;
    private defaultSampler!: GPUSampler;
    private dummyTexture!: GPUTexture;
    private proj = new Float32Array(16);
    private modelView = new Float32Array(16);
    private lightDir = new Float32Array([0, 1, 0]);
    private alpha = 1.0;
    private fadeColor = new Float32Array([FADE_SENTINEL, FADE_SENTINEL, FADE_SENTINEL]);
    private cullingEnabled = true;

    private currentEncoder: GPUCommandEncoder | null = null;
    private currentPass: GPURenderPassEncoder | null = null;
    private currentTexture: GPUTexture | null = null;

    private constructor(private canvas: HTMLCanvasElement) {}

    static async create(canvas: HTMLCanvasElement): Promise<Renderer> {
        const r = new Renderer(canvas);
        await r._init();
        return r;
    }

    private async _init(): Promise<void> {
        const adapter = await navigator.gpu?.requestAdapter();
        if (!adapter) throw new Error('WebGPU not available');
        this.device = await adapter.requestDevice();
        this.queue = this.device.queue;

        const ctx = this.canvas.getContext('webgpu');
        if (!ctx) throw new Error('WebGPU canvas context not available');
        this.context = ctx;
        this.format = navigator.gpu.getPreferredCanvasFormat?.() ?? 'bgra8unorm';
        this.context.configure({
            device: this.device,
            format: this.format,
            alphaMode: 'opaque',
        });

        this.uniformBuffer = this.device.createBuffer({
            size: UNIFORM_SIZE,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        this.quadUniformBuffer = this.device.createBuffer({
            size: QUAD_UNIFORM_SIZE,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });
        this.defaultSampler = this.device.createSampler({
            minFilter: 'linear',
            magFilter: 'linear',
            addressModeU: 'clamp-to-edge',
            addressModeV: 'clamp-to-edge',
        });
        this.dummyTexture = this.device.createTexture({
            size: [1, 1, 1],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
        });
        this.queue.writeTexture(
            { texture: this.dummyTexture },
            new Uint8Array([255, 255, 255, 255]),
            { bytesPerRow: 4, rowsPerImage: 1 },
            [1, 1, 1],
        );

        this.meshBindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
                { binding: 1, visibility: GPUShaderStage.FRAGMENT, texture: { sampleType: 'float' } },
                { binding: 2, visibility: GPUShaderStage.FRAGMENT, sampler: { type: 'filtering' } },
            ],
        });
        this.quadBindGroupLayout = this.device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.FRAGMENT, buffer: { type: 'uniform' } },
            ],
        });

        const meshModule = this.device.createShaderModule({ code: MESH_VERTEX_WGSL });
        const quadModule = this.device.createShaderModule({ code: QUAD_VERTEX_WGSL });

        const meshPipelineLayout = this.device.createPipelineLayout({
            bindGroupLayouts: [this.meshBindGroupLayout],
        });
        const meshVertexState: GPUVertexState = {
            module: meshModule,
            entryPoint: 'vertexMain',
            buffers: [
                {
                    arrayStride: 32,
                    attributes: [
                        { shaderLocation: 0, offset: 0, format: 'float32x3' },
                        { shaderLocation: 1, offset: 12, format: 'float32x3' },
                        { shaderLocation: 2, offset: 24, format: 'float32x2' },
                    ],
                },
            ],
        };
        const meshFragmentState: GPUFragmentState = {
            module: meshModule,
            entryPoint: 'fragmentMain',
            targets: [{ format: this.format }],
        };
        const meshDepthStencil: GPUDepthStencilState = {
            format: 'depth24plus',
            depthWriteEnabled: true,
            depthCompare: 'less-equal',
        };
        this.meshPipeline = this.device.createRenderPipeline({
            layout: meshPipelineLayout,
            vertex: meshVertexState,
            fragment: meshFragmentState,
            primitive: { topology: 'triangle-list', cullMode: 'back', frontFace: 'ccw' },
            depthStencil: meshDepthStencil,
        });
        this.meshPipelineNoCull = this.device.createRenderPipeline({
            layout: meshPipelineLayout,
            vertex: meshVertexState,
            fragment: meshFragmentState,
            primitive: { topology: 'triangle-list', cullMode: 'none', frontFace: 'ccw' },
            depthStencil: meshDepthStencil,
        });

        const quadPipelineLayout = this.device.createPipelineLayout({
            bindGroupLayouts: [this.quadBindGroupLayout],
        });
        this.quadPipeline = this.device.createRenderPipeline({
            layout: quadPipelineLayout,
            vertex: {
                module: quadModule,
                entryPoint: 'vertexMain',
                buffers: [
                    { arrayStride: 12, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] },
                ],
            },
            fragment: {
                module: quadModule,
                entryPoint: 'fragmentMain',
                targets: [{ format: this.format }],
            },
            primitive: { topology: 'triangle-list' },
            depthStencil: {
                format: 'depth24plus',
                depthWriteEnabled: false,
                depthCompare: 'always',
            },
        });
    }

    setViewport(x: number, y: number, w: number, h: number): void {
        this.viewport = { x, y, w, h };
        if (this.depthTexture) this.depthTexture.destroy();
        if (w > 0 && h > 0) {
            this.depthTexture = this.device.createTexture({
                size: [w, h, 1],
                format: 'depth24plus',
                usage: GPUTextureUsage.RENDER_ATTACHMENT,
            });
        } else {
            this.depthTexture = null;
        }
    }

    getTextureFactory(): { createTextureFromUrl(url: string): Promise<TextureHandle> } {
        return {
            createTextureFromUrl: (url: string) => loadTexture(this.device, this.queue, url),
        };
    }

    private _endFrame(): void {
        if (this.currentPass) {
            this.currentPass.end();
            this.currentPass = null;
        }
        if (this.currentEncoder && this.currentTexture) {
            this.queue.submit([this.currentEncoder.finish()]);
            this.currentEncoder = null;
            this.currentTexture = null;
        }
    }

    private _beginPass(clearColor: GPUColor | null): void {
        this._endFrame();
        const tex = this.context.getCurrentTexture();
        this.currentTexture = tex;
        this.currentEncoder = this.device.createCommandEncoder();
        const view = tex.createView();
        if (!this.depthTexture && tex.width > 0 && tex.height > 0) {
            this.setViewport(0, 0, tex.width, tex.height);
        }
        const clearVal: GPUColor = clearColor ?? { r: 0.1, g: 0.1, b: 0.15, a: 1 };
        const passDesc: GPURenderPassDescriptor = {
            colorAttachments: [{
                view,
                clearValue: clearVal,
                loadOp: clearColor ? 'clear' : 'load',
                storeOp: 'store',
            }],
            depthStencilAttachment: this.depthTexture ? {
                view: this.depthTexture.createView(),
                depthClearValue: 1,
                depthLoadOp: 'clear',
                depthStoreOp: 'store',
            } : undefined,
        };
        this.currentPass = this.currentEncoder.beginRenderPass(passDesc);
        this.currentPass.setViewport(
            this.viewport.x, this.viewport.y, this.viewport.w, this.viewport.h,
            0, 1,
        );
    }

    clear(r = 0.1, g = 0.1, b = 0.15): void {
        this._beginPass({ r, g, b, a: 1 });
    }

    fadeScreen(r = 0.1, g = 0.1, b = 0.15, alpha = 0.3): void {
        this._beginPass(null);
        this.currentPass!.setPipeline(this.quadPipeline);
        const quadVerts = new Float32Array([
            -1, -1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, 1, 1, 0, -1, 1, 0,
        ]);
        const quadBuffer = this.device.createBuffer({
            size: quadVerts.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        this.queue.writeBuffer(quadBuffer, 0, quadVerts);
        const quadUniformData = new ArrayBuffer(QUAD_UNIFORM_SIZE);
        const quadView = new DataView(quadUniformData);
        quadView.setFloat32(0, alpha, true);
        quadView.setFloat32(4, r, true);
        quadView.setFloat32(8, g, true);
        quadView.setFloat32(12, b, true);
        this.queue.writeBuffer(this.quadUniformBuffer, 0, quadUniformData);
        const quadBindGroup = this.device.createBindGroup({
            layout: this.quadBindGroupLayout,
            entries: [{ binding: 0, resource: { buffer: this.quadUniformBuffer } }],
        });
        this.currentPass!.setBindGroup(0, quadBindGroup);
        this.currentPass!.setVertexBuffer(0, quadBuffer);
        this.currentPass!.draw(6);
        quadBuffer.destroy();
    }

    setCamera(
        fov: number, aspect: number, near: number, far: number,
        eyeX: number, eyeY: number, eyeZ: number,
        targetX = 0, targetY = 0.5, targetZ = 0,
    ): void {
        const proj = perspective(fov, aspect, near, far);
        const view = lookAt(eyeX, eyeY, eyeZ, targetX, targetY, targetZ, 0, 1, 0);
        this.proj.set(proj);
        this.modelView.set(view);
        const lx = eyeX - targetX, ly = eyeY - targetY + 0.5, lz = eyeZ - targetZ;
        const ll = Math.sqrt(lx * lx + ly * ly + lz * lz) || 1;
        this.lightDir[0] = lx / ll;
        this.lightDir[1] = ly / ll;
        this.lightDir[2] = lz / ll;
    }

    setCulling(enable: boolean): void {
        this.cullingEnabled = enable;
    }

    endFrame(): void {
        this._endFrame();
    }

    drawMesh(
        mesh: MeshData,
        vertices: Vec3[],
        normals: Vec3[],
        texture: TextureHandle | null = null,
    ): void {
        if (!this.currentPass) this._beginPass(null);

        const posData: number[] = [];
        const normData: number[] = [];
        const uvData: number[] = [];
        const indexData: number[] = [];

        for (let i = 0; i < vertices.length; i++) {
            const v = vertices[i];
            const n = normals[i];
            const uv = mesh.uvs[i] || { x: 0, y: 0 };
            if (v && n) {
                posData.push(v.x, v.y, v.z);
                normData.push(n.x, n.y, n.z);
                uvData.push(uv.x, uv.y);
            } else {
                posData.push(0, 0, 0);
                normData.push(0, 1, 0);
                uvData.push(0, 0);
            }
        }
        for (const face of mesh.faces) {
            indexData.push(face.a, face.b, face.c);
        }

        if (!Renderer.loggedMeshes.has(mesh.name)) {
            Renderer.loggedMeshes.add(mesh.name);
            const maxIdx = vertices.length - 1;
            const badIndices = indexData.filter((i) => i < 0 || i > maxIdx);
            console.log(
                `[drawMesh] "${mesh.name}" verts=${vertices.length} tris=${mesh.faces.length} hasTex=${!!texture} badIndices=${badIndices.length}`,
            );
        }

        const vertexCount = posData.length / 3;
        const interleaved = new Float32Array(vertexCount * 8);
        for (let i = 0; i < vertexCount; i++) {
            interleaved[i * 8 + 0] = posData[i * 3];
            interleaved[i * 8 + 1] = posData[i * 3 + 1];
            interleaved[i * 8 + 2] = posData[i * 3 + 2];
            interleaved[i * 8 + 3] = normData[i * 3];
            interleaved[i * 8 + 4] = normData[i * 3 + 1];
            interleaved[i * 8 + 5] = normData[i * 3 + 2];
            interleaved[i * 8 + 6] = uvData[i * 2];
            interleaved[i * 8 + 7] = uvData[i * 2 + 1];
        }
        const uniformData = new ArrayBuffer(UNIFORM_SIZE);
        const view = new DataView(uniformData);
        for (let i = 0; i < 16; i++) view.setFloat32(i * 4, this.proj[i], true);
        for (let i = 0; i < 16; i++) view.setFloat32(64 + i * 4, this.modelView[i], true);
        view.setFloat32(128, this.lightDir[0], true);
        view.setFloat32(132, this.lightDir[1], true);
        view.setFloat32(136, this.lightDir[2], true);
        view.setFloat32(140, this.alpha, true);
        view.setFloat32(144, this.fadeColor[0], true);
        view.setFloat32(148, this.fadeColor[1], true);
        view.setFloat32(152, this.fadeColor[2], true);
        view.setUint32(156, texture ? 1 : 0, true);
        this.queue.writeBuffer(this.uniformBuffer, 0, uniformData);

        const texToUse = texture ?? this.dummyTexture;
        const meshBindGroup = this.device.createBindGroup({
            layout: this.meshBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.uniformBuffer } },
                { binding: 1, resource: texToUse.createView() },
                { binding: 2, resource: this.defaultSampler },
            ],
        });

        const vb = this.device.createBuffer({
            size: interleaved.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        this.queue.writeBuffer(vb, 0, interleaved);
        const ib = this.device.createBuffer({
            size: indexData.length * 2,
            usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
        });
        this.queue.writeBuffer(ib, 0, new Uint16Array(indexData));

        const meshPipe = this.cullingEnabled ? this.meshPipeline : this.meshPipelineNoCull;
        this.currentPass!.setPipeline(meshPipe);
        this.currentPass!.setBindGroup(0, meshBindGroup);
        this.currentPass!.setVertexBuffer(0, vb);
        this.currentPass!.setIndexBuffer(ib, 'uint16');
        this.currentPass!.drawIndexed(indexData.length);
        vb.destroy();
        ib.destroy();
    }

    drawDiamond(
        x: number, y: number, z: number,
        size: number, rotY: number,
        r: number, g: number, b: number, alpha = 1.0,
    ): void {
        if (!this.currentPass) this._beginPass(null);

        const N = 6;
        const s = size;
        const h = size * 2.2;
        const eq: { x: number; y: number; z: number }[] = [];
        for (let i = 0; i < N; i++) {
            const a = rotY + (i / N) * Math.PI * 2;
            eq.push({ x: s * Math.cos(a), y: 0, z: s * Math.sin(a) });
        }
        const top = { x: 0, y: h, z: 0 };
        const bot = { x: 0, y: -h, z: 0 };
        const tris: { x: number; y: number; z: number }[] = [];
        for (let i = 0; i < N; i++) {
            const next = (i + 1) % N;
            tris.push(eq[i], eq[next], top);
            tris.push(eq[i], eq[next], bot);
        }

        const posData = new Float32Array(tris.length * 3);
        const normData = new Float32Array(tris.length * 3);
        const uvData = new Float32Array(tris.length * 2);
        for (let i = 0; i < tris.length; i += 3) {
            const a = tris[i], b2 = tris[i + 1], c = tris[i + 2];
            let nx = (b2.y - a.y) * (c.z - a.z) - (b2.z - a.z) * (c.y - a.y);
            let ny = (b2.z - a.z) * (c.x - a.x) - (b2.x - a.x) * (c.z - a.z);
            let nz = (b2.x - a.x) * (c.y - a.y) - (b2.y - a.y) * (c.x - a.x);
            const nl = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1;
            nx /= nl; ny /= nl; nz /= nl;
            for (let j = 0; j < 3; j++) {
                const v = tris[i + j];
                const vi = (i + j) * 3;
                posData[vi] = v.x + x;
                posData[vi + 1] = v.y + y;
                posData[vi + 2] = v.z + z;
                normData[vi] = nx;
                normData[vi + 1] = ny;
                normData[vi + 2] = nz;
                uvData[(i + j) * 2] = 0;
                uvData[(i + j) * 2 + 1] = 0;
            }
        }

        const savedAlpha = this.alpha;
        const savedFade = new Float32Array(this.fadeColor);
        this.alpha = alpha;
        this.fadeColor[0] = r;
        this.fadeColor[1] = g;
        this.fadeColor[2] = b;
        const vertexCount = tris.length;
        const interleaved = new Float32Array(vertexCount * 8);
        for (let i = 0; i < vertexCount; i++) {
            interleaved[i * 8 + 0] = posData[i * 3];
            interleaved[i * 8 + 1] = posData[i * 3 + 1];
            interleaved[i * 8 + 2] = posData[i * 3 + 2];
            interleaved[i * 8 + 3] = normData[i * 3];
            interleaved[i * 8 + 4] = normData[i * 3 + 1];
            interleaved[i * 8 + 5] = normData[i * 3 + 2];
            interleaved[i * 8 + 6] = uvData[i * 2];
            interleaved[i * 8 + 7] = uvData[i * 2 + 1];
        }
        const uniformData = new ArrayBuffer(UNIFORM_SIZE);
        const view = new DataView(uniformData);
        for (let i = 0; i < 16; i++) view.setFloat32(i * 4, this.proj[i], true);
        for (let i = 0; i < 16; i++) view.setFloat32(64 + i * 4, this.modelView[i], true);
        view.setFloat32(128, this.lightDir[0], true);
        view.setFloat32(132, this.lightDir[1], true);
        view.setFloat32(136, this.lightDir[2], true);
        view.setFloat32(140, this.alpha, true);
        view.setFloat32(144, r, true);
        view.setFloat32(148, g, true);
        view.setFloat32(152, b, true);
        view.setUint32(156, 0, true);
        this.queue.writeBuffer(this.uniformBuffer, 0, uniformData);
        const diamondBindGroup = this.device.createBindGroup({
            layout: this.meshBindGroupLayout,
            entries: [
                { binding: 0, resource: { buffer: this.uniformBuffer } },
                { binding: 1, resource: this.dummyTexture.createView() },
                { binding: 2, resource: this.defaultSampler },
            ],
        });
        const vb = this.device.createBuffer({
            size: interleaved.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });
        this.queue.writeBuffer(vb, 0, interleaved);
        const meshPipe = this.cullingEnabled ? this.meshPipeline : this.meshPipelineNoCull;
        this.currentPass!.setPipeline(meshPipe);
        this.currentPass!.setBindGroup(0, diamondBindGroup);
        this.currentPass!.setVertexBuffer(0, vb);
        this.currentPass!.draw(vertexCount);
        vb.destroy();
        this.alpha = savedAlpha;
        this.fadeColor.set(savedFade);
    }
}
