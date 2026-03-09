import { Renderer, updateTransforms, deformMesh } from 'vitamoo';
import type { MooShowHooks } from '../hooks/types.js';
import { defaultHooks } from '../hooks/defaults.js';
import { ContentLoader } from './content-loader.js';
import type { ContentIndex, CharacterDef, SceneDef } from './content-loader.js';
import type { Body, Vec3 } from './types.js';
import { SpinController } from '../interaction/spin-controller.js';
import { tickTopPhysics, applyTopTransform, TOP_MAX_TILT } from '../interaction/top-physics.js';
import { pickActorAtScreen, perspectiveMatrix, lookAtMatrix } from '../interaction/picking.js';
import { SoundEngine } from '../audio/sound-engine.js';

export interface StageConfig {
    canvas: HTMLCanvasElement;
    hooks?: MooShowHooks;
    assetsBaseUrl?: string;
}

export class MooShowStage {
    readonly canvas: HTMLCanvasElement;
    readonly hooks: MooShowHooks;
    readonly loader: ContentLoader;
    readonly spin: SpinController;
    readonly sound: SoundEngine;

    private _renderer: any = null;
    private _running = false;
    private _rafId = 0;
    private _animTime = 0;
    private _lastFrameTime = 0;
    private _paused = false;
    private _speedScale = 1.0;
    private _keysHeld = { up: false, down: false, left: false, right: false, leftStart: 0, rightStart: 0 };

    private _bodies: Body[] = [];
    private _selectedActor = -1;
    private _activeScene: string | null = null;
    private _cameraTarget: Vec3 = { x: 0, y: 2.5, z: 0 };

    constructor(config: StageConfig) {
        this.canvas = config.canvas;
        this.hooks = { ...defaultHooks, ...config.hooks };
        this.loader = new ContentLoader(config.assetsBaseUrl ?? '');
        this.spin = new SpinController();
        this.sound = new SoundEngine();

        this._initRenderer();
        this._bindCanvasEvents();
    }

    private _initRenderer(): void {
        this.canvas.width = this.canvas.clientWidth;
        this.canvas.height = this.canvas.clientHeight;
        try {
            this._renderer = new Renderer(this.canvas);
            this._renderer.context.viewport(0, 0, this.canvas.width, this.canvas.height);
        } catch (e) {
            console.error('WebGL init failed:', e);
        }
        if (this._renderer) {
            this.loader.setGL(this._renderer.context);
        }
    }

    get contentIndex(): ContentIndex | null { return this.loader.index; }
    get bodies(): Body[] { return this._bodies; }
    get selectedActor(): number { return this._selectedActor; }
    get activeScene(): string | null { return this._activeScene; }
    get paused(): boolean { return this._paused; }
    get running(): boolean { return this._running; }

    get scenes(): SceneDef[] { return this.loader.index?.scenes || []; }
    get characters(): CharacterDef[] { return this.loader.index?.characters || []; }
    get skillNames(): string[] { return Object.keys(this.loader.store.skills); }

    async loadContentIndex(url: string, onProgress?: (msg: string) => void): Promise<ContentIndex> {
        const idx = await this.loader.loadIndex(url);
        await this.loader.loadAllContent(onProgress);
        return idx;
    }

    async setScene(sceneIndex: number): Promise<void> {
        const scenes = this.loader.index?.scenes;
        if (!scenes?.[sceneIndex]) return;

        const newBodies = await this.loader.loadScene(sceneIndex);
        this._bodies = newBodies;
        this._activeScene = scenes[sceneIndex].name;
        this._selectedActor = newBodies.length === 1 ? 0 : -1;

        if (newBodies.length > 0) {
            let cx = 0, cz = 0;
            for (const b of newBodies) { cx += b.x; cz += b.z; }
            cx /= newBodies.length; cz /= newBodies.length;
            this._cameraTarget = { x: cx, y: 2.5, z: cz };
        }

        this.hooks.onSceneChange?.(this._activeScene);
        this.hooks.onSelectionChange?.(this._selectedActor);
        this._renderFrame();
    }

    async setCharacterSolo(charIndex: number): Promise<void> {
        const chars = this.loader.index?.characters;
        if (!chars?.[charIndex]) return;
        this._activeScene = null;
        const body = await this.loader.loadCharacterBody(chars[charIndex]);
        this._bodies = body ? [body] : [];
        this._selectedActor = this._bodies.length === 1 ? 0 : -1;
        if (body) {
            this._computeCameraTarget(body.skeleton);
            this.sound.simlishGreet(0, this._bodies);
        }
        this.hooks.onSceneChange?.(null);
        this.hooks.onSelectionChange?.(this._selectedActor);
        this._renderFrame();
    }

