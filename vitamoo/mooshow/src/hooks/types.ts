export type KeyAction =
    | 'stepSceneNext' | 'stepScenePrev'
    | 'stepActorNext' | 'stepActorPrev'
    | 'stepCharacterNext' | 'stepCharacterPrev'
    | 'stepAnimationNext' | 'stepAnimationPrev'
    | 'togglePause' | 'toggleHelp'
    | 'setSpeed';

export interface MooShowHooks {
    onPick?: (actorIndex: number, x: number, y: number) => void;
    onHover?: (actorIndex: number | null) => void;
    onSelectionChange?: (actorIndex: number | null) => void;
    onHighlight?: (actorIndex: number | null) => void;
    onPlumbBobChange?: (actorIndex: number | null, visible: boolean) => void;
    onSceneChange?: (sceneName: string | null) => void;
    onAnimationTick?: (time: number) => void;
    onKeyAction?: (action: KeyAction, value?: number) => void;
}
