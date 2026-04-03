# Sims content pipeline — note tracks, tools, and community ecosystem

Historical notes on the original Sims 1 content pipeline (Don Hopkins, Maxis 1997–2004) and how it informs VitaMoo's design for browser-based authoring, interchange, and community content sites.

---

## 3D Studio Max note tracks

The CMX Exporter used **3DS Max note tracks** as the primary metadata channel for the entire content pipeline. A note track can be attached to any node in the 3D hierarchy and contains **keys in time**, each holding a multi-line text field parsed as `key=value` property lists.

Don Hopkins described them as **"XML in 3D+Time"** — structured data riding on nodes and timestamps, read by both the exporter and the runtime animation engine.

### What note tracks carried

| Tag | Where attached | Purpose |
|-----|---------------|---------|
| `skeleton=name` | Root bone | Marks a skeleton for suit/skill export |
| `masterskeleton=name` | Root bone | The canonical skeleton actually exported (e.g. "adult", "child") |
| `suit=name` | Skeleton root, at a specific time | Snapshot a suit at that frame |
| `beginskill=name` / `endskill=name` | Any bone, at start/end times | Delimit an animation clip on the timeline |
| `cantranslate`, `canrotate`, `canblend` | Individual bones | Per-bone animation capability flags |
| `wiggle=canWiggle wigglePower` | Individual bones | Quaternion Perlin noise (never shipped, but wired) |
| `includebone=name` / `excludebone=name` | With `beginskill` | Override which bones a partial-body skill animates |
| `xorigin`, `yorigin`, `zorigin`, `spin` | With `beginskill` | Animation coordinate system origin and orientation |
| `absolute`, `relative`, `moving` | With `beginskill` | Coordinate mode: world-space, origin-relative, or locomotion |
| `type=value` | With `suit` | Suit type: 0 = normal faces, 1 = bounding-box-only (censorship) |
| `flags=value` | On a skin | Bitmask to filter which skins dress onto the skeleton |

### Animation events (delivered at runtime)

Any tag the exporter **did not recognize** was passed through as a **runtime event**, delivered to the game's `SAnimator` at the marked time during playback. Known runtime events:

| Event | Effect |
|-------|--------|
| `xevt` | Numeric arg → SimAntics animate primitive false branch |
| `interruptable` / `interruptible` | Set practice interruptable flag |
| `anchor` | Anchor the tagged bone (foot planting) |
| `dress` / `undress` | Dress or undress a named suit at runtime |
| `lefthand` / `righthand` | Set hand pose index |
| `censor` | Set censorship mask |
| `sound` / `selectedsound` / `delselectedsound` | Play named sound (conditional on selection state) |
| `footstep` | Play footstep sound (left/right arg, historically ignored) |
| `discontinuity` | Expect a snap in root position — suppress blending |

This meant artists could place sound cues, hand-pose changes, censorship triggers, and object-interaction synchronization events directly on the 3DS Max timeline, and they would survive export into the game without any code changes.

### How the exporter used note tracks

1. MaxScript walks the scene hierarchy looking for nodes with note tracks.
2. Each note track key's text is parsed as a `Props` (key/value pairs, one per line).
3. Recognized tags (`skeleton`, `beginskill`, `suit`, etc.) drive the export: which bones, which time range, which meshes.
4. Unrecognized tags become `TimeProps` entries in the exported skill — animation events for the runtime.
5. The artist adjusts event positions in time (e.g. sliding a `footstep` key to match the foot-hit frame) and edits property text, then re-exports.

The Access database drove batch export: it listed every skeleton, suit, and skill by name, pointed to the Max file, and the MaxScript UI could load, validate, and export them automatically — or batch-export the entire database.

---

## The CMX Exporter (MaxScript + C++ plug-in)

The exporter started as a pure C++ 3DS Max exporter plug-in but was **recast as a MaxScript primitive** so it could be called under program control. MaxScript handled UI, database queries (OLE to Access), SourceSafe integration (DOSCommand), file I/O, and validation; C++ handled the actual mesh compilation and VitaBoy data structures.

Key capabilities of the MaxScript UI ("CMX Exporter Turbo-Deluxe"):