    selectActor(idx: number): void {
        if (idx < -1 || idx >= this._bodies.length) return;
        const prev = this._selectedActor;
        if (prev === idx) {
            this.sound.simlishGreet(idx, this._bodies);
            return;
        }

        const rotYDeg = this.spin.rotY;
        if (prev >= 0 && prev < this._bodies.length) {
            this._bodies[prev].spinOffset += rotYDeg;
        } else if (prev < 0) {
            for (const b of this._bodies) b.spinOffset += rotYDeg;
        }
        if (idx >= 0 && idx < this._bodies.length) {
            this._bodies[idx].spinOffset -= rotYDeg;
        } else if (idx < 0) {
            for (const b of this._bodies) b.spinOffset -= rotYDeg;
        }

        for (let i = 0; i < this._bodies.length; i++) {
            const shouldBeActive = (idx < 0 || i === idx);
            if (!shouldBeActive && this._bodies[i].top.active) {
                this._bodies[i].top.tiltTarget = 0;
            }
        }

        this._selectedActor = idx;
        this.hooks.onSelectionChange?.(idx);
        this.sound.simlishGreet(idx, this._bodies);
    }

    async setAnimation(animName: string, actorIndex?: number): Promise<void> {
        const targets = (actorIndex !== undefined && actorIndex >= 0)
            ? [actorIndex]
            : this._bodies.map((_, i) => i);
        for (const i of targets) {
            const body = this._bodies[i];
            if (!body?.skeleton) continue;
            const practice = await this.loader._loadAnimation(animName, body.skeleton);
            if ((practice as any)?.ready) {
                (practice as any).tick(this._animTime > 0 ? this._animTime : 1);
                updateTransforms(body.skeleton);
            }
            body.practice = practice;
        }
        this._renderFrame();
    }

    pick(screenX: number, screenY: number): number {
        if (this._bodies.length === 0) return -1;
        return pickActorAtScreen(
            screenX, screenY,
            this.canvas.getBoundingClientRect(),
            this.canvas.width, this.canvas.height,
            this._bodies, this._cameraTarget,
            this.spin.rotY, this.spin.rotX, this.spin.zoom,
            this._selectedActor
        );
    }

    set speedScale(v: number) { this._speedScale = v; }
    get speedScale(): number { return this._speedScale; }

    togglePause(): void {
        this._paused = !this._paused;
        if (!this._paused) this._lastFrameTime = 0;
    }

    start(): void {
        if (this._running) return;
        this._running = true;
        this._lastFrameTime = 0;
        this._rafId = requestAnimationFrame(this._loop);
    }

    stop(): void {
        this._running = false;
        if (this._rafId) cancelAnimationFrame(this._rafId);
        this._rafId = 0;
    }

    render(): void {
        this._renderFrame();
    }

    destroy(): void {
        this.stop();
    }

