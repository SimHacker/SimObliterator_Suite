<script lang="ts">
	import type { MooShowStage } from 'mooshow';

	interface Props {
		stage: MooShowStage | null;
		open: boolean;
		onClose: () => void;
	}
	let { stage, open, onClose }: Props = $props();

	let pipelineStages = $derived(stage?.getCharacterPipelineStages() ?? { animation: 'cpu', deformation: 'cpu', rasterization: 'gpu' });
	let validation = $derived(stage?.getPipelineValidation() ?? { enabled: false, compareDeformation: false, compareAnimation: false, maxAbsError: 1e-4, maxLoggedVertices: 16, everyNFrames: 1, throwOnMismatch: false });

	function setDeformation(backend: 'cpu' | 'gpu') {
		stage?.setCharacterPipelineStages({ deformation: backend });
	}
	function setAnimation(backend: 'cpu' | 'gpu') {
		stage?.setCharacterPipelineStages({ animation: backend });
	}
	function toggleValidation() {
		const v = stage?.getPipelineValidation();
		if (!v) return;
		stage?.setPipelineValidation({ enabled: !v.enabled, compareDeformation: !v.enabled });
	}
	function toggleThrowOnMismatch() {
		const v = stage?.getPipelineValidation();
		if (!v) return;
		stage?.setPipelineValidation({ throwOnMismatch: !v.throwOnMismatch });
	}
	function setDebugSlice(mode: number) {
		if (!stage) return;
		const r = (stage as any)._renderer;
		if (r && typeof r.setDebugSlice === 'function') {
			r.setDebugSlice(mode);
			stage.render();
		}
	}

	const debugSlices = [
		{ value: 0, label: 'Normal (lit + textured)' },
		{ value: 1, label: 'UV as red/green' },
		{ value: 2, label: 'UV checker 8×8' },
		{ value: 3, label: 'Solid red' },
		{ value: 4, label: 'Raw texture (no lighting)' },
		{ value: 5, label: 'Vertex normals as RGB' },
		{ value: 6, label: 'White albedo × lighting' },
	];
</script>

{#if open}
<div class="debug-overlay" role="dialog" aria-label="Debug Panel">
	<div class="debug-panel">
		<div class="debug-header">
			<span class="debug-title">Debug Console</span>
			<span class="debug-hint">Ctrl+Shift+C to toggle</span>
			<button class="debug-close" onclick={onClose}>×</button>
		</div>

		<div class="debug-body">
			<fieldset>
				<legend>Character Pipeline</legend>
				<div class="debug-row">
					<label>Animation:</label>
					<button class:active={pipelineStages.animation === 'cpu'} onclick={() => setAnimation('cpu')}>CPU</button>
					<button class:active={pipelineStages.animation === 'gpu'} onclick={() => setAnimation('gpu')}>GPU</button>
				</div>
				<div class="debug-row">
					<label>Deformation:</label>
					<button class:active={pipelineStages.deformation === 'cpu'} onclick={() => setDeformation('cpu')}>CPU</button>
					<button class:active={pipelineStages.deformation === 'gpu'} onclick={() => setDeformation('gpu')}>GPU</button>
				</div>
				<div class="debug-row">
					<label>Rasterization:</label>
					<span class="debug-fixed">WebGPU</span>
				</div>
			</fieldset>

			<fieldset>
				<legend>Validation</legend>
				<div class="debug-row">
					<label>
						<input type="checkbox" checked={validation.enabled} onchange={toggleValidation} />
						Compare CPU ↔ GPU
					</label>
				</div>
				<div class="debug-row">
					<label>
						<input type="checkbox" checked={validation.throwOnMismatch} onchange={toggleThrowOnMismatch} />
						Throw on mismatch
					</label>
				</div>
				<div class="debug-row">
					<label>Max error: <code>{validation.maxAbsError}</code></label>
				</div>
			</fieldset>

			<fieldset>
				<legend>Render Debug Slice</legend>
				<div class="debug-slices">
					{#each debugSlices as s}
						<button class="debug-slice-btn" onclick={() => setDebugSlice(s.value)}>
							{s.value}: {s.label}
						</button>
					{/each}
				</div>
			</fieldset>
		</div>
	</div>
</div>
{/if}

<style>
	.debug-overlay {
		position: fixed;
		top: 0; right: 0;
		z-index: 9999;
		pointer-events: none;
	}
	.debug-panel {
		pointer-events: auto;
		margin: 12px;
		background: rgba(16, 20, 28, 0.94);
		color: #d4d8e0;
		border: 1px solid rgba(80, 200, 120, 0.35);
		border-radius: 6px;
		font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
		font-size: 11px;
		min-width: 280px;
		max-width: 340px;
		box-shadow: 0 4px 24px rgba(0,0,0,0.5);
	}
	.debug-header {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 10px;
		border-bottom: 1px solid rgba(80, 200, 120, 0.2);
		background: rgba(80, 200, 120, 0.08);
	}
	.debug-title {
		font-weight: 600;
		color: #50c878;
		flex: 1;
	}
	.debug-hint {
		color: #6a7080;
		font-size: 9px;
	}
	.debug-close {
		background: none;
		border: none;
		color: #8a8f9a;
		font-size: 16px;
		cursor: pointer;
		padding: 0 4px;
		line-height: 1;
	}
	.debug-close:hover { color: #ff6b6b; }
	.debug-body {
		padding: 8px 10px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	fieldset {
		border: 1px solid rgba(80, 200, 120, 0.15);
		border-radius: 4px;
		padding: 6px 8px;
		margin: 0;
	}
	legend {
		color: #50c878;
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		padding: 0 4px;
	}
	.debug-row {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 2px 0;
	}
	.debug-row label {
		min-width: 90px;
		color: #a0a8b4;
	}
	.debug-row button {
		background: rgba(255,255,255,0.06);
		border: 1px solid rgba(255,255,255,0.12);
		color: #a0a8b4;
		padding: 2px 10px;
		border-radius: 3px;
		cursor: pointer;
		font-family: inherit;
		font-size: 10px;
	}
	.debug-row button:hover { background: rgba(255,255,255,0.12); }
	.debug-row button.active {
		background: rgba(80, 200, 120, 0.2);
		border-color: rgba(80, 200, 120, 0.5);
		color: #50c878;
	}
	.debug-fixed {
		color: #50c878;
		font-style: italic;
	}
	.debug-slices {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.debug-slice-btn {
		background: rgba(255,255,255,0.04);
		border: 1px solid rgba(255,255,255,0.08);
		color: #a0a8b4;
		padding: 3px 8px;
		border-radius: 3px;
		cursor: pointer;
		font-family: inherit;
		font-size: 10px;
		text-align: left;
	}
	.debug-slice-btn:hover {
		background: rgba(80, 200, 120, 0.12);
		color: #d4d8e0;
	}
	input[type="checkbox"] {
		accent-color: #50c878;
	}
	code {
		background: rgba(255,255,255,0.06);
		padding: 1px 4px;
		border-radius: 2px;
		color: #e0e0e0;
	}
</style>
