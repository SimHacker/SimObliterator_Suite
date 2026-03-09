# VitaMoo Demo — SimShow Reimplementation and More

Browser-based character viewer for Sims 1 meshes, skeletons, and animations. Reimplements the original **SimShow** (Maxis, 1999) and extends it with multi-character scenes, procedural Simlish voice, top-physics spin, and WebGL rendering.

## Files

- **`index.html`** — Single-page layout: sidebar (Scene / Actor / Character / Animation) + canvas + controls + help dialog.
- **`viewer.js`** — All demo logic (~2.5k lines): content loading, UI, rendering loop, camera, voice, top physics.
- **`viewer.css`** — Layout and styling for the viewer.
- **`content.json`** — Content index: skeletons, suits, meshes, animations, CFP files, character presets, scenes.
- **`data/`** — Sims asset files (`.cmx`, `.skn`, `.cfp`, `.bmp`) referenced by `content.json`.

The demo imports the compiled VitaMoo library from the same directory (e.g. `parser.js`, `skeleton.js`, `renderer.js`, `texture.js`, `animation.js`) after `npm run build`.

## Original SimShow vs This Demo

**SimShow (1999):** MFC dialog, DirectX 3.0, VitaBoy pipeline. One character (default: Dad Fit + RomanCrew head). Distance presets, 4-corner rotation, slow/fast auto-rotate, body/head/hand dropdowns, texture filtering, animation list, “Import Into Game” export.

**This version:** Same VitaBoy data (CMX/SKN/CFP). Adds:

- **Solo and scene mode** — one character or a multi-body scene with independent characters
- **Scene presets** — `content.json` `scenes[]` with `cast[]` (character name, position, direction, optional animation)
- **Per-actor selection** — “All” or a specific actor; Character/Animation apply to selection
- **Drag momentum** — spin with velocity decay instead of fixed corners
- **Top physics** — optional spinning-top motion per body (precession, nutation, drift)
- **Procedural voice** — Web Audio formant synthesis: spin “weeeoooaaaaawww” and Simlish greet on scene/character change
- **Keyboard shortcuts** — N/P scene, A/D actor, W/S character, Q/E animation, 0 pause, 1–9 speed, arrows zoom/spin

## Architecture (viewer.js)

The file is a single module with shared state and no internal imports. Logical sections:

### State and content

- **`content`** — Parsed assets: `skeletons`, `suits`, `skills`, `meshes`, `textures` (name → data or filename)
- **`contentIndex`** — Loaded `content.json` (defaults, characters, scenes, file lists)
- **`bodies`** — Array of body objects (skeleton, meshes, practice, position, top state, personData).
- **`activeScene`** — Current scene name or null
- **`selectedActorIndex`** — Which body is selected for editing (-1 = “All”)

### Content loading

- **`loadContentIndex()`** — Fetches `content.json`, then in parallel: all CMX (skeletons, suits, animations), all SKN meshes, skeleton cache, character textures, CFP files. Fills `content` and `cfpIndex`, then `populateMenus()`, then loads first scene or first character
- **`buildCfpIndex()`** — Maps animation file name → CFP filename from `content.json.cfp_files`
- **`getTexture(baseName)`** — Loads/caches WebGL texture from `data/` using `content.textures`
- **`loadScene(sceneIndex)`** — Builds one body per scene cast member (skeleton, meshes, textures, animation), then atomically replaces `bodies`
- **`loadAnimationForBody(animName, skeleton)`** — Resolves skill, loads CFP if needed, returns a `Practice` instance for that skeleton

### Solo vs scene

- **Solo:** Legacy “detail” selects (skeleton, body, head, hands, textures) are not shown in the current UI; character presets drive everything. `updateScene()` builds a single body from current character preset and sets `activeSkeleton`, `activeMeshes`, `activePractice`
- **Scene:** `loadScene()` builds `bodies[]` from `contentIndex.scenes[].cast`. Actor dropdown selects which body (or “All”) the Character/Animation dropdowns affect. `applyCharacterToActor()` / `applyAnimationToActor()` rebuild one body in place

### Rendering

- **`initRenderer()`** — Creates `Renderer` (WebGL), sets viewport
- **`renderFrame()`** — Reads camera (rotY, rotX, zoom), updates top physics for each body, ticks each body’s `Practice`, updates skeleton transforms, deforms meshes, draws all bodies with optional stage orbit
- **`animationLoop(timestamp)`** — `requestAnimationFrame` loop: delta time → tick practices (unless paused), `updateSpinSound()`, `renderFrame()`

### Camera and interaction

- **Camera** — Target from `cameraTarget` (or center of group); distance from zoom slider; rotY/rotX for orbit. Left-drag: spin selected body(ies) and zoom. Right-drag: orbit stage
- **Rotation momentum** — `rotationVelocity` updated from drag delta, decayed by `FRICTION` each frame; applied to selected body spin or stage
- **Distance presets** — Far / Med / Near set zoom slider

