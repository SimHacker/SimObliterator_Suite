<script lang="ts">
	import { onMount } from 'svelte';
	import { base } from '$app/paths';
	import { createMooShowStage, type MooShowStage } from 'mooshow';

	let canvasEl = $state<HTMLCanvasElement | null>(null);
	let loadStatus = $state('');
	let errorMsg = $state<string | null>(null);

	onMount(() => {
		let cancelled = false;
		let stage: MooShowStage | null = null;

		const assetsBaseUrl = base === '' ? '/' : `${base.replace(/\/$/, '')}/`;

		(async () => {
			const el = canvasEl;
			if (!el) {
				errorMsg = 'Canvas not ready.';
				return;
			}
			if (!navigator.gpu) {
				errorMsg =
					'WebGPU is not available. Use a supported browser (e.g. current Chrome or Edge) with hardware acceleration enabled.';
				return;
			}
			try {
				stage = createMooShowStage({ canvas: el, assetsBaseUrl });
				if (cancelled) {
					stage.destroy();
					return;
				}
				await stage.loadContentIndex('data/content.json', (msg) => {
					if (!cancelled) loadStatus = msg;
				});
				if (cancelled) {
					stage.destroy();
					return;
				}
				const scenes = stage.scenes;
				const sceneIndex = scenes.length > 1 ? 1 : 0;
				await stage.setScene(sceneIndex);
				if (cancelled) {
					stage.destroy();
					return;
				}
				loadStatus = '';
				stage.start();
			} catch (e) {
				if (!cancelled) {
					errorMsg = e instanceof Error ? e.message : String(e);
				}
				stage?.destroy();
				stage = null;
			}
		})();

		return () => {
			cancelled = true;
			stage?.destroy();
		};
	});
</script>

<div class="shell">
	{#if errorMsg}
		<div class="banner error" role="alert">{errorMsg}</div>
	{:else if loadStatus}
		<div class="banner load">{loadStatus}</div>
	{/if}
	<canvas bind:this={canvasEl} class="view" aria-label="Character viewport"></canvas>
</div>

<style>
	.shell {
		position: relative;
		flex: 1;
		min-height: 0;
		width: 100%;
		background: #1a1a1c;
	}
	.view {
		display: block;
		width: 100%;
		height: 100%;
		touch-action: none;
	}
	.banner {
		position: absolute;
		left: 0;
		right: 0;
		top: 0;
		z-index: 2;
		padding: 0.65rem 1rem;
		font: 0.9rem/1.4 system-ui, sans-serif;
		pointer-events: none;
	}
	.banner.load {
		background: rgba(0, 0, 0, 0.55);
		color: #e8e8ea;
	}
	.banner.error {
		background: rgba(80, 20, 20, 0.92);
		color: #fff;
	}
</style>