    private _loop = (timestamp: number): void => {
        if (!this._running) return;
        let needsRender = false;

        if (!this._paused) {
            if (this._lastFrameTime === 0) this._lastFrameTime = timestamp;
            const dt = timestamp - this._lastFrameTime;
            this._lastFrameTime = timestamp;
            this._animTime += dt * this._speedScale;

            for (const body of this._bodies) {
                if ((body.practice as any)?.ready && body.skeleton) {
                    (body.practice as any).tick(this._animTime);
                    updateTransforms(body.skeleton);
                    needsRender = true;
                }
            }
        }

        if (this.spin.tickMomentum()) {
            if (this._bodies.length > 0) {
                if (this._selectedActor >= 0 && this._selectedActor < this._bodies.length) {
                    this._bodies[this._selectedActor].spinOffset += this.spin.rotationVelocity;
                } else {
                    for (const b of this._bodies) b.spinOffset += this.spin.rotationVelocity;
                }
            } else {
                this.spin.rotY += this.spin.rotationVelocity;
                if (this.spin.rotY > 360) this.spin.rotY -= 360;
                if (this.spin.rotY < 0) this.spin.rotY += 360;
            }
            needsRender = true;
        }

        for (const b of this._bodies) {
            if (Math.abs(b.spinVelocity) > 0.001) {
                b.spinOffset += b.spinVelocity;
                b.spinVelocity *= 0.993;
                needsRender = true;
            }
        }

        const rv = this.spin.rotationVelocity;
        const saved = this.spin.rotationVelocity;
        for (let i = 0; i < this._bodies.length; i++) {
            const isSelected = (this._selectedActor < 0 || i === this._selectedActor);
            if (isSelected) {
                tickTopPhysics(this._bodies[i].top, rv);
            } else if (this._bodies[i].top.active) {
                tickTopPhysics(this._bodies[i].top, 0);
            }
        }
        this.spin.rotationVelocity = saved;

        const anyTopActive = this._bodies.some(b => b.top.active);
        if (anyTopActive) needsRender = true;

        if (this._keysHeld.up || this._keysHeld.down) {
            const zoomDelta = this._keysHeld.down ? 1.5 : -1.5;
            this.spin.zoom = Math.max(15, Math.min(400, this.spin.zoom + zoomDelta));
            needsRender = true;
        }
        if (this._keysHeld.left || this._keysHeld.right) {
            const now = performance.now();
            const dir = this._keysHeld.left ? 1 : -1;
            const holdTime = this._keysHeld.left
                ? (now - this._keysHeld.leftStart) / 1000
                : (now - this._keysHeld.rightStart) / 1000;
            const speed = 0.5 + Math.min(holdTime * 5.0, 16.0);
            this.spin.rotationVelocity = dir * speed;
            needsRender = true;
        }

        this.sound.updateSpinSound(this.spin.rotationVelocity, this._bodies, this._selectedActor);

        this.hooks.onAnimationTick?.(this._animTime);
        if (needsRender) this._renderFrame();

        this._rafId = requestAnimationFrame(this._loop);
    };

    private _renderFrame(): void {
        if (!this._renderer) return;

        const spinSpeed = Math.abs(this.spin.rotationVelocity);
        const anyActive = this._bodies.some(b => b.top.active);

        if (anyActive && spinSpeed > 1.0) {
            const trailLength = Math.max(0.08, 0.4 - spinSpeed * 0.02);
            this._renderer.fadeScreen(0.1, 0.1, 0.15, trailLength);
        } else {
            this._renderer.clear();
        }

        const zoom = this.spin.zoom / 10;
        const rotYRad = this.spin.rotY * Math.PI / 180;
        const rotXRad = this.spin.rotX * Math.PI / 180;
        const cosX = Math.cos(rotXRad);

        const eyeX = Math.sin(rotYRad) * cosX * zoom;
        const eyeY = this._cameraTarget.y + Math.sin(rotXRad) * zoom;
        const eyeZ = Math.cos(rotYRad) * cosX * zoom;

        this._renderer.setCamera(50, this.canvas.width / this.canvas.height, 0.01, 100,
            eyeX, eyeY, eyeZ,
            this._cameraTarget.x, this._cameraTarget.y, this._cameraTarget.z);

        for (let bi = 0; bi < this._bodies.length; bi++) {
            const body = this._bodies[bi];
            const bTop = body.top;
            const spinDeg = (body.direction || 0) + (body.spinOffset || 0);
            const bodyDir = spinDeg * Math.PI / 180;
            const cosD = Math.cos(bodyDir);
            const sinD = Math.sin(bodyDir);

            for (const { mesh, boneMap, texture } of body.meshes) {
                try {
                    let verts: any[], norms: any[];
                    if (body.skeleton) {
                        const deformed = deformMesh(mesh, body.skeleton, boneMap);
                        verts = deformed.vertices;
                        norms = deformed.normals;
                    } else {
                        verts = mesh.vertices;
                        norms = mesh.normals;
                    }

                    if (bTop.active) {
                        verts = verts.map((v: any) => applyTopTransform(v, bTop, this._cameraTarget.y));
                        norms = norms.map((v: any) => applyTopTransform(v, bTop, this._cameraTarget.y));
                    }

                    if (body.x !== 0 || body.z !== 0 || bodyDir !== 0) {
                        verts = verts.map((v: any) => {
                            if (!v) return v;
                            const rx = v.x * cosD - v.z * sinD;
                            const rz = v.x * sinD + v.z * cosD;
                            return { x: rx + body.x, y: v.y, z: rz + body.z };
                        });
                        if (bodyDir !== 0) {
                            norms = norms.map((v: any) => {
                                if (!v) return v;
                                return { x: v.x * cosD - v.z * sinD, y: v.y, z: v.x * sinD + v.z * cosD };
                            });
                        }
                    }

                    this._renderer.drawMesh(mesh, verts, norms, texture || null);
                } catch { /* skip bad mesh */ }
            }
        }

        if (this._bodies.length > 0) {
            const now = performance.now();
            const plumbRot = now * 0.001 * Math.PI;
            const bob = Math.sin(now * 0.002) * 0.12;
            const indicesToDraw = (this._selectedActor >= 0 && this._selectedActor < this._bodies.length)
                ? [this._selectedActor]
                : this._bodies.map((_, i) => i);

            const drawPlumbBob = (bi: number, body: Body) => {
                if (!body.skeleton) return;
                const headBone = body.skeleton.find((b: any) => b.name === 'HEAD');
                if (!headBone) return;
                const bTop = body.top;
                const sd = (body.direction || 0) + (body.spinOffset || 0);
                const dir = sd * Math.PI / 180;
                const cosD = Math.cos(dir), sinD = Math.sin(dir);
                let hx = headBone.worldPosition.x, hy = headBone.worldPosition.y, hz = headBone.worldPosition.z;
                if (bTop.active) {
                    const t = applyTopTransform({ x: hx, y: hy, z: hz }, bTop, this._cameraTarget.y);
                    hx = t.x; hy = t.y; hz = t.z;
                }
                const rx = hx * cosD - hz * sinD;
                const rz = hx * sinD + hz * cosD;
                this._renderer.drawDiamond(rx + body.x, hy + 1.5 + bob, rz + body.z, 0.18, plumbRot, 0.2, 1.0, 0.2, 0.9);
                this.hooks.onPlumbBobChange?.(bi, true);
            };

            for (const bi of indicesToDraw) {
                drawPlumbBob(bi, this._bodies[bi]);
            }
        }
    }