### Top physics (spinning top)

- **`top`** (solo) and **`body.top`** (each body): `active`, `tilt`, `tiltTarget`, `precessionAngle`, `nutationPhase`, `nutationAmp`, `driftX/Z`, `driftVX/VZ`
- **`updateTopPhysics(dt)`** — Precession, nutation, tilt smoothing, drift
- **`applyTopTransformFor(v, t)`** — Transforms a direction vector by tilt and precession for rendering (e.g. plumb bob)

### Voice (Web Audio)

- **`ensureAudio()` / `initSpinSound()`** — Create `AudioContext` on first user gesture; create solo `spinFormants` voice chain (glottal oscillators + noise → 3 bandpass formants → gain → panner)
- **`createVoiceChain()`** — One chain: 2 sawtooth oscillators + noise → 3 bandpass filters (formants) → master gain → stereo panner
- **`simlishGreet(actorIdx)`** — Short “aah!” on scene load or actor/character change; one oscillator per greeting body, panned by position
- **`ensureBodyVoices()`** — In scene mode, one voice chain per body in `bodyVoices[]`
- **`updateSpinSound()`** — Drives solo or per-body chains from spin speed and top state: pitch, formant sweep (vowel dipthong from precession angle), volume, pan
- **`getVoiceType()`** — Voice params (pitch, range, formant, breathiness) from `content.json` character `voice` or auto-detected from body/skeleton name (child/female/male)
- **`lerpVowel(angle, tiltAmount)`** — Interpolates formant targets (ee → oo → aa → aw) for spin voice

### UI and events

- **`populateMenus()`** — Fill Scene, Character, Animation dropdowns from `contentIndex` and `content.skills`
- **`setupEventListeners()`** — Dropdowns, sliders, buttons, keyboard (N/P, A/D, W/S, Q/E, 0, 1–9, arrows, Space, Help), canvas focus, resize
- **`setupMouseInteraction()`** — Canvas mousedown/move/up/wheel; left = spin+zoom, right = orbit; click to select actor (raycast or proximity)

## content.json schema (summary)

- **`skeletons`** — List of CMX filenames (skeleton definitions)
- **`suits`** — List of CMX filenames (suit/body part definitions)
- **`animations`** — List of CMX filenames (animation skills)
- **`meshes`** — List of SKN filenames (skinned meshes)
- **`textures_bmp`** / **`textures_png`** — Texture filenames (keyed by base name in `content.textures`)
- **`cfp_files`** — List of CFP filenames (binary animation data); used to build `cfpIndex`
- **`defaults`** — Optional default skeleton, body, head, hands, textures, animation (solo fallback)
- **`characters`** — Array of presets: `name`, `skeleton`, `body`, `head`, `leftHand`, `rightHand`, `bodyTexture`, `headTexture`, `handTexture`, `animation`, optional **`voice`** `{ pitch, range, formant, breathiness }`
- **`scenes`** — Array of scenes: `name`, **`cast`** array of `{ character, actor?, x?, z?, direction?, animation? }`

## Refactoring ideas

- **Split viewer.js into modules** — e.g. `content-loader.js`, `scene.js`, `camera.js`, `ui.js`, `voice.js`, `top-physics.js`, `mouse.js`. Entry point assembles them and runs the loop. Reduces one large file and clarifies dependencies.
- **Voice as an optional module** — Export a small API: `initAudio()`, `createVoiceChain()`, `playGreet(bodies, options)`, `updateSpinVoices(bodies, selectedIndex, rotationVelocity, getVoiceParams)`. The rest of the viewer only calls these; voice can be stubbed or replaced (e.g. sampled Simlish) without touching rendering or scene logic.
- **Top physics in one place** — Move `updateTopPhysics`, `applyTopTransformFor`, and top state shape into a single module or class so rendering and voice only consume “current tilt/precession/drift” and don’t know the integration details.
- **Scene loader as a clear pipeline** — `loadScene()` is long; could be a function that returns a list of “body descriptors” (skeleton name, character ref, position, animation name) and a separate “build body from descriptor” that handles fetch/cache and returns a body object. Easier to test and to add loading progress or error reporting per cast member.
- **Character/actor application** — `applyCharacter()`, `applyCharacterToActor()`, `applyAnimationToActor()` share a lot of “resolve skeleton, resolve meshes, load animation, assign to body.” A shared “build body from character index + optional overrides” helper would reduce duplication and keep solo vs scene behavior in sync.

These changes would make the demo easier to maintain and would allow the voice or top-physics behavior to be reused or swapped in other VitaMoo-based apps.
