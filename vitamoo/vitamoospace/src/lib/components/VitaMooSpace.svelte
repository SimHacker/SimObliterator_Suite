<script lang="ts">
	import '../styles/viewer-legacy.css';
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import {
		createMooShowStage,
		type MooShowStage,
		type CharacterDef,
		type KeyAction,
	} from 'mooshow';
	import DebugPanel from './DebugPanel.svelte';

	const SKILL_BLACKLIST = [
		'twiststart',
		'twiststop',
		'-start',
		'-stop',
		'-walkon',
		'-walkoff',
		'-divein',
		'-jumpin',
		'a2o-stand',
		'c2o-',
	];

	const LOADING_MESSAGES = [
		'Reticulating Splines...',
		'Adjusting Emotional Weights...',
		'Calibrating Personality Matrix...',
		'Compressing Sim Genomes...',
		'Calculating Snowfall Coefficients...',
		'Tokenizing Elf Language...',
		'Possessing Animate Objects...',
		'Inserting Alarm Clock...',
		'Computing Optimal Bin Packing...',
		'Preparing Neighborly Greetings...',
		'Simmifying Name Savant...',
		'Synthesizing Gravity...',
		'Collecting Bonus Diamonds...',
		'Loading Lovingly Handcrafted Sims...',
		'Applying Alarm Clock Patch...',
		'Fabricating Social Constructs...',
		'Convincing Sims They Have Free Will...',
		'Polishing Countertop Surfaces...',
		'Debugging Dream Sequences...',
		'Unbarricading Elevator...',
		'Reconfiguring Vertical Transporter...',
		'Priming Geodesic Abreaction...',
		'Lecturing Errant Unicorns...',
		'Pressurizing Fruit Punch...',
	];

	function filterSkillNames(names: string[]): string[] {
		return names.filter((name) => {
			const l = name.toLowerCase();
			return !SKILL_BLACKLIST.some((b) => l.includes(b));
		});
	}

	function matchSkillValue(want: string, options: string[]): string {
		if (!want) return '';
		if (options.includes(want)) return want;
		const lower = want.toLowerCase();
		for (const o of options) {
			if (o.toLowerCase() === lower) return o;
		}
		for (const o of options) {
			if (!o) continue;
			const ol = o.toLowerCase();
			if (ol.includes(lower) || lower.includes(ol)) return o;
		}
		return '';
	}

	let canvasEl = $state<HTMLCanvasElement | null>(null);
	let errorMsg = $state<string | null>(null);

	let uiReady = $state(false);
	let loadText = $state('Loading VitaMoo...');
	let overlayDone = $state(false);
	type SidebarTab = 'demo' | 'help' | 'debug';
	let sidebarTab = $state<SidebarTab>('demo');
	let sidebarWidth = $state(280);
	let sidebarCollapsed = $state(false);
	let bottomBarCollapsed = $state(false);
	let sidebarResize = $state<{ startX: number; startW: number } | null>(null);

	function toggleSidebarCollapsed() {
		sidebarCollapsed = !sidebarCollapsed;
	}

	function toggleBottomBarCollapsed() {
		bottomBarCollapsed = !bottomBarCollapsed;
	}

	function beginSidebarResize(e: MouseEvent) {
		e.preventDefault();
		if (sidebarCollapsed) {
			sidebarCollapsed = false;
		}
		sidebarResize = { startX: e.clientX, startW: sidebarWidth };
		window.addEventListener('mousemove', moveSidebarResize);
		window.addEventListener('mouseup', endSidebarResize);
	}

	function moveSidebarResize(e: MouseEvent) {
		const d = sidebarResize;
		if (!d) return;
		const next = d.startW + (e.clientX - d.startX);
		sidebarWidth = Math.min(560, Math.max(200, next));
	}

	function endSidebarResize() {
		sidebarResize = null;
		window.removeEventListener('mousemove', moveSidebarResize);
		window.removeEventListener('mouseup', endSidebarResize);
	}

	$effect(() => {
		return () => {
			window.removeEventListener('mousemove', moveSidebarResize);
			window.removeEventListener('mouseup', endSidebarResize);
		};
	});

	$effect(() => {
		if (!uiReady) return;
		void sidebarCollapsed;
		void sidebarWidth;
		void bottomBarCollapsed;
		const id = requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
		return () => cancelAnimationFrame(id);
	});

	let scenesList = $state<{ name: string }[]>([]);
	let charactersList = $state<CharacterDef[]>([]);
	let animationList = $state<string[]>([]);

	let sceneVal = $state('0');
	let actorSelValue = $state('-1');
	let charSelValue = $state('');
	let animSelValue = $state('');

	let showActorGroup = $state(false);
	let actorOptions = $state<{ value: string; label: string }[]>([]);

	let charPlaceholder = $state('-- all --');
	let animPlaceholder = $state('-- all --');

	let rotY = $state(30);
	let rotX = $state(15);
	let zoom = $state(160);
	let speed = $state(100);

	let distFarActive = $state(false);
	let distMedActive = $state(true);
	let distNearActive = $state(false);

	let pauseLabel = $state('Pause');
	let pauseActive = $state(false);

	let stageRef = $state<MooShowStage | null>(null);

	function applyDistBtnClasses(which: 'far' | 'medium' | 'near') {
		distFarActive = which === 'far';
		distMedActive = which === 'medium';
		distNearActive = which === 'near';
	}

	function setDistance(s: MooShowStage, preset: 'far' | 'medium' | 'near') {
		switch (preset) {
			case 'far':
				zoom = 300;
				break;
			case 'medium':
				zoom = 140;
				break;
			case 'near':
				zoom = 70;
				break;
		}
		s.spin.zoom = zoom;
		applyDistBtnClasses(preset);
		s.render();
	}

	function syncPauseUi(s: MooShowStage) {
		pauseActive = s.paused;
		pauseLabel = s.paused ? 'Play' : 'Pause';
	}

	function pushSpinToStage(s: MooShowStage) {
		s.spin.rotY = rotY;
		s.spin.rotX = rotX;
		s.spin.zoom = zoom;
		s.speedScale = speed / 100;
		s.render();
	}

	/** Range inputs use `value={…}` + oninput so wheel/drag orbit sync updates the thumb (Svelte bind:value can miss external updates). */
	function onRotYRangeInput(e: Event) {
		const v = (e.currentTarget as HTMLInputElement).valueAsNumber;
		rotY = v;
		if (stageRef) pushSpinToStage(stageRef);
	}

	function onRotXRangeInput(e: Event) {
		const v = (e.currentTarget as HTMLInputElement).valueAsNumber;
		rotX = v;
		if (stageRef) pushSpinToStage(stageRef);
	}

	function onZoomRangeInput(e: Event) {
		const z = (e.currentTarget as HTMLInputElement).valueAsNumber;
		zoom = z;
		if (stageRef) {
			stageRef.spin.zoom = z;
			distFarActive = false;
			distMedActive = false;
			distNearActive = false;
			stageRef.render();
		}
	}

	function rebuildActorOptions(s: MooShowStage) {
		const bodies = s.bodies;
		const opts: { value: string; label: string }[] = [];
		if (bodies.length > 1) {
			opts.push({ value: '-1', label: `All (${bodies.length})` });
		}
		for (let i = 0; i < bodies.length; i++) {
			opts.push({ value: String(i), label: bodies[i].actorName || `Actor ${i + 1}` });
		}
		actorOptions = opts;
		showActorGroup = bodies.length > 0;

		if (bodies.length === 1) {
			actorSelValue = '0';
		} else if (bodies.length > 1) {
			actorSelValue = String(s.selectedActor);
		}
	}

	function syncEditingFromStage(s: MooShowStage) {
		const bodies = s.bodies;
		const chars = charactersList;
		const anims = animationList;
		const sel = s.selectedActor;

		if (!s.activeScene || bodies.length === 0) {
			charPlaceholder = '-- all --';
			animPlaceholder = '-- all --';
			return;
		}

		if (sel >= 0 && sel < bodies.length) {
			const body = bodies[sel];
			charPlaceholder = '-- all --';
			animPlaceholder = '-- all --';
			if (body?.personData && chars.length) {
				const ci = chars.findIndex((c) => c.name === body.personData.name);
				if (ci >= 0) charSelValue = String(ci);
			}
			const sk = body?.practice?.skill?.name as string | undefined;
			if (sk) {
				const m = matchSkillValue(sk, anims);
				if (m) animSelValue = m;
			}
		} else {
			const firstChar = bodies[0]?.personData?.name;
			const allSameChar = bodies.every((b) => b.personData?.name === firstChar);
			if (allSameChar && firstChar && chars.length) {
				const ci = chars.findIndex((c) => c.name === firstChar);
				charSelValue = ci >= 0 ? String(ci) : '';
				charPlaceholder = '-- all --';
			} else {
				charSelValue = '';
				charPlaceholder = '-- many --';
			}
			const firstAnim = bodies[0]?.practice?.skill?.name as string | undefined;
			const allSameAnim = bodies.every(
				(b) => (b.practice?.skill?.name as string | undefined) === firstAnim,
			);
			if (allSameAnim && firstAnim) {
				const m = matchSkillValue(firstAnim, anims);
				animSelValue = m || '';
				animPlaceholder = '-- all --';
			} else {
				animSelValue = '';
				animPlaceholder = '-- many --';
			}
		}
	}

	async function onScenePick(s: MooShowStage) {
		const idx = parseInt(sceneVal, 10);
		if (isNaN(idx)) return;
		await s.setScene(idx);
		rebuildActorOptions(s);
		syncEditingFromStage(s);
		s.render();
	}

	async function stepScene(s: MooShowStage, dir: number) {
		const n = scenesList.length;
		if (n <= 1) return;
		let idx = parseInt(sceneVal, 10);
		if (isNaN(idx)) idx = 0;
		idx = (idx + dir + n) % n;
		sceneVal = String(idx);
		await onScenePick(s);
	}

	function onActorPick(s: MooShowStage) {
		const idx = parseInt(actorSelValue, 10);
		if (isNaN(idx)) return;
		s.selectActor(idx);
		actorSelValue = String(idx);
		syncEditingFromStage(s);
		s.render();
	}

	function stepActor(s: MooShowStage, dir: number) {
		const bodies = s.bodies;
		if (bodies.length === 0) return;
		const minIdx = bodies.length > 1 ? -1 : 0;
		let idx = parseInt(actorSelValue, 10);
		if (isNaN(idx)) idx = minIdx;
		idx += dir;
		if (idx < minIdx) idx = bodies.length - 1;
		if (idx >= bodies.length) idx = minIdx;
		actorSelValue = String(idx);
		s.selectActor(idx);
		syncEditingFromStage(s);
		s.render();
	}

	async function applyCharChange(s: MooShowStage, charIdx: number) {
		const inScene = s.activeScene !== null;
		const sel = s.selectedActor;
		if (inScene && sel >= 0) {
			await s.replaceActorCharacter(sel, charIdx);
		} else if (inScene && sel < 0) {
			for (let i = 0; i < s.bodies.length; i++) {
				await s.replaceActorCharacter(i, charIdx);
			}
		} else {
			await s.setCharacterSolo(charIdx);
			rebuildActorOptions(s);
		}
		syncEditingFromStage(s);
		s.render();
	}

	async function onCharacterChange(s: MooShowStage) {
		const idx = parseInt(charSelValue, 10);
		if (isNaN(idx)) return;
		await applyCharChange(s, idx);
	}

	async function stepCharacter(s: MooShowStage, dir: number) {
		const chars = charactersList;
		if (!chars.length) return;
		let idx = parseInt(charSelValue, 10);
		if (isNaN(idx)) idx = dir > 0 ? 0 : chars.length - 1;
		else idx = (idx + dir + chars.length) % chars.length;
		charSelValue = String(idx);
		await applyCharChange(s, idx);
	}

	async function applyAnimPick(s: MooShowStage) {
		const name = animSelValue;
		if (!name) return;
		const inScene = s.activeScene !== null;
		const sel = s.selectedActor;
		if (inScene && sel >= 0) await s.setAnimation(name, sel);
		else await s.setAnimation(name);
		syncEditingFromStage(s);
	}

	async function stepAnimation(s: MooShowStage, dir: number) {
		const list = animationList;
		if (list.length === 0) return;
		let i = list.indexOf(animSelValue);
		if (i < 0) i = dir > 0 ? 0 : list.length - 1;
		else {
			i += dir;
			if (i < 0) i = list.length - 1;
			if (i >= list.length) i = 0;
		}
		animSelValue = list[i];
		await applyAnimPick(s);
	}

	function togglePause() {
		const s = stageRef;
		if (!s) return;
		s.togglePause();
		syncPauseUi(s);
	}

	function handleKeyAction(s: MooShowStage, action: KeyAction, value?: number) {
		switch (action) {
			case 'stepSceneNext':
				void stepScene(s, 1);
				break;
			case 'stepScenePrev':
				void stepScene(s, -1);
				break;
			case 'stepActorNext':
				stepActor(s, 1);
				break;
			case 'stepActorPrev':
				stepActor(s, -1);
				break;
			case 'stepCharacterNext':
				void stepCharacter(s, 1);
				break;
			case 'stepCharacterPrev':
				void stepCharacter(s, -1);
				break;
			case 'stepAnimationNext':
				void stepAnimation(s, 1);
				break;
			case 'stepAnimationPrev':
				void stepAnimation(s, -1);
				break;
			case 'togglePause':
				syncPauseUi(s);
				break;
			case 'setSpeed':
				if (value !== undefined) speed = value;
				syncPauseUi(s);
				break;
			default:
				break;
		}
	}

	onMount(() => {
		let cancelled = false;
		let stage: MooShowStage | null = null;
		let msgInterval: ReturnType<typeof setInterval> | null = null;

		const pathRoot = (base || '').replace(/\/$/, '');
		const assetsBaseUrl = `${pathRoot}/data/`;

		(async () => {
			const el = canvasEl;
			if (!el) {
				errorMsg = 'Canvas not ready.';
				return;
			}
			const webgpu = (navigator as Navigator & { gpu?: unknown }).gpu;
			if (!webgpu) {
				errorMsg =
					'WebGPU is not available. Use a supported browser (e.g. current Chrome or Edge) with hardware acceleration enabled.';
				return;
			}

			let msgIdx = 0;
			loadText = LOADING_MESSAGES[0] ?? 'Loading VitaMoo...';
			msgInterval = setInterval(() => {
				msgIdx = (msgIdx + 1) % LOADING_MESSAGES.length;
				loadText = LOADING_MESSAGES[msgIdx] ?? loadText;
			}, 800);

			try {
				stage = createMooShowStage({
					canvas: el,
					assetsBaseUrl,
					characterPipeline: { animation: 'gpu', deformation: 'gpu' },
					hooks: {
						onOrbitViewChange: (s) => {
							if (cancelled) return;
							rotY = Math.round(s.rotY);
							rotX = Math.round(s.rotX);
							zoom = Math.round(s.zoom);
						},
						onKeyAction: (action, v) => {
							if (stage) handleKeyAction(stage, action, v);
						},
						onSelectionChange: () => {
							if (!stage) return;
							const bodies = stage.bodies;
							if (bodies.length > 1) {
								actorSelValue = String(stage.selectedActor);
							}
							syncEditingFromStage(stage);
						},
					},
				});
				stageRef = stage;

				if (cancelled) {
					stage.destroy();
					return;
				}

				await stage.loadContentIndex('content.json', (msg) => {
					if (!cancelled) loadText = msg;
				});

				if (cancelled) {
					stage.destroy();
					return;
				}

				scenesList = [...stage.scenes];
				charactersList = [...stage.characters];
				animationList = filterSkillNames([...stage.skillNames]).sort((a, b) =>
					a.localeCompare(b),
				);

				const si = scenesList.length > 1 ? 1 : 0;
				sceneVal = String(si);
				await stage.setScene(si);

				if (cancelled) {
					stage.destroy();
					return;
				}

				rebuildActorOptions(stage);
				syncEditingFromStage(stage);

				stage.spin.rotY = rotY;
				stage.spin.rotX = rotX;
				stage.spin.zoom = zoom;
				stage.speedScale = speed / 100;
				applyDistBtnClasses('medium');

				if (msgInterval) {
					clearInterval(msgInterval);
					msgInterval = null;
				}
				overlayDone = true;
				uiReady = true;
				setTimeout(() => {
					loadText = '';
				}, 500);

				stage.start();
			} catch (e) {
				if (msgInterval) clearInterval(msgInterval);
				if (!cancelled) {
					errorMsg = e instanceof Error ? e.message : String(e);
				}
				stage?.destroy();
				stage = null;
				stageRef = null;
			}
		})();

		return () => {
			cancelled = true;
			if (msgInterval) clearInterval(msgInterval);
			stage?.destroy();
			stageRef = null;
		};
	});