- Browse all skeletons, suits, skills in the database.
- Load the correct Max file, check it out of SourceSafe, export, check back in.
- Filter by keywords (e.g. all content for a named character).
- Batch export the whole database or filtered subsets.
- Dry-run mode (write-enable flag off) to see what would be exported.
- Compression statistics, histogram analysis, and pose analysis reporting.

### Language lineage

MaxScript was designed by **John Wainwright**, who also designed **ScriptX** at Kaleida Labs and its underlying **Objects in C (OIC)** object system. Both languages are Lispy in feel. Don Hopkins used ScriptX at Kaleida (1992–1994) and then MaxScript at Maxis (1997–2000) to build the Sims character animation pipeline. The shared design sensibility — dynamic types, concise syntax, excellent native-code plug-in interface — made MaxScript a natural fit for driving the exporter from a database and integrating with external tools.

---

## Content tools and community ecosystem

### Transmogrifier

- **Purpose:** Clone existing Sims objects and edit name, price, description, and sprite graphics.
- **Object format:** IFF files containing z-buffered sprites (RGB + depth + alpha), SimAntics behavior trees, catalog strings, and metadata.
- **Magic Cookies:** Unique GUIDs allocated to object creators to prevent ID conflicts — essential for a decentralized content ecosystem.
- **SafeTMog proposal:** A restricted version that only allowed safe graphical/textual modifications to stock objects, exchanged as zip files of XML + bitmaps (pure data, no code). Designed to prevent viruses and protect game stability while enabling user content for The Sims Online.

### RugOMatic

- **Purpose:** Drag-and-drop creation of custom rugs from any picture and text description.
- **Output:** A playable IFF object + an HTML page (name, price, description, preview image, download link) for publishing on the web.
- **In-game:** Custom rugs had a "Describe" pie-menu action so players could read the embedded text — turning rugs into an in-game publishing medium.

### ShowNTell

- **Purpose:** ActiveX control for live preview of Sims IFF objects on web pages.
- **Use case:** Content sites (SimFreaks, SimSlice, etc.) could show interactive object previews — rotation, zoom, read catalog text — without launching the game.

### RSS 2.0 Sims Module / MySim tool

- **Purpose:** Drag-and-drop publishing of Sims objects to Radio UserLand blogs via an RSS 2.0 module.
- **Flow:** Drop an IFF into a directory → auto-generate preview + description → paste into blog entry → upload object + preview to the blog.
- **Vision:** Decentralized content distribution through standard web syndication, integrated with ShowNTell for live object previews on any blog.

### Community content sites

Sites like **SimFreaks**, **SimSlice**, **The Sims Content Catalog**, **Simprov**, **The Bunny Wuffles School of Sims Transmogrification**, and **The Sims Exchange** formed a thriving ecosystem of:

- Downloadable objects, skins, heads, and character animations.
- Tutorials (from beginner Photoshop/TMog basics to advanced techniques).
- Story-driven content (The Sims Exchange was a specialized blog built around in-game storytelling with downloadable families and houses).
- Object catalogs with previews, ratings, and search.

---

## Relevance to VitaMoo

### Note track equivalents in VitaMoo

VitaMoo's `TimeProps` and `Props` types already mirror the original note-track data model:

