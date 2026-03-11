/// <reference types="@webgpu/types" />
import type { TextureHandle } from 'vitamoo';

export interface Vec3 {
    x: number;
    y: number;
    z: number;
}

export interface TopPhysicsState {
    active: boolean;
    tilt: number;
    tiltTarget: number;
    precessionAngle: number;
    nutationPhase: number;
    nutationAmp: number;
    driftX: number;
    driftZ: number;
    driftVX: number;
    driftVZ: number;
}

export interface BodyMeshEntry {
    mesh: any;
    boneMap: Map<string, any>;
    texture: TextureHandle | null;
}

export interface Body {
    skeleton: any[] | null;
    meshes: BodyMeshEntry[];
    practice: any | null;
    personData: any | null;
    actorName: string;
    x: number;
    z: number;
    direction: number;
    spinOffset: number;
    spinVelocity: number;
    top: TopPhysicsState;
}

export function createBody(): Body {
    return {
        skeleton: null,
        meshes: [],
        practice: null,
        personData: null,
        actorName: '',
        x: 0,
        z: 0,
        direction: 0,
        spinOffset: 0,
        spinVelocity: 0,
        top: {
            active: false, tilt: 0, tiltTarget: 0,
            precessionAngle: 0, nutationPhase: 0, nutationAmp: 0,
            driftX: 0, driftZ: 0, driftVX: 0, driftVZ: 0,
        },
    };
}

export function createTopState(): TopPhysicsState {
    return {
        active: false, tilt: 0, tiltTarget: 0,
        precessionAngle: 0, nutationPhase: 0, nutationAmp: 0,
        driftX: 0, driftZ: 0, driftVX: 0, driftVZ: 0,
    };
}