</script>

<div class="vitamoo-legacy">
	{#if errorMsg}
		<div class="banner error" role="alert">{errorMsg}</div>
	{/if}

	<div class="layout">
		{#if sidebarCollapsed}
		<button
			type="button"
			class="sidebar-disclosure sidebar-disclosure-pinned"
			onclick={toggleSidebarCollapsed}
			aria-expanded={false}
			title="Show panel"
			aria-label="Show panel"
		>›</button
		>
		<button
			type="button"
			class="sidebar-resize sidebar-resize-pinned-collapsed"
			aria-label="Resize panel width"
			title="Resize panel width"
			onmousedown={beginSidebarResize}
		></button>
		{/if}
		{#if !sidebarCollapsed}
		<div class="sidebar-shell" style:width="{sidebarWidth}px">
			<div class="sidebar-panel-head">
				<button
					type="button"
					class="sidebar-disclosure"
					onclick={toggleSidebarCollapsed}
					aria-expanded={true}
					aria-controls="sidebar-panel-scroll"
					title="Hide panel"
					aria-label="Hide panel"
				>‹</button
				>
				<div class="sidebar-panel-title">
					<span class="sidebar-title-brand">VitaMoo</span>
					<span class="sidebar-title-sep">:</span>
					<span class="sidebar-title-tagline">Spin the Sims!</span>
				</div>
			</div>
			<div class="sidebar-toolbar">
					<div class="sidebar-tabs" role="tablist" aria-label="Sidebar panels">
						<button
							type="button"
							class="sidebar-tab"
							role="tab"
							aria-selected={sidebarTab === 'demo'}
							onclick={() => (sidebarTab = 'demo')}
						>Demo</button
						>
						<button
							type="button"
							class="sidebar-tab"
							role="tab"
							aria-selected={sidebarTab === 'help'}
							onclick={() => (sidebarTab = 'help')}
						>Help</button
						>
						<button
							type="button"
							class="sidebar-tab"
							role="tab"
							aria-selected={sidebarTab === 'debug'}
							onclick={() => (sidebarTab = 'debug')}
						>Debug</button
						>
					</div>
			</div>
			<div class="sidebar-scroll" id="sidebar-panel-scroll">
				{#if sidebarTab === 'demo'}
				<div class="sidebar-tab-panel">
				<div class="group">
					<h3>Scene</h3>
					<select
						id="selScene"
						bind:value={sceneVal}
						disabled={!uiReady}
						onchange={() => stageRef && onScenePick(stageRef)}
					>
						{#each scenesList as sc, i}
							<option value={String(i)}>{sc.name}</option>
						{/each}
					</select>
					<div class="nav-row">
						<button
							type="button"
							class="nav-btn"
							id="btnScenePrev"
							title="Previous scene"
							aria-label="Previous scene"
							onclick={() => stageRef && stepScene(stageRef, -1)}>&larr; Prev</button
						>
						<button
							type="button"
							class="nav-btn"
							id="btnSceneNext"
							title="Next scene"
							aria-label="Next scene"
							onclick={() => stageRef && stepScene(stageRef, 1)}>Next &rarr;</button
						>
					</div>
				</div>

				<div class="group" id="actorGroup" class:hide-actor={!showActorGroup}>
					<h3>Actor</h3>
					<select
						id="selActor"
						bind:value={actorSelValue}
						disabled={!uiReady}
						onchange={() => stageRef && onActorPick(stageRef)}
					>
						{#each actorOptions as opt}
							<option value={opt.value}>{opt.label}</option>
						{/each}
					</select>
					<div class="nav-row">
						<button
							type="button"
							class="nav-btn"
							id="btnActorPrev"
							title="Previous actor"
							aria-label="Previous actor"
							onclick={() => stageRef && stepActor(stageRef, -1)}>&larr; Prev</button
						>
						<button
							type="button"
							class="nav-btn"
							id="btnActorNext"
							title="Next actor"
							aria-label="Next actor"
							onclick={() => stageRef && stepActor(stageRef, 1)}>Next &rarr;</button
						>
					</div>
				</div>

				<div class="group">
					<h3>Character</h3>
					<select
						id="selCharacter"
						bind:value={charSelValue}
						disabled={!uiReady}
						onchange={() => stageRef && onCharacterChange(stageRef)}
					>
						<option value="">{charPlaceholder}</option>
						{#each charactersList as c, i}
							<option value={String(i)}>{c.name}</option>
						{/each}
					</select>
					<div class="nav-row">
						<button
							type="button"
							class="nav-btn"
							id="btnCharacterPrev"
							title="Previous character"
							aria-label="Previous character"
							onclick={() => stageRef && stepCharacter(stageRef, -1)}>&larr; Prev</button
						>
						<button
							type="button"
							class="nav-btn"
							id="btnCharacterNext"
							title="Next character"
							aria-label="Next character"
							onclick={() => stageRef && stepCharacter(stageRef, 1)}>Next &rarr;</button
						>
					</div>
				</div>

				<div class="group">
					<h3>Animation</h3>
					<select
						id="selAnim"
						bind:value={animSelValue}
						disabled={!uiReady}
						onchange={() => stageRef && applyAnimPick(stageRef)}
					>
						<option value="">{animPlaceholder}</option>
						{#each animationList as a}
							<option value={a}>{a}</option>
						{/each}
					</select>
					<div class="nav-row">
						<button
							type="button"
							class="nav-btn"
							id="btnAnimPrev"
							title="Previous animation"
							aria-label="Previous animation"
							onclick={() => stageRef && stepAnimation(stageRef, -1)}>&larr; Prev</button
						>
						<button
							type="button"
							class="nav-btn"
							id="btnAnimNext"
							title="Next animation"
							aria-label="Next animation"
							onclick={() => stageRef && stepAnimation(stageRef, 1)}>Next &rarr;</button
						>
					</div>
				</div>
				</div>
				{:else if sidebarTab === 'help'}
				<div class="help-tab sidebar-tab-panel" role="tabpanel">
					<h2 class="help-tab-title">Spin the Sims!</h2>
					<p class="help-intro">Click and drag to spin.<br />Click a Sim to select them.</p>
					<table class="help-keys">
						<tbody>
							<tr><th colspan="2">Navigate</th></tr>
							<tr><td><kbd>N</kbd> <kbd>P</kbd></td><td>next / previous scene</td></tr>
							<tr><td><kbd>D</kbd> <kbd>A</kbd></td><td>next / previous actor</td></tr>
							<tr><td><kbd>S</kbd> <kbd>W</kbd></td><td>next / previous character</td></tr>
							<tr><td><kbd>E</kbd> <kbd>Q</kbd></td><td>next / previous animation</td></tr>
							<tr><td><kbd>Space</kbd></td><td>next actor (<kbd>Shift</kbd> = previous)</td></tr>
							<tr><th colspan="2">Spin and zoom</th></tr>
							<tr><td><kbd>←</kbd> <kbd>→</kbd></td><td>Spin (hold = faster)</td></tr>
							<tr><td><kbd>↑</kbd> <kbd>↓</kbd></td><td>Zoom in / out</td></tr>
							<tr><td>Drag</td><td>Spin actor + zoom</td></tr>
							<tr><td>Right drag</td><td>Orbit stage</td></tr>
							<tr><td>Click</td><td>Select actor (background = All)</td></tr>
							<tr><td>Scroll</td><td>Zoom</td></tr>
							<tr><th colspan="2">Speed</th></tr>
							<tr><td><kbd>1</kbd><kbd>2</kbd> <kbd>3</kbd> <kbd>4</kbd>–<kbd>9</kbd></td><td>Slow · normal · fast</td></tr>
							<tr><td><kbd>0</kbd></td><td>Pause</td></tr>
							<tr><th colspan="2">Panels</th></tr>
							<tr><td>‹ / ›</td><td>Show or hide the side panel</td></tr>
							<tr><td>Strip</td><td>Drag beside › to open the panel and set its width</td></tr>
							<tr><td>Bottom chevron</td><td>Show or hide the camera bar</td></tr>
						</tbody>
					</table>
					<p class="help-tip">
						<strong>All</strong> selected means you control every actor at once.
					</p>
				</div>
				{:else}
				<div class="sidebar-tab-panel debug-tab-panel" role="tabpanel">
					<DebugPanel stage={stageRef} active={sidebarTab === 'debug' && !sidebarCollapsed} />
				</div>
				{/if}
			</div>
		</div>
		<button
			type="button"
			class="sidebar-resize"
			aria-label="Resize panel width"
			title="Resize panel width"
			onmousedown={beginSidebarResize}
		></button>
		{/if}

			<div class="viewer">
				<div class="viewer-stage">
					<canvas
						bind:this={canvasEl}
						id="viewport"
						aria-label="Character viewport"
					></canvas>
				</div>
				{#if !bottomBarCollapsed}
				<div class="viewer-footer-toolbar">
					<div class="controls" id="viewer-bottom-controls">
						<button
							type="button"
							class="dist-btn"
							class:active={distFarActive}
							data-dist="far"
							title="Far camera"
							aria-label="Far camera"
							onclick={() => stageRef && setDistance(stageRef, 'far')}>Far</button
						>
						<button
							type="button"
							class="dist-btn"
							class:active={distMedActive}
							data-dist="medium"
							title="Medium camera"
							aria-label="Medium camera"
							onclick={() => stageRef && setDistance(stageRef, 'medium')}>Med</button
						>
						<button
							type="button"
							class="dist-btn"
							class:active={distNearActive}
							data-dist="near"
							title="Near camera"
							aria-label="Near camera"
							onclick={() => stageRef && setDistance(stageRef, 'near')}>Near</button
						>
						<label
							title="Rotate view"
							>Rotate <input
								type="range"
								id="rotY"
								min="0"
								max="360"
								value={rotY}
								aria-label="Rotate view"
								oninput={onRotYRangeInput}
							/></label
						>
						<label
							title="Tilt view"
							>Tilt <input
								type="range"
								id="rotX"
								min="-89"
								max="89"
								value={rotX}
								aria-label="Tilt view"
								oninput={onRotXRangeInput}
							/></label
						>
						<label
							title="Zoom view"
							>Zoom <input
								type="range"
								id="zoom"
								min="15"
								max="400"
								value={zoom}
								aria-label="Zoom view"
								oninput={onZoomRangeInput}
							/></label
						>
						<label
							title="Playback speed"
							>Speed <input
								type="range"
								id="speed"
								min="0"
								max="1000"
								bind:value={speed}
								aria-label="Playback speed"
								oninput={() => stageRef && pushSpinToStage(stageRef)}
							/></label
						>
						<button
							type="button"
							class="filter-btn"
							id="btnPause"
							class:active={pauseActive}
							title="Pause or resume"
							aria-label="Pause or resume"
							style="min-width:50px"
							onclick={togglePause}>{pauseLabel}</button
						>
					</div>
				</div>
				{/if}
				<button
					type="button"
					class="bottom-disclosure bottom-disclosure-anchor"
					onclick={toggleBottomBarCollapsed}
					aria-expanded={!bottomBarCollapsed}
					aria-controls={bottomBarCollapsed ? undefined : 'viewer-bottom-controls'}
					title={bottomBarCollapsed ? 'Show camera bar' : 'Hide camera bar'}
					aria-label={bottomBarCollapsed ? 'Show camera bar' : 'Hide camera bar'}
				><span
						class="disclosure-chevron"
						class:disclosure-chevron-down={!bottomBarCollapsed}
						class:disclosure-chevron-up={bottomBarCollapsed}
						aria-hidden="true"
					>‹</span></button
				>
			</div>
		</div>

	{#if !uiReady && !errorMsg}
		<div id="loadingOverlay" class:done={overlayDone}>
			<div class="loader-spinner"></div>
			<div class="loader-text">{loadText}</div>
		</div>
	{/if}
</div>

<style>
	.hide-actor {
		display: none !important;
	}

	.banner.error {
		position: absolute;
		left: 0;
		right: 0;
		top: 0;
		z-index: 2000;
		padding: 0.65rem 1rem;
		font: 0.9rem/1.4 system-ui, sans-serif;
		background: rgba(80, 20, 20, 0.92);
		color: #fff;
	}

</style>