- **`Props`** = key/value string pairs (same as a single note track key's text).
- **`TimeProps`** = integer-keyed timeline of `Props` (same as a note track's keys-in-time).
- **`MotionData.hasProps` / `hastimeprops`** = per-motion event streams, parsed from note track keys in the original exporter.

When we import glTF animations or define timeline segments for streamed animation blending, the same `TimeProps` structure can carry events (sound cues, hand poses, anchor points, interaction sync) attached to bones at specific times — exactly as the original pipeline did. See **[gltf-extras-metadata.md](./gltf-extras-metadata.md)** for the full `vitamoo_` extras schema and the note-track → extras mapping table.

### Browser-based tool equivalents

| Original tool | Browser equivalent (future) |
|--------------|----------------------------|
| CMX Exporter (3DS Max) | glTF import/export + VitaMoo parsers; batch operations in JS |
| Transmogrifier | Browser object editor: swap sprites, edit catalog strings, export IFF via readback |
| RugOMatic | Drag-and-drop object creator using WebGPU readback → BMP/z-buffer → IFF |
| ShowNTell | Embedded `<canvas>` with VitaMoo WebGPU renderer — live object/character preview on any web page |
| The Sims Exchange / SimFreaks | Modern content site with embedded WebGPU previews, glTF downloads, user galleries |
| RSS Sims Module | Standard web APIs (REST, ActivityPub, RSS) with glTF/IFF attachments for content syndication |

### GPU readback for authoring

The readback infrastructure in `Renderer` (color, depth, object-ID buffers) directly supports the Transmogrifier/RugOMatic-style authoring flow:

1. Render an object or character pose with WebGPU.
2. Read back **color + alpha** (→ BMP, PNG, or IFF sprite channel).
3. Read back **depth** (→ z-buffered sprite layer for isometric composition).
4. Read back **object-ID** (→ per-pixel part identification for paint tools).
5. Assemble into IFF or publish as glTF + raster previews for a content site.

No server round-trip needed — everything happens in the browser, matching the spirit of the original standalone desktop tools.

### Animation events and object interaction sync

The original `SAnimator` delivered note-track events to SimAntics tree code during playback — `xevt` for branching, `sound` for audio, `dress`/`undress` for costume changes, `anchor` for foot planting. VitaMoo's `Practice` and timeline system should carry the same event vocabulary (or a superset) so that:

- Imported Sims 1 skills play with correct sound/event timing.
- New glTF-authored animations can embed events via glTF extras or a sidecar JSON.
- Streamed long animations (walk → reach → interact) fire events at blend boundaries.
- Browser tools can place and edit events on a timeline, just as artists did in the 3DS Max note track editor.

---

## References

- [Automating The Sims Character Animation Pipeline with MaxScript](https://web.archive.org/web/20080224054735/https://www.donhopkins.com/drupal/node/30) — Don Hopkins, 2004 (email to John Wainwright, 1998).
- [Sims VitaBoy Character Animation Library Documentation](https://web.archive.org/web/20080224054735/https://www.donhopkins.com/drupal/node/19) — Don Hopkins. Full VitaBoy API, note track tags, SAnimator events.
- [Sims Character Animation File Format](https://web.archive.org/web/20080224054735/https://www.donhopkins.com/drupal/node/20) — Don Hopkins. CMX, SKN, BCF, BMF, CFP structures.
- [Details on The Sims Character Animation File Format and Rendering](https://web.archive.org/web/20080224054735/https://www.donhopkins.com/drupal/node/21) — Don Hopkins. Deformation algorithm, blended vertices, smoothing groups.
- [A Proposal to Develop Third Party Content Authoring Tools for The Sims](https://web.archive.org/web/20080224061751/http://www.donhopkins.com/drupal/node/16) — Don Hopkins, March 2000.
- [SafeTMog: Safe Transmogrifier Plan](https://web.archive.org/web/20080226053023/http://www.donhopkins.com/drupal/node/18) — Don Hopkins.
- [The Sims Transmogrifier 2.0, and RugOMatic](https://web.archive.org/web/20080325081109/http://www.donhopkins.com/drupal/node/1) — Don Hopkins.
- [Transmogrifier Renovation Plan](https://web.archive.org/web/20080224054735/https://www.donhopkins.com/drupal/node/17) — Don Hopkins. Expansion pack support, Windows XP fixes, installer, feature requests.
- [RugOMatic Documentation and Tutorial](https://web.archive.org/web/20080224054735/https://www.donhopkins.com/drupal/node/11) — Don Hopkins. Drag-and-drop rug creation with auto-generated HTML pages.
- [ShowNTell ActiveX Plug-In for Previewing Sims Objects](https://web.archive.org/web/20080224054735/https://www.donhopkins.com/drupal/node/2) — Don Hopkins. Live IFF preview on web pages.
- [RSS 2.0 Sims Module, and MySim tool for Radio UserLand](https://web.archive.org/web/20080224054735/https://www.donhopkins.com/drupal/node/5) — Don Hopkins. Blog-based content syndication.

### Archive.org content mining targets

The Sims Exchange and community content sites are partially preserved on the Wayback Machine. These are rich sources of downloadable IFF objects, character skins, family albums, stories, and tutorials — content that could be imported, previewed, and republished through VitaMoo browser tools.

- [The Sims Exchange](https://web.archive.org/web/2004*/http://thesims.ea.com/us/exchange/*) — EA's official user content hub: family albums, houses, stories, rated and searchable. Captures from ~2001–2008 contain downloadable families, houses, and story pages with embedded screenshots.
- [SimFreaks](https://web.archive.org/web/2003*/http://www.simfreaks.com/*) — Major fan site with custom objects, skins, tutorials, and forums.
- [The Sims Transmogrifier home page](https://web.archive.org/web/2007*/http://www.thesimstransmogrifier.com/*) — Download site, documentation, Magic Cookie registration, links to community resources.
- [The Bunny Wuffles School of Sims Transmogrification](https://web.archive.org/web/2004*/http://www.strategyplanet.com/thesims/sas/bwsost/*) — Step-by-step TMog + Photoshop tutorials from beginner to advanced.
- [Google Directory: The Sims Modifications and Add-Ons](https://web.archive.org/web/2004*/http://directory.google.com/Top/Games/Video_Games/Simulation/Life/The_Sims/Modifications_and_Add-Ons/*) — Curated link directory to hundreds of content sites.

Mining these archives could recover thousands of IFF objects, BMP skins, CMX/SKN character data, and tutorial content — testable and displayable in VitaMoo immediately, and convertible to modern formats (glTF, PNG) for redistribution on new community sites.

---

## Ken Perlin's Improv and procedural graphics — influence on VitaBoy

The Sims character animation system was directly inspired by Ken Perlin's **Improv** project (Perlin & Goldberg, SIGGRAPH '96). Improv separated character animation into an **Animation Engine** (layered, continuous, non-repetitive motions with smooth transitions) and a **Behavior Engine** (rules governing how actors communicate and decide). Actions were organized into compositing groups — actions in the same group competed (one fades in, others fade out), while actions in different groups layered like image compositing. Perlin's key insight: *"the author thinks of motion as being layered, just as composited images can be layered back to front. The difference is that whereas an image maps pixels to colors, an action maps DOFs to values."*

VitaBoy's Practice/Skill/Motion system implements this same layered architecture: Practices have priorities, opaque practices occlude lower-priority ones on the same bones, and multiple practices blend via weighted averaging. The vocabulary (Skeleton, Bone, Skin, Suit, Dressing, Skill, Practice, Motion) carries Improv's spirit into the game engine.

Since 1996, Perlin has published many interactive Java applet demos on his NYU page, teaching computer graphics to students and the public. Don Hopkins learned from his papers and demo code while designing the Sims character animation system. Perlin's **Webwide World** (1998) was a procedural planet generator running in a Java applet — progressive rendering, cached Catmull-Rom splines for multi-octave noise, and plans for user-owned real-estate on a fractal planet. His later **Dragon Planet** (2013) ported the same no-polygon procedural approach to WebGL fragment shaders. As of November 2025, Perlin is rewriting all his classic Java applets in JavaScript (Canvas2D and WebGL), noting: *"the great thing about ideas is that, unlike technology, ideas can last forever."*

VitaBoy also includes a `QuaternionNoise` generator based on Perlin noise, intended for adding organic wiggle to bone rotations (wired but never tuned for shipping). The `canWiggle` / `wigglePower` bone flags and the `vitamoo_wiggle` glTF extras field preserve this capability for future use.

### References

- [Ken Perlin's NYU page](https://mrl.cs.nyu.edu/~perlin/) — experiments, courses, toys (expired HTTPS cert; content accessible).
- [Webwide World (1998)](https://web.archive.org/web/20001011065024/http://mrl.nyu.edu/perlin/demox/Planet.html) — procedural fractal planet in a Java applet.
- [Dragon Planet (2013)](https://blog.kenperlin.com/?p=12821) — procedural planet in a WebGL fragment shader.
- [Updating applets (2025)](https://blog.kenperlin.com/?p=27980) — rewriting classic Java applets in JavaScript.
- [Improv: A System for Scripting Interactive Actors in Virtual Worlds](https://mrl.cs.nyu.edu/~perlin/improv/) — Perlin & Goldberg, SIGGRAPH '96. The layered animation architecture that inspired VitaBoy.
- [HN comment by DonHopkins](https://news.ycombinator.com/) — *"I learned a lot from his papers and demo code, and based the design of The Sims character animation system on his Improv project."*