    private _computeCameraTarget(skeleton: any[] | null): void {
        if (!skeleton || skeleton.length === 0) {
            this._cameraTarget = { x: 0, y: 2.5, z: 0 };
            return;
        }
        let minY = Infinity, maxY = -Infinity;
        for (const bone of skeleton) {
            const y = bone.worldPosition.y;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
        }
        this._cameraTarget = { x: 0, y: (minY + maxY) / 2, z: 0 };
    }

    private _bindCanvasEvents(): void {
        const c = this.canvas;
        c.addEventListener('contextmenu', e => e.preventDefault());
        c.style.cursor = 'grab';

        c.addEventListener('mousedown', (e: MouseEvent) => {
            this.sound.ensureAudio();
            this.spin.startDrag(e.clientX, e.clientY, e.button, e.shiftKey);
            c.style.cursor = 'grabbing';

            if (e.button === 0 && this._bodies.length > 0) {
                const picked = this.pick(e.clientX, e.clientY);
                if (picked >= 0) {
                    this.selectActor(picked);
                    this.hooks.onPick?.(picked, e.clientX, e.clientY);
                } else if (this._bodies.length > 1) {
                    this.selectActor(-1);
                }
            }
            e.preventDefault();
        });

        window.addEventListener('mousemove', (e: MouseEvent) => {
            if (!this.spin.isDragging) return;
            const { spinDelta, zoomDelta, tiltDelta, isOrbit } = this.spin.drag(e.clientX, e.clientY);

            if (this._bodies.length > 0 && !isOrbit) {
                if (this._selectedActor >= 0 && this._selectedActor < this._bodies.length) {
                    this._bodies[this._selectedActor].spinOffset += spinDelta;
                } else {
                    for (const b of this._bodies) b.spinOffset += spinDelta;
                }
            } else {
                this.spin.rotY += spinDelta;
                if (this.spin.rotY > 360) this.spin.rotY -= 360;
                if (this.spin.rotY < 0) this.spin.rotY += 360;
            }

            this.spin.zoom = Math.max(15, Math.min(400, this.spin.zoom + zoomDelta));
            this.spin.rotX = Math.max(-89, Math.min(89, this.spin.rotX + tiltDelta));
            this._renderFrame();
        });

        window.addEventListener('mouseup', () => {
            this.spin.endDrag();
            c.style.cursor = 'grab';
        });

        c.addEventListener('wheel', (e: WheelEvent) => {
            e.preventDefault();
            this.spin.applyWheel(e.deltaY, e.deltaMode, e.ctrlKey);
            this._renderFrame();
        }, { passive: false });

        window.addEventListener('resize', () => {
            c.width = c.clientWidth;
            c.height = c.clientHeight;
            if (this._renderer) this._renderer.context.viewport(0, 0, c.width, c.height);
            this._renderFrame();
        });

        c.tabIndex = 0;
        c.addEventListener('mouseenter', () => c.focus());

        const isInputFocused = () => {
            const tag = document.activeElement?.tagName;
            return tag === 'SELECT' || tag === 'INPUT' || tag === 'TEXTAREA';
        };

        window.addEventListener('keydown', (e: KeyboardEvent) => {
            if (isInputFocused()) return;

            if (e.key === ' ') {
                this.sound.ensureAudio();
                if (this._bodies.length > 0) {
                    if (Math.abs(this.spin.rotationVelocity) > 0.01 &&
                        this._selectedActor >= 0 && this._selectedActor < this._bodies.length) {
                        this._bodies[this._selectedActor].spinVelocity = this.spin.rotationVelocity;
                        this.spin.rotationVelocity = 0;
                    }
                    const minIdx = this._bodies.length > 1 ? -1 : 0;
                    const dir = e.shiftKey ? -1 : 1;
                    let idx = this._selectedActor + dir;
                    if (idx >= this._bodies.length) idx = minIdx;
                    if (idx < minIdx) idx = this._bodies.length - 1;
                    this.selectActor(idx);
                }
                e.preventDefault();
            }

            if (e.key === '0') {
                this.togglePause();
                this.hooks.onKeyAction?.('togglePause');
                e.preventDefault();
            }

            const speedKeys: Record<string, number> = { '1': 25, '2': 50, '3': 100, '4': 150, '5': 200, '6': 300, '7': 500, '8': 750, '9': 1000 };
            if (speedKeys[e.key]) {
                this._paused = false;
                this._speedScale = speedKeys[e.key] / 100;
                this._lastFrameTime = 0;
                this.hooks.onKeyAction?.('setSpeed', speedKeys[e.key]);
                e.preventDefault();
            }

            if (e.key === '?' || e.key === 'h') { this.hooks.onKeyAction?.('toggleHelp'); e.preventDefault(); }
            if (e.key === 'Escape') { this.hooks.onKeyAction?.('toggleHelp'); e.preventDefault(); }

            if (e.key === 'n') { this.hooks.onKeyAction?.('stepSceneNext'); e.preventDefault(); }
            if (e.key === 'p') { this.hooks.onKeyAction?.('stepScenePrev'); e.preventDefault(); }
            if (e.key === 'a') { this.hooks.onKeyAction?.('stepActorPrev'); e.preventDefault(); }
            if (e.key === 'd') { this.hooks.onKeyAction?.('stepActorNext'); e.preventDefault(); }
            if (e.key === 'w') { this.hooks.onKeyAction?.('stepCharacterPrev'); e.preventDefault(); }
            if (e.key === 's') { this.hooks.onKeyAction?.('stepCharacterNext'); e.preventDefault(); }
            if (e.key === 'q') { this.hooks.onKeyAction?.('stepAnimationPrev'); e.preventDefault(); }
            if (e.key === 'e') { this.hooks.onKeyAction?.('stepAnimationNext'); e.preventDefault(); }

            if (e.key === 'ArrowUp') { this._keysHeld.up = true; e.preventDefault(); }
            if (e.key === 'ArrowDown') { this._keysHeld.down = true; e.preventDefault(); }
            if (e.key === 'ArrowLeft') { this._keysHeld.left = true; this._keysHeld.leftStart = this._keysHeld.leftStart || performance.now(); e.preventDefault(); }
            if (e.key === 'ArrowRight') { this._keysHeld.right = true; this._keysHeld.rightStart = this._keysHeld.rightStart || performance.now(); e.preventDefault(); }
        });

        window.addEventListener('keyup', (e: KeyboardEvent) => {
            if (e.key === 'ArrowUp') { this._keysHeld.up = false; e.preventDefault(); }
            if (e.key === 'ArrowDown') { this._keysHeld.down = false; e.preventDefault(); }
            if (e.key === 'ArrowLeft') { this._keysHeld.left = false; this._keysHeld.leftStart = 0; e.preventDefault(); }
            if (e.key === 'ArrowRight') { this._keysHeld.right = false; this._keysHeld.rightStart = 0; e.preventDefault(); }
        });
    }
}

export function createMooShowStage(config: StageConfig): MooShowStage {
    return new MooShowStage(config);
}
