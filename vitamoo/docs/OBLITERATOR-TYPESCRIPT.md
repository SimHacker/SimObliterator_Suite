# SimObliterator → TypeScript: save data, content library, and VitaMoo integration

This document surveys the **Python side** of **SimObliterator Suite** (repository root, outside `vitamoo/`), proposes a **portable TypeScript** module family for **reading and eventually writing** Sims 1 save and game data in **browser and Node**, and orders work so the **first win** is: **load every Sim from a neighborhood (all lots / families)** into **VitaMoo** for animation and outfit play.

It is **not** a mandate for a line-by-line Python port. TypeScript modules should match **on-disk contracts** and **user-visible capabilities**, **maximize reuse of vitamoo** (parsers, types, naming), and stay **small, testable, and environment-agnostic**.

**MOOLLM** (separate repo) already captures the **product intent** in human-editable form: the **[sim-obliterator designs](https://github.com/SimHacker/moollm/tree/main/designs/sim-obliterator)** and **[sim-obliterator skill](https://github.com/SimHacker/moollm/tree/main/skills/sim-obliterator)** describe INSPECT / UPLIFT / DOWNLOAD, the **PersonData ↔ CHARACTER.yml** bridge ([`BRIDGE.md`](https://github.com/SimHacker/moollm/blob/main/designs/sim-obliterator/BRIDGE.md)), and the **IFF Semantic Image Pyramid** ([`IFF-LAYERS.md`](https://github.com/SimHacker/moollm/blob/main/designs/sim-obliterator/IFF-LAYERS.md)). Today that skill **shells out to Python** in a sister **SimObliterator_Suite** checkout. This document defines the **pure TypeScript platform** that implements the **same contracts** (binary layouts, field indices, roster discovery) so **browser / Node / static hosting** need **no Python** for core I/O, VitaMoo loading, or future YAML/MOOLLM export.

---

## 1. Layered stack and vitamoo alignment

### 1.0 Bottom-up layers (TS)

| Layer | Responsibility | Depends on |
|-------|----------------|------------|
| **L0 — Resource I/O** | The **only** layer that knows *how* bytes are obtained: directory handle, Node `fs`, in-memory fixtures, ZIP, future sync providers. Exposes a **small async API** over **logical paths** (POSIX-style strings relative to a chosen root, e.g. `Neighborhoods/N001/Neighborhood.iff`). No IFF, no Sims semantics. | Nothing in-stack (platform types only). |
| **L1 — Virtual tree (optional composition)** | Merges **loose files**, **FAR** entries, and later **DBPF** mounts into **one** L0-shaped view (search order / shadows: e.g. Downloads over pack). Parsers do not know whether a path hit a FAR or disk. | L0 only. |
| **L2 — Binary formats** | **IFF** container, **FAR** index, chunk payload views. **Pure**: `Uint8Array` / `DataView` in, structured data out; same spirit as `vitamoo` text/binary parsers (`parseCMX`, `parseSKN`, `parseCFP`). | L1 (or L0 if no archives). |
| **L3 — Save / content domain** | Neighborhood graph, **FAMI** / **NBRS**, **User** IFF, appearance decoding, GUID maps, house linkage. Still no `fetch` / `fs`. | L2 + shared types. |
| **L4 — VitaMoo bridge** | Emits **`ContentIndex`** and paths (or buffers) that the existing loader stack understands; wires **L0** into the runtime. | L3 + **vitamoo** / **mooshow** types. |

**Rule:** nothing above **L0** imports Node `fs`, `path` (except path *normalization* utilities with browser equivalents), or browser `FileSystemHandle` APIs. **L0 implementations** live in small adapter files (`resource-io-node.ts`, `resource-io-fs-access.ts`, `resource-io-memory.ts`).

### 1.1 Parallel with vitamoo today

**mooshow** already separates **what** to load from **one** default transport:

- **`ContentLoader`** (`mooshow/src/runtime/content-loader.ts`) uses **`assetsBaseUrl`** + **`fetch`** for every asset (`loadIndex`, CMX/SKN/CFP/BMP).
- **`ContentStore`** holds parsed skeletons, suits, skills, meshes, texture **name** map.
- **`ContentIndex`**, **`CharacterDef`**, **`SceneDef`**, **`CastMemberDef`** are the **contract** between data and stage.

The save-data TS stack should **not** invent parallel names for those shapes. The bridge layer **fills** `ContentIndex` / character entries; the app keeps using **`createMooShowStage`** + **`loadContentIndex`** + **`loadAllContent`**.

**Evolution (recommended):** add an optional **`ResourceReader`** (or **`AssetSource`**) to **`ContentLoader`**: same method signatures the loader uses internally today (`readText`, `readBytes`, optional `exists`), defaulting to **`fetch(baseUrl + path)`**. Then **L0** implements **`ResourceReader`** for the browser directory pick or Node, and **one** code path loads demo packs **or** extracted save-relative assets. Until that lands, the bridge can expose an **`http(s):` or blob virtual base** that maps to L0 (slightly more glue).

**Parsers:** keep using **`vitamoo`** exports (`parseCMX`, `parseSKN`, `parseCFP`, `buildSkeleton`, …) from the bridge and anywhere domain code needs to validate assets—**do not fork** CMX/SKN/CFP logic into a second package.

**Texture pipeline:** today **`TextureFactory.createTextureFromUrl`** stays as-is; URLs can point at **blob:** or **data:** URLs if L0 serves in-memory bytes. Same pattern as vitamoo: **loader** does not decode BMP—GPU path uses existing texture load.

### 1.2 Naming and patterns (conventions)

- Prefer **existing vitamoo/mooshow names**: `ContentIndex`, `CharacterDef`, `ContentStore`, `assetsBaseUrl` (when URL-based), `loadIndex` / `loadAllContent` semantics.
- New types for saves should be **`PascalCase`** interfaces in files colocated with domain (`neighborhood.ts`, `neighbor-record.ts`), mirroring **`Body`**, **`StageConfig`** style in mooshow.
- **Pure parse functions** return **plain objects** or **readonly** views; avoid hidden globals (same as core vitamoo parsers).
- **Errors:** throw **`Error`** with stable codes or `cause` where useful, similar to **`content-loader`** JSON / fetch errors.

### 1.3 MOOLLM sim-obliterator: same idea, TypeScript runtime

| MOOLLM artifact | What it specifies | Pure TS platform |
|-----------------|-------------------|------------------|
| **[`BATTLE-PLAN.md`](https://github.com/SimHacker/moollm/blob/main/designs/sim-obliterator/BATTLE-PLAN.md)** | Sister-repo pattern, phased **SETUP / INSPECT / UPLIFT / DOWNLOAD**, later TRANSLATE / BHAV / ALBUM | **SETUP** → optional CLI or `pnpm` script that only installs **Node** deps (no venv). **INSPECT** → TS API + JSON/YAML output from **L3** neighborhood state. **UPLIFT** → map save records to a **portable object**; optional **CHARACTER.yml** emitter for `skills/character`. **DOWNLOAD** → Phase D binary writers + same field math as Python. |
| **[`BRIDGE.md`](https://github.com/SimHacker/moollm/blob/main/designs/sim-obliterator/BRIDGE.md)** | **PersonData.h** indices (88 shorts), **FAMI** / **NBRS**, scales 0–1000 ↔ 0–10, career and relationship mapping | TS **single source of truth** as typed constants + tests; must **match** BRIDGE tables (already corrected vs TSO indices per that doc). |
| **[`SKILL.md`](https://github.com/SimHacker/moollm/blob/main/skills/sim-obliterator/SKILL.md)** | User-facing **beam up / beam down** narrative, `sims:` as sync surface, `mind_mirror` MOOLLM-only | TS library does **not** call LLMs; it supplies **data** MOOLLM skills consume. **VitaMoo** uses **L4**; **MOOLLM** uses **exported YAML/JSON** from the same TS decode. |
| **[`IFF-LAYERS.md`](https://github.com/SimHacker/moollm/blob/main/designs/sim-obliterator/IFF-LAYERS.md)** | Six **semantic** layers from raw IFF bytes → exploded chunks → decoded YAML → narrative **CHARACTER.yml** | **Orthogonal** to §1.0 **L0–L4 transport stack**: MOOLLM L0 there = sacred file bytes; our **L0** = how TS **acquires** those bytes. Convergence point: TS **IFF split/merge** (parity with Python `container_operations`) can emit MOOLLM **Layer 1** trees for tooling without mixing I/O into parsers. |

**Integration shapes (later):** MOOLLM can keep the **skill** as orchestration while swapping **Python subprocess** calls for **`node sims-io inspect`** or **WASM**-bundled TS; or vitamoospace can **download CHARACTER.yml** blobs generated client-side. The **pure TS** requirement is: **library code path** runs without CPython.

---

## 2. Survey: Python layout (~220 modules under `src/`)

### 2.1 Container and binary formats (`src/formats/`)

| Area | Role | Notable modules |
|------|------|-----------------|
| **IFF** | Read/write Sims IFF, typed chunks | `formats/iff/iff_file.py`, `formats/iff/base.py`, `formats/iff/chunks/*` (BHAV stack, OBJD/OBJF/STR#, SPR, DGRP, **PERS**, **NBRS**, **FAMI**, **HOUS**, **SIMI**, **ARRY**, **OBJM**/**OBJT**, and many more) |
| **FAR** | FAR1 / FAR3 archives | `formats/far/far1.py`, `formats/far/far3.py` |
| **DBPF** | Package-style containers where used | `formats/dbpf/dbpf.py` |
| **Mesh / character assets** | BCF/BMF/CFP, CMX text, SKN, glTF export helpers | `formats/mesh/bcf.py`, `bmf.py`, `cfp.py`, `cmx.py`, `skn.py`, `gltf_export.py` |

**Overlap with vitamoo:** TypeScript already implements **CMX, SKN, CFP, BMP** and animation/render (`vitamoo/vitamoo/`). The new work is **IFF/FAR/save orchestration** and **resolving paths** from STR# / filenames into bytes vitamoo can consume.

### 2.2 Application core (`src/Tools/core/`)

Large surface: **IFFReader**, **chunk_parsers**, **save_mutations**, **world_mutations**, **mutation_pipeline**, **safety** / provenance, **BHAV** disassembly/execution helpers, **asset_scanner**, **file_operations**, **mesh_export**, **lot_iff_analyzer** (lot structure, SIMI, HOUS, terrain-by-house-number), **skin_registry** (appearance from STR# 200 and related), **ttab_editor**, **slot_editor**, localization (**str_parser**), graph extractors glue, etc.

For **browser save browsing**, the highest-leverage Python references are:

- **`Tools/save_editor/save_manager.py`** — neighborhood discovery (`Neighborhood.iff`), **FAMI** / **NBRS**, **User#####.iff**, **House##.iff**, budgets, person fields, edit offsets.
- **`Tools/core/skin_registry.py`** — decode body/head/hand lines from **STR#** into mesh and texture names.
- **`Tools/webviewer/character_exporter.py`** — IFF → JSON appearance; BCF → skeleton JSON (pattern for TS export to vitamoo `ContentIndex`).

### 2.3 Save editor package (`src/Tools/save_editor/`)

Focused API: dataclasses for **FamilyData**, **NeighborData**, **PersonData** (indices aligned to Sims 1 `PersonData.h`, documented in-file), and **IFFEditor**-backed read/write for money, skills, careers, relationships, etc.

### 2.4 Graph, entities, GUI, webviewer

- **`Tools/graph/`** — dependency graphs, chunk-type extractors (BHAV, OBJD, SLOT, TTAB, …). Important for **object tooling later**, not for milestone 1.
- **`Tools/entities/`** — `sim_entity`, `object_entity`, `behavior_entity`, `relationship_entity`. Conceptual model for TS types later.
- **`Tools/gui/`** — DearPyGui desktop; **not** a port target.
- **`Tools/webviewer/export_server.py`** — Flask; proves **server-mediated** file access. The TS plan prefers **File System Access API** (with fallbacks) so the **same library** runs in static hosting.

### 2.5 Tests and utilities

- **`dev/tests/test_game.py`** (and related) — real-file validation; TS should add **fixture-based** tests (small IFF slices) plus optional **integration** scripts in Node with a configured game path.
- **`utils/binary.py`** — `IoBuffer`, endian helpers; TS uses `DataView` + explicit little-endian reads.

---

## 3. Design goals for TypeScript

1. **Respect §1 layering:** **L0** is the only place that performs physical I/O; **L2** parsers stay pure on bytes; **L4** speaks **mooshow** / **`ContentIndex`**.
2. **One logical library**, multiple **entrypoints** or **subpackages** as the repo grows; keep **tree-shakeable** ESM under the same **pnpm workspace** as **vitamoo** (see §9).
3. **L0 contract** (name can be `ResourceBackend`, `SimsFileSource`, or `Vfs`): async **`readBytes(path)`** / **`readText(path)`**, optional **`readdir`**, optional **`writeBytes`** for Phase D; paths are **logical** strings, never raw host absolute paths leaked upward.
4. **Pure parse/transform** for **L2** and up where possible: no DOM; **`Uint8Array`** in, structured data out—same discipline as **vitamoo** parsers.
5. **Vitamoo-facing output:** reuse **`ContentIndex`**, **`CharacterDef`**, **`ContentStore`** names and semantics; **mooshow** **`ContentLoader`** unchanged from the app’s perspective (or extended only with an injectable reader as in §1.1).
6. **Editing and save-back** only after **read-only parity**; **transaction** / **snapshot** story mirrors Python’s safety ideas without blocking v1 read paths.

---

## 4. Conceptual mapping (Python reference → TS module and layer)

| TS module (proposed) | Layer | Responsibility | Python touchpoints |
|----------------------|-------|----------------|-------------------|
| **`resource-io-*`** (adapters) | **L0** | Node / File System Access / memory / ZIP | N/A |
| **`virtual-tree`** / **`archive-mount`** | **L1** | Overlay loose + FAR (+ DBPF later) | `formats/far/*.py`, installer layout |
| **`binary`** | **L2** | Buffer helpers, UTF-16/8 strings, aligned struct read | `utils/binary.py` |
| **`iff-core`** | **L2** | IFF container parse, chunk iteration, raw chunk read | `formats/iff/iff_file.py`, `base.py` |
| **`iff-chunks`** | **L2** | Typed decoders per fourCC (incremental) | `formats/iff/chunks/*.py`, `Tools/core/chunk_parsers.py` |
| **`far`** | **L2** | FAR1/FAR3 index + extract bytes by path | `formats/far/*.py` |
| **`save-neighborhood`** | **L3** | Find `Neighborhood.iff`, FAMI list, NBRS neighbors, GUID map | `Tools/save_editor/save_manager.py` |
| **`save-user`** | **L3** | Parse **User#####.iff** for STR# appearance + links | `IFFReader`, `skin_registry.py`, `character_exporter.py` |
| **`save-house`** | **L3** | House##.iff for lot residents / runtime state (phase 2+) | `save_manager.py`, `lot_iff_analyzer.py` |
| **`appearance`** | **L3** | STR# 200 lines → `{ body, head, hands, … }` + file base names | `skin_registry.py` |
| **`asset-resolve`** | **L3** | Map mesh/texture names → logical paths on **L1** | `asset_scanner.py`, `file_operations.py` |
| **`vitamoo-bridge`** | **L4** | Build **`ContentIndex`**; connect **L0** to **`ContentLoader`** / blob URLs | `character_exporter.py`, `content-loader.ts` |
| **`iff-explode` / `iff-assemble`** | **L2** | Deterministic chunk tree ↔ single IFF (MOOLLM **Layer 1**-style) | `Tools/core/container_operations.py` (IFFSplitter / IFFMerger) |
| **`iff-decoded-export`** | **L2–L3** | Chunk payloads ↔ YAML/JSON (MOOLLM **Layer 2**); **§6** schemas | `formats/iff/chunks/*`, `chunk_parsers.py` |
| **`object-interchange`** | **L3–L4** | **`manifest.yml`**, **fidelity profiles**, partial patch merge, derived RGB/α/Z/zoom | Transmogrifier philosophy; **§6** |

**vitamoo reuse:** **`parseCMX`**, **`parseSKN`**, **`parseCFP`** (and future shared binary readers) stay in **`vitamoo`**; **L3** may call them for validation; **L4** relies on **mooshow** to load bodies the same way as today.

---

## 5. Phased roadmap

### Phase A — Foundation (blocking everything else)

1. **IFF reader:** header, chunk table, lazy chunk payload access, stable `path` / `id` metadata for debugging.
2. **STR# decoder** (minimal): enough to read **appearance strings** and labels.
3. **FAMI + NBRS** decoder: families, neighbor ids, GUIDs, names, links to **User** files as in Python.
4. **L0 + path conventions:** document **Legacy Collection** vs **Classic** user-data layouts the same way `save_manager.find_neighborhood` tries multiple roots; ship **memory** + **Node** L0 for CI.

**Exit:** From a **userData root** (browser: directory picked once), list neighborhoods, load **Neighborhood.iff**, enumerate **all neighbors** with stable ids.

### Phase B — Milestone 1: “All people → VitaMoo”

1. For each **NBRS** entry (or equivalent graph), open **User#####.iff**, run **appearance** pipeline → vitamoo-ready **CMX/SKN/BMP/CFP** paths or inlined buffers.
2. **FAR resolution:** implement **read from FAR** for vanilla assets; merge **loose files** from **Downloads** / pack folders with a clear **precedence rule** (Downloads override pack, same as modding expectations).
3. Emit **`ContentIndex`**: one entry per Sim (or per outfit variant if you split), scenes optional (“Neighborhood roster” single scene with all bodies, or one scene per family).
4. **Wire vitamoospace (or embed):** “Open save folder” → build index → `loadContentIndex` / `setCharacterSolo` / animation picker.

**Exit:** User grants directory access; all **household / townie** Sims from **N00x** appear in the viewer; user can swap animations and outfits **where assets resolve**.

### Phase C — Lots and “who is on which lot”

1. **House##.iff** parsing for resident lists and object handles (align with `save_manager` + `lot_iff_analyzer` findings).
2. Map **family ↔ house ↔ lot** for UI filtering (“only Sims on Lot 3”).
3. Optional: **SIMI** / **HOUS** for camera and metadata display (not required for vitamoo body playback).

**Exit:** Filter roster by lot; optional lot thumbnail or label in UI.

### Phase D — Round-trip edits (high risk, high value)

1. **Mutable IFF chunk model:** rewrite chunk with size reconciliation or patch table.
2. **Scoped mutations:** money (FAMI budget), safe person fields (mirror Python’s warnings about motives and runtime-only data).
3. **Validation:** re-read after write; optional **snapshot** folder (TS-side copy before write).

**Exit:** Same API works in **Node** first; browser **save** behind explicit “Export modified neighborhood” download if in-place write is undesirable on some hosts.

### Phase E — Objects, architecture, Transmogrifier-class tooling

Work follows **§6** (layered interchange and fidelity profiles). In short:

1. **OBJD/OBJF/SPR/DGRP** resolution and preview (2D first, 3D holodeck later per vitamoo design docs).
2. **Simantics (BHAV)** and other structured chunks: **YAML** (and **JSON** where automation prefers it) as the edit surface; round-trip **decode → edit → encode** into chunk bytes.
3. **Transmogrifier-class** flows: partial export, **patch bundles**, and **derived channel regeneration** (RGB / alpha / Z / zoom) per **fidelity profile**; full interchange with [`gltf-extras-metadata.md`](./gltf-extras-metadata.md) and GPU readback ideas in [`gpu-assets-tooling-roadmap.md`](./gpu-assets-tooling-roadmap.md) where relevant.

---

## 6. Layered interchange: YAML/JSON, partial patches, Transmogrifier-style fidelity

This section is the **authoring and object** counterpart to §1’s **transport** stack: same IFF/FAR sources, but **human-editable layers** and **optional completeness** so simple edits stay small and advanced edits stay possible.

### 6.1 Design philosophy (from Transmogrifier, without XML)

**Transmogrifier** let authors trade **export size** against **explicit detail**: for example export **full RGB + alpha + Z** at **all zoom scales**, or export **only** one scale and **only** RGB for a quick recolor, with the tool **regenerating** missing zooms and channels where the pipeline allows. The interchange was XML-heavy; here we standardize on **YAML** (human diff-friendly, comments), **JSON** (strict schemas, APIs, tests), and **sidecar raw binaries** (e.g. `.png`, `.bin`) when a field is too large or loss-sensitive for inline text.

**Rules:**

- Every **export bundle** carries a **`manifest.yml`** (or `manifest.json`) stating **fidelity profile**, **explicit** assets, and **derived-on-import** steps the importer must run.
- **Importers** are **deterministic**: same manifest + same explicit files → same IFF bytes (within documented float tolerance for resampling).
- **Partial round-trip:** author edits **only** the files listed in the manifest; **patch** merges into an existing IFF (or rebuilds from exploded chunks) without requiring the author to hand-edit untouched chunks.

### 6.2 Layered export/import pipeline (semantic, aligns with MOOLLM IFF-LAYERS)

| Stage | On disk / in memory | Format role |
|-------|---------------------|-------------|
| **A — Container** | Whole `.iff` / `.far` member bytes | Ground truth; snapshot before patch |
| **B — Exploded** | Directory tree: chunk-type folders, deterministic names, raw `.bin` payloads + small `META.yml` | Lossless mirror; good for VCS and hex-adjacent workflows |
| **C — Decoded** | Per-chunk **YAML** or **JSON**: all named fields, hex comments for reserved/unknown, byte offsets | Machine + human edit; **BHAV** as structured opcode sequences (operands as nested data, not opaque hex blobs only) |
| **D — Semantic / reduced** | Shorter YAML: catalog strings only, sprite **profile** references, behavior **diffs** against a known base object | Recoloring, price/name edits, “swap BHAV 0x123 only” |

**Export** can stop at **B**, **C**, or **D** depending on tool. **Import** walks **down** the stack: apply **D** patches onto a **C** or **B** baseline, or **C → B → A** when full reassembly is needed.

### 6.3 Fidelity profiles (examples)

Profiles are **named** in `manifest.yml` and drive which files appear in the bundle and which **derivation** steps run on import.

| Profile | Typical explicit export | Derived on import (examples) |
|---------|-------------------------|------------------------------|
| **`full-sprite-stack`** | RGB + alpha + Z for every zoom the object uses | Nothing, or validate only |
| **`recolor-rgb-one-zoom`** | Single zoom level, RGB only | Alpha/Z copied or inferred from **base object**; other zooms **resampled** or **duplicated** per documented rules (same as classic TMog-style shortcuts) |
| **`catalog-only`** | STR# / catalog fields | No sprite touch |
| **`bhav-patch`** | YAML for one or more BHAV resources | Other chunks unchanged |

Exact resampling and “copy channel from reference object” rules are **versioned** in the manifest so old bundles stay reproducible.

### 6.4 Simantics and structured behaviors

- **BHAV** (and related **BCON**, **TTAB** where needed) export to **YAML** with a **stable schema**: primitives as tagged nodes, operands as typed fields, labels and jump targets resolved to indices on import.
- **STR#** exports as YAML or JSON arrays/maps keyed by language and string id.
- **Round-trip tests** compare **re-encoded chunk size** and **byte-identical** payloads where the encoder is canonical; where the game tolerates padding differences, document tolerance.

Python’s deep BHAV tooling in **SimObliterator Suite** remains a **reference implementation** until TS encoders reach parity; the **YAML schema** is the contract both can target.

### 6.5 Integration with vitamoo docs and GPU authoring

- **[sims-content-pipeline-notes.md](./sims-content-pipeline-notes.md)** — historical **Transmogrifier**, note tracks, community flow; §6 is the **modern interchange** expression of the same ergonomics.
- **[gpu-assets-tooling-roadmap.md](./gpu-assets-tooling-roadmap.md)** — browser **readback** for RGB/alpha/Z aligns with **`full-sprite-stack`** and derived profiles that fill Z from rendered depth.
- **[gltf-extras-metadata.md](./gltf-extras-metadata.md)** — optional **parallel** interchange for 3D/object packaging; manifests can declare **glTF sidecars** alongside IFF patches.

---

## 7. Milestone 1 acceptance criteria (concrete)

- User selects **Sims user-data directory** (browser) or passes **path** (Node).
- Tool discovers at least one **`Neighborhood.iff`** and parses **FAMI** and **NBRS**.
- For **each** neighbor with a resolvable **User#####.iff**, the pipeline produces vitamoo-loadable **character defs** (skeleton + mesh + textures + skills list when available).
- **Downloads** and **Expansion** loose files are consulted so **custom skins and animations** appear when files match naming conventions.
- **No Python runtime** required on the user machine for this path.
- Failures are **per-Sim** (one broken User file does not abort the whole neighborhood).

---

## 8. Relation to existing vitamoo docs

- **[DOCUMENTATION.md](./DOCUMENTATION.md)** — mooshow **hooks**, **`ContentLoader`** (`assetsBaseUrl` + **`fetch`** today), **`ContentIndex`** / **`CharacterDef`**; **L4** targets those APIs and §1’s optional **`ResourceReader`** extension.
- **[gltf-extras-metadata.md](./gltf-extras-metadata.md)** — long-term interchange for packaged assets; save-browser v1 can stay **CMX/SKN/BMP/CFP-native**.
- **[webgpu-renderer-design.md](./webgpu-renderer-design.md)** — holodeck and object pipeline for **later** phases (house architecture, object rendering).
- **[sims-content-pipeline-notes.md](./sims-content-pipeline-notes.md)** — Transmogrifier-era context; **§6** here defines YAML/JSON layered interchange and fidelity profiles.
- **MOOLLM** — [`designs/sim-obliterator`](https://github.com/SimHacker/moollm/tree/main/designs/sim-obliterator), [`skills/sim-obliterator`](https://github.com/SimHacker/moollm/tree/main/skills/sim-obliterator): narrative and **CHARACTER.yml** bridge; §1.3 maps them onto this TS stack; **[IFF-LAYERS.md](https://github.com/SimHacker/moollm/blob/main/designs/sim-obliterator/IFF-LAYERS.md)** aligns with §6.2 stages B–D.

---

## 9. Suggested repository placement

Add a **workspace package sibling to mooshow** under **`vitamoo/`** (for example **`vitamoo/sims-io/`**), registered in **`vitamoo/pnpm-workspace.yaml`**. Use **strict TypeScript**, **`*.test.ts`** next to sources, and **`vitamoo`** as a **dependency** from **`sims-io`** for parsers and (optionally) **`mooshow`** as a **devDependency** for type-only imports of **`ContentIndex`** / **`ContentLoader`** in the bridge—**or** duplicate only the **type** definitions in `sims-io` if you must avoid a cycle (prefer importing types from **`mooshow`** exports).

**vitamoo** remains the **animation, mesh, CFP, render** core; **sims-io** owns **IFF/FAR/save** and **L0** adapters. **No second copy** of CMX/SKN/CFP parsing.

---

## 10. Risk notes

- **Legal / EULA:** tools read user files locally; do not redistribute Maxis assets. Docs and UI should state **user-supplied** game data only.
- **Format drift:** Legacy Collection vs Complete Collection paths differ; automated tests cannot rely on one layout—**capability matrix** in README of sims-io.
- **Security:** browser apps must not exfiltrate directory contents; processing stays **client-side** unless the user opts into an explicit server.

This roadmap prioritizes **roster import into VitaMoo** first, then **lot-aware filtering**, then **save mutation**, then **object/house/transmogrifier** depth—aligned with your stated order: **play every Sim with every animation and outfit you have**, then grow **authoring** tools on the same library base.
