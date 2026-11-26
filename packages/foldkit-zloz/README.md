# ZLOZ

Graph editing with state owned by your application. The pure TypeScript core has
no runtime dependencies. The optional `/foldkit` entry renders HTML nodes and SVG
edges through your existing FoldKit builder. ELK is available separately as
`@opsydyn/foldkit-zloz-elk`.

`@opsydyn/foldkit-zloz` is available on npm.

The four public ZLOZ packages release together, with adapters pinned to the exact
core version. The [release train](https://github.com/opsydyn/fold-kit-experiments/blob/main/docs/releases/foldkit-zloz.md#release-action)
verifies registry archives and provenance before advancing to the next package.

## Install

```sh
npm install @opsydyn/foldkit-zloz
# Only for the native view:
npm install foldkit@0.170.0 effect@4.1.0 @effect/platform-browser@4.1.0
```

For workspace development, use the checked local tarball described in
[the publication guide](https://github.com/opsydyn/fold-kit-experiments/blob/main/docs/releases/foldkit-zloz.md). ESM only, Node 22+
for tooling. The view is for browsers; pure imports do not access browser globals.
The tested view baseline is FoldKit 0.170.0 / Effect 4.1.0. Both are optional peers.

## Effect UI preview

The `effect-ui-next` branch includes `@opsydyn/foldkit-zloz/effect-ui` for
Effect UI hosts. Use `graphSurface` with
`@opsydyn/foldkit-zloz/effect-ui.css` for the shared HTML and SVG view, or use
the `surfaceInput` mount to own the surface markup. The host owns the editor
state and routes `BrowserInput` events to `updateEditor`. The
[Connections workbench](../../apps/zloz-demo/src/connections/view.ts) shows strict
and loose sessions, custom port labels, and reconnection. Use the Effect UI
revision pinned by the workspace for this preview. For a native v3 editor,
compose `groupSurfaceV3`, `groupInspectorV3` and `groupClipboardV3` with
`updateGroupWorkbenchV3` and the same policy in the host.

## Core

```ts
import { createEditor, updateEditor, serializeGraph, parseGraph } from '@opsydyn/foldkit-zloz';
import type { ZlozGraph } from '@opsydyn/foldkit-zloz';

const graph: ZlozGraph = {
  nodes: [
    {
      id: 'source',
      label: 'Source',
      position: { x: 40, y: 40 },
      size: { width: 180, height: 90 },
      ports: [{ id: 'out', kind: 'output', side: 'right', offset: 0.5 }],
    },
  ],
  edges: [],
};
const editor = createEditor(graph);
const selected = updateEditor(editor, { type: 'NodeSelected', id: 'source', additive: false });
const moved = updateEditor(selected, { type: 'SelectionNudged', delta: { x: 20, y: 0 } });
const document = serializeGraph(moved.graph);
const restored = createEditor(parseGraph(document));
```

Keep the editor in your Model. Nodes have stable IDs, positions, positive dimensions
and named input/output ports. Port offsets are fractions of the chosen side. Edges
refer to both node and port IDs. Optional node/edge `data` accepts finite JSON data.
Functions reject duplicate IDs, invalid sizes and missing/wrong-direction endpoints
with `ZlozError`. JSON syntax errors remain `SyntaxError`.

`updateEditor(state, event, { canConnect })` lets the application reject a proposed
connection with a reason or accept it with `null`. Cycles are allowed by the core.
Exact duplicate connections are ignored with a notice. The policy is supplied by
the host on each update; it is not serialized into the Model.

Each completed drag, keyboard nudge, graph edit or accepted layout is one undo
transaction. Escape restores the pre-drag positions. The default history limit is
100 (configurable from 0 to 1000). Measurements update dimensions without creating
history entries. Undo and measurements advance the revision used to reject stale
layout results. Selection, viewport, gestures and history are excluded from saved
documents. Applications own storage and migration beyond document version 1.

## Headless palette and external placement

Palette cards and normalized external graph fragments use the same pure contract:

```ts
import {
  createArchitecturePattern,
  createEditor,
  createPlacement,
  updatePlacement,
  resolvePlacement,
  applyPlacement,
} from '@opsydyn/foldkit-zloz';

const context = {
  scope: 'orders/editor-session-1',
  editor: createEditor({ nodes: [], edges: [] }),
};
const idle = createPlacement(context.scope);
const started = updatePlacement(idle, context, {
  type: 'PlacementStarted',
  scope: context.scope,
  generation: idle.generation,
  intent: {
    source: { type: 'palette', id: 'c4-context' },
    fragment: createArchitecturePattern('c4-context'),
    anchor: { x: 30, y: 65 },
    snapping: { grid: true, anchorDistance: 12, anchors: ['center'] },
  },
});
const positioned = updatePlacement(started, context, {
  type: 'PlacementTargetChanged',
  scope: context.scope,
  generation: started.generation,
  target: { space: 'world', point: { x: 100, y: 200 } },
});
const preview = resolvePlacement(positioned, context);
if (preview.type === 'ready') {
  const result = applyPlacement(positioned, context, preview.request);
  // On 'placed', publish result.editor and result.placement together in the host Model.
}
```

Use a fresh scope when replacing the editor/controller, normally from the host's
model/session identity. Start captures an immutable source, not a live palette
object. Cancel with `PlacementCancelled` carrying current scope/generation.
Preview/cancel leave graph and Undo/Redo unchanged. Apply rebuilds against live
context and policy; the request pins the reviewed source generation and target
sample. Old callbacks, changed graph revisions and late vetoes cannot publish.
Successful Apply is one Undo transaction and ends the session.

`world` targets need no measured surface. `screen` points are canvas-local CSS
pixels; `client` points use `context.origin` for the current canvas origin. Both
screen/client modes require `editor.surface`. Zoom, size and scroll-origin changes
require a fresh target sample. Adapters own current DOM measurements, parsing,
files/HTML transfers and normalization of additional CSS transforms. External
sources supply graphs (for example from `parseGraph`), never executable content.

Grid snapping inherits the editor unless overridden. Opt-in visible node-frame
centre/corner snapping uses a CSS-pixel radius and deterministic ties; empty
`anchors` disables it. `snapBypassed: true` on a target disables both rules. Snap
feedback exposes raw/resolved points and a typed anchor when attracted. It does
not imply collision avoidance or automatic connections.

Set `parentId` on a target for explicit group membership. Only fragment roots
attach; internal relationships and authored bends are remapped/translated, with
world coordinates preserved. By default all inserted nodes must fit and roots
receive parent containment. `constrainToParent: false` permits unconstrained
membership. No existing group is resized. A missing, hidden or collapsed parent
blocks with a reason.

Pass the current `ZlozPlacementPolicy` to both preview and Apply. `canPlace`
receives source metadata and the complete remapped proposal; existing
`canInsertPattern`, connection/port and selection policies remain composed.
Read-only/busy/Undo-disabled states reject without changing the editor. The source
kind/ID and preview request grant no authority. Candidate copies are detached;
mutating a preview cannot change the captured source or authorize an altered Apply.

Placement state is ephemeral; canonical graph/snapshot/model v1 formats remain
unchanged. Native/custom palette, pointer/touch and keyboard UI adapters follow
this headless slice.

## Native and custom placement palettes

The optional Foldkit adapter composes the headless contract. Core exports
`ZlozPaletteEntry`, `ZlozPalettePolicy`, `ZlozPlacementInput`,
`resolvePlacementControls`, `updatePlacementControls` and `placementForScope`.
Each catalogue entry supplies a stable ID, label and the normalized placement
intent above; its source may be palette or external.

```ts
import { resolvePlacementControls, updatePlacementControls } from '@opsydyn/foldkit-zloz';
import {
  zlozPlacementHost,
  zlozPalette,
  zlozPaletteEntry,
  zlozPlacementPreview,
} from '@opsydyn/foldkit-zloz/foldkit';

// In the host update, using current editor, scope, catalogue and policies:
const result = updatePlacementControls(model.placement, context, entries, input, policy);
// Publish result.editor, result.placement and result.notice together in Model.

// In the host view; onInput maps package facts to your own Foldkit Message:
const controls = resolvePlacementControls(model.placement, context, entries, policy);
const palette = zlozPalette(h, controls, onInput, {
  diagnostics,
  renderEntry: (entry, builder) =>
    zlozPaletteEntry(
      builder,
      entry,
      [builder.Class('my-palette-card')],
      [builder.strong([], [entry.label])],
    ),
});
// Wrap palette and zlozView under zlozPlacementHost(h, controls, onInput, attrs, children).
// In zlozView's renderWorldOverlay, return zlozPlacementPreview(builder, controls).
```

One stable `zlozPlacementHost` contains one canvas and its palette. It scopes the
Live input resource and releases listeners/capture on unmount. Cards use native
buttons with shared pointer and keyboard behavior. Drag with mouse/touch, or
activate a card then tap the canvas. Releasing inside applies once; outside retains
the pending placement. Escape, pointer cancellation/lost capture and window blur
cancel without Undo. A plain card click keeps the centre preview available.

Keyboard activation previews at the measured canvas centre. Arrows move, Shift
accelerates, Alt bypasses snapping, Enter places, Escape cancels. Apply/Cancel
buttons provide explicit alternatives. Sidebar controls and editable fields keep
their native keys. Unmeasured/stale projections reject; use a new target or restart.
`PlacementAccepted` pins `targetRevision` so old controls cannot accept new targets.

`canStartPlacement` protects catalogue activation. Position-dependent `canPlace`
and existing insertion/connection/port policies stay live at preview/Apply. A
removed catalogue entry does not revoke an already captured intent; express that
in the live Apply policy. Change scope on editor/controller replacement;
`placementForScope` explicitly returns a fresh session when scope changes.

Compose `zlozPaletteEntry` and `zlozPlacementAction` for custom layouts. An internal
frame retains touch behavior when button styles are replaced. The palette
supports custom entry/status renderers (`undefined` falls back; `null` omits).
`zlozPlacementPreview` is decorative world-space artwork; use the public preview
context to draw other shapes. Instructions and position/snap measurements respect
passed diagnostics; protection reasons and controls remain available in minimal
mode. The host chooses whether to render any part at all.

The browser adapter measures canvas origin for every pointer sample. Additional
CSS transforms, native file/DataTransfer parsing and IO belong to the host; this
is a normalized graph placement contract, not an OS drag-and-drop parser. No graph
wire format changes. The workbench demonstrates native/custom cards and shared
C4/DDD placement with live protection and one Undo.

<a id="svg-export-planning-unreleased"></a>

## SVG export planning

`planSvgExport` defines the package-owned boundary before file writing or PNG:

```ts
import { planSvgExport } from '@opsydyn/foldkit-zloz';

const plan = planSvgExport(
  { graph, viewport },
  {
    title: 'Order platform',
    description: 'Canonical architecture model',
    region: { type: 'model', padding: 24 },
    scale: 1,
    theme: { colorScheme: 'dark', tokens: { edge: '#98beff' } },
    background: { type: 'transparent' },
    font: { family: 'Inter', size: 14, weight: 400 },
    renderers: { nodes: 'built-in', edges: 'built-in' },
  },
);
// Review plan.findings. `reviewable` is a plan, not an emitted or qualified SVG.
```

Use `{ type: 'viewport', size: { width, height } }` with an explicit camera for a
CSS-pixel viewport crop, or `{ type: 'bounds', bounds: { x, y, width, height } }`
for a world-space crop. Viewport output dimensions retain surface pixels times
scale; its world viewBox accounts for pan/zoom. All graph items remain available
for crossing edges and clipping. These are canonical-model crops, not live DOM,
filtered/collapsed UI or transient layout-route snapshots.

Model bounds include authored node/group boxes, edge bends and declared custom
SVG bounds, then add padding. Empty models use a 1×1 world artboard. Automatic
bounds are explicitly estimated: labels, strokes, port artwork and custom curves
can extend beyond them. Font substitution, wrapping and ink bounds are unverified.
A later writer must qualify actual files. Explicit crops are not silently enlarged.

Themes resolve shared light/dark colors into an export-specific paint subset and
numeric edge width. Background is `theme`, `transparent` or `{ type: 'color',
value: '#ffffff' }`. Supported paints are literal hex, `none`, `transparent`, and
space-separated numeric `rgb(...)` with optional alpha. Resolve CSS/Pleat variables
before planning; host-dependent or unsupported values block with reasons. This
contract reproduces declared paint inputs, not arbitrary host CSS. Title/description
and graph labels remain literal text for a future writer to escape safely.

Renderer coverage is mandatory because core cannot infer custom UI from graph data.
Node declarations cover body/port/badge artwork; edge declarations cover paths, labels
and markers. Host-only overlays are outside this canonical-model contract.
Use `unknown` for undeclared node/edge coverage. Override known items explicitly:

```ts
const renderers = {
  nodes: 'unknown',
  edges: 'built-in',
  overrides: [
    {
      target: { kind: 'node', id: 'orders' },
      renderer: {
        type: 'svg',
        id: 'orders-card',
        version: '1',
        bounds: { x: 0, y: 0, width: 240, height: 160 },
        fidelity: 'approximate',
        reason: 'Interactive HTML editor becomes static text',
      },
    },
  ],
} as const;
```

A `svg` declaration remains unverified, including declared `equivalent` fidelity;
`approximate` adds a loss finding. `fallback`, `omit` and `unsupported` take visible
reasons. Omission is per graphic; it does not remove graph nodes or rewrite their
connections. Connections to omitted nodes receive a separate finding. Duplicate or
missing override targets reject. These are adapter declarations, not executable
SVG/HTML callbacks or proof that a renderer exists.

Declare image/font/stylesheet assets with `id`, `kind` and `availability`
(`embedded`, `external`, `missing`). External/missing resources block; embedded
resources still need byte/resource qualification. `font.assetId` must name a declared
font asset. The planner never fetches resources or reads installed fonts.

Findings identify document/item/theme/asset, code, severity and reason. Unsupported
findings make the plan `blocked`; other plans are `reviewable`, retaining all loss
and uncertainty reports. Plans detach inputs and preserve editor/history. They are
ephemeral, with no graph wire-version change. The bounded writer below implements SVG serialization. Reusable review/download controls are described below; broader visual
qualification and PNG remain subsequent work.

<a id="standalone-svg-writing-unreleased"></a>

## Standalone SVG writing

```ts
import { writeSvgExport } from '@opsydyn/foldkit-zloz';

const result = writeSvgExport(snapshot, exportOptions, {
  idPrefix: 'orders-diagram',
  allowLosses: false,
});
if (result.type === 'written') {
  // result.svg is standalone XML. Use a host Command/CLI adapter to save/download it.
  // Review result.findings, including unverified bounds/fonts and custom fidelity.
}
```

The writer rebuilds its plan from current inputs. Blocked results contain no SVG;
losses need explicit `allowLosses: true`. A written file retains all uncertainty
findings and does not claim DOM parity. Canonical group/node outlines, ports/labels,
connections/arrows, authored bends and node architecture metadata use shared geometry
and paints. Dimensions, background and clipping follow the chosen export region.
DDD/EventStorming edge notation and side-role artwork require an adapter or explicit
`semantic-edge-fallback` loss acknowledgement; a plain arrow is not semantic parity.
Editor, camera and Undo remain unchanged. Title/description and all text/identifiers
are escaped, and characters XML cannot represent block output.

Bind custom SVG declarations with `adapters: [{ id, version, render }]`. Exact
ID/version must match. The frozen context discriminates `kind: 'node'` with `node`,
or `kind: 'edge'` with `edge`, `source` and `target`; both include resolved theme and
font. Render in world coordinates, returning a non-empty array of `ZlozSvgPrimitive`.
Adapters replace the complete item, including custom port/label artwork. They must
be pure synchronous host functions; the package does not sandbox arbitrary code.

Primitives support rect, circle, line, polygon, polyline, text and translated groups.
Paints are supported literals; opacity, stroke width, coordinates and dimensions
are validated. Text supports newlines, anchor, size and weight. Unknown fields/tags,
raw markup/CSS/paths, URL paints and active/HTML content reject rather than silently
omitting content. Use a declared `omit` for intentional omission. Mutation or callback
failure blocks atomically; read `result.findings` for writer-level reasons.

Embedded declarations alone are insufficient: selected TrueType fonts need validated
byte resources (below); images and stylesheets remain unsupported. No fetching or
foreignObject is used. Font substitution,
wrapping and ink bounds remain unverified. Defaults are 10,000 drawing primitives,
depth 32 and 2,000,000 output UTF-16 code units, configurable through `maxPrimitives`,
`maxDepth` and `maxCharacters`. These are output/recursion limits, not a peak-memory
or rendering-speed claim. Supply unique XML-safe `idPrefix` values for multiple inline
exports. The default prefix is suitable for separate standalone files.

Representative emitted files and browser captures are linked in the
[writer evidence](evidence/svg-writer.md). Resource embedding and PNG remain subsequent work.

<a id="svg-review-and-download-controls-unreleased"></a>

## SVG review and download controls

Core exports `createSvgReview(scope)`, `svgReviewForScope(state, scope)`,
`resolveSvgReview(state, context)` and `updateSvgReview(state, context, request)`.
The context supplies the snapshot, a source revision, title, literal theme and renderer
fidelity declarations. Optional catalogs configure model/viewport/custom bounds,
themes and backgrounds; `canDownload` returns a live protection reason or `null`.
Advance `sourceRevision` on every edit and Undo, or use unique immutable snapshot IDs.
Use a fresh scope for each model/controller incarnation.

```ts
import { createSvgReview, resolveSvgReview, updateSvgReview } from '@opsydyn/foldkit-zloz';
import { zlozSvgReview } from '@opsydyn/foldkit-zloz/foldkit';

const review = createSvgReview(context.scope);
const controls = resolveSvgReview(review, context);
const view = zlozSvgReview(h, controls, onReviewRequest, { diagnostics });
// In update, always pass current inputs, rather than a cached controls projection:
const next = updateSvgReview(review, context, request);
// Publish next.state. Only next.payload authorizes a host Command to download its
// captured svg/fileName; report SvgDownloadSettled with its scope/generation/key/run.
```

Final writer findings stay visible. Unsupported output blocks download; reported
losses need explicit acceptance for the exact source revision, options, bytes and
findings. Settings, edit then Undo, viewport changes or changed adapter output clear
approval. Whole-model camera motion does not. Live protection can deny download
without revoking approval of unchanged content. Review is a host workflow, not an
access-control boundary. Keys are exact strings; large-model recomputation costs
remain unqualified. IO never edits the model or creates an Undo entry.

`zlozSvgReview` includes labeled native choices, a static SVG image preview, findings,
loss checkbox, guarded download and visible status. Slots replace settings, preview,
individual/all findings, acceptance, download, status, readout or complete layout:
`undefined` uses the default and `null` omits a region. Helpers `zlozSvgReviewSelect`,
`zlozSvgLossCheckbox`, `zlozSvgDownloadButton` and `zlozSvgReviewPreview` support custom
presentation. Supply distinct `idPrefix` values for concurrent widgets. The controller
still enforces approval regardless of presentation. Diagnostic instruction/measurement
settings hide optional prose/readouts, retaining findings and functional controls.

See [workbench evidence](../../apps/zloz-demo/evidence/svg-review.md) and
[ADR 0054](../../docs/adr/0054-review-svg-before-host-download.md). Browser completion
means handoff, not confirmed OS saving. Broader font formats/resources remain open. PNG is implemented below; Alchemy
Domain has a separate [integration review](../../docs/assessments/2026-11-13-zloz-alchemy-domain-integration.md).

<a id="embedded-truetype-fonts-unreleased"></a>

## Embedded TrueType fonts

Supply trusted single-face TrueType sfnt bytes through `fontResources`, binding the
selected `font.assetId` to an asset declared as an embedded font:

```ts
import { validateSvgFontResource, writeSvgExport } from '@opsydyn/foldkit-zloz';

const resource = { assetId: 'inter', format: 'truetype', bytes: fontBytes } as const;
const validation = validateSvgFontResource(resource);
if (validation.type === 'invalid') {
  console.log(validation.code, validation.reason);
}
const result = writeSvgExport(
  snapshot,
  {
    ...exportOptions,
    font: { family: 'Inter', size: 14, weight: 400, assetId: 'inter' },
    assets: [{ id: 'inter', kind: 'font', availability: 'embedded' }],
  },
  { fontResources: [resource], maxFontBytes: 1_048_576 },
);
// Read final result.findings. The writer revalidates bytes on every call.
```

Validation checks bounded file/directory structure, aligned non-overlapping table
ranges, checksums, required table sizes and basic header/glyph-location consistency.
A valid result exposes `byteLength`, `tableCount`, the OS/2 `weight` and a copied,
encoded `dataUrl`. It is structural evidence, **not a font sanitizer** or proof of
correct glyph programs, layout tables, browser decoding, coverage, shaping or ink
bounds. Use trusted fonts you may distribute. Restricted/bitmap-only embedding
flags reject; flags alone do not grant a license.

Default byte budget is 1 MiB per face; `maxBytes` (validator) / `maxFontBytes`
(writer) must be safe integers from 1 to 16 MiB. The total SVG `maxCharacters`
limit also includes base64 font data. Source bytes are copied before validation
and encoding, including Buffer inputs and views with nonzero offsets. No IO,
installed-font discovery, URL fetching or decompression occurs.

Only the selected declared embedded font can bind one resource. Missing bytes,
duplicates and undeclared/unreferenced resources block with asset-targeted
`font-resource-missing` / `font-resource-unexpected` findings. Invalid structure,
unsupported formats and exceeded byte budgets produce `font-resource-invalid`,
`font-format-unsupported` and `font-resource-limit` respectively. No partial SVG
is returned, and loss acceptance cannot override these failures.

The initial format excludes WOFF/WOFF2, collections, CFF, variable and color/bitmap
fonts. Successful output uses a generated family and package-owned `@font-face`
with a `data:font/ttf;base64` source and the face's declared weight. No host family
string, font name metadata, raw CSS or URL is inserted into the style block.
Use distinct `idPrefix` values when embedding several SVGs inline so their generated
font families and fragment IDs stay distinct. Style selection/synthetic weights and
metrics remain unverified in findings.
Changed bytes participate in the existing exact-artifact review identity, so prior
loss approval cannot authorize a different embedded font.

See [ADR 0055](../../docs/adr/0055-embed-bounded-truetype-font-resources.md) and
[font qualification](evidence/svg-font.md). PNG is implemented below; Alchemy remains separately scoped.

<a id="default-glyph-coverage-unreleased"></a>

## Default glyph coverage

`inspectSvgFontCoverage(resource, text, { maxBytes?, maxCharacters? })` validates
and owns font bytes, then checks a default Unicode cmap. The result is `checked`,
`unverified` or `invalid`. Checked results expose `format` (4 or 12), the count of
unique checked scalars, sorted `missingCodePoints` and `unverifiedCodePoints`.

```ts
import { inspectSvgFontCoverage } from '@opsydyn/foldkit-zloz';

const coverage = inspectSvgFontCoverage(resource, 'Orders 漢😀');
if (coverage.type === 'checked') {
  // Unicode numbers, not UTF-16 surrogate halves. Missing glyph index 0 is a loss.
  console.log(coverage.missingCodePoints);
} else {
  console.log(coverage.reason);
}
```

Selection consistently prefers one full-repertoire Unicode mapping over BMP
mappings, with Windows preferred over an equivalent Unicode-platform profile.
Maps are not unioned. Formats 4/12 require the matching BMP/full-repertoire profile;
other formats/profiles or absent Unicode maps stay unverified. Malformed selected
maps produce `font-cmap-invalid`, including bad bounds/order/ranges/glyph indices.
CR/LF/tab delimiters are excluded. Default-ignorable scalars such as joiners and
variation selectors remain unverified; they are not automatically missing glyphs.
Unpaired surrogates reject with `font-text-invalid`. Default text limit is 2,000,000
UTF-16 code units; exceeding `maxCharacters` returns `font-coverage-limit`. Invalid
budget configuration throws the existing core error. Font-byte limits still apply.

The SVG writer automatically checks **emitted** text, including ports, architecture
metadata, edges and nested custom text primitives. Omitted/replaced labels and
root title/description metadata do not generate false glyph findings. Targeted
`font-glyph-missing` findings are losses and require existing explicit acceptance.
Their structured `codePoints` arrays retain all unique missing scalars; reasons
show the first 16. `font-coverage-unverified` findings retain unknown sequence or
mapping status. Malformed maps block even with loss acceptance enabled. All findings
participate in the existing exact-artifact SVG review identity.

A default cmap mapping proves neither shaping/sequence behavior nor actual fallback
font selection or successful rendering. Glyph programs, combining-mark placement,
variation handling, synthetic variants, wrapping and ink bounds remain unqualified.
System fonts have no portable bytes to inspect and retain unverified findings.
See [coverage evidence](evidence/svg-font-coverage.md) and
[ADR 0056](../../docs/adr/0056-report-default-glyph-coverage-for-emitted-text.md).
PNG is implemented below; Alchemy remains separately scoped.

## Authored edge waypoints

Named world-space bends are document data, independent of transient layout routes:

```ts
import {
  createArchitecturePattern,
  createEditor,
  resolveEdgeWaypointEdit,
  updateEditor,
} from '@opsydyn/foldkit-zloz';

const waypointEditor = createEditor(createArchitecturePattern('ddd-aggregate'));
const connection = waypointEditor.graph.edges[0];
if (!connection) throw new Error('The starter requires a connection');
const request = {
  id: connection.id,
  revision: waypointEditor.revision,
  waypoints: [{ id: 'outside-boundary', position: { x: 480, y: 240 } }],
};
const preview = resolveEdgeWaypointEdit(waypointEditor, request);
// If allowed, display preview.edge without publishing it, or discard the draft.
const next = updateEditor(waypointEditor, { type: 'EdgeWaypointsChanged', ...request });
```

The reducer rechecks live revision, visibility, idle state, read-only/Undo settings
and `canChangeEdgeWaypoints(edge, next, graph)`. Blockers have visible reasons;
accepted replacements are detached and create one Undo entry. Preview is pure;
reset with `waypoints: null`. A non-empty list requires unique non-blank edge-local
IDs and finite coordinates. Empty lists are invalid. A no-op creates no history.

Authored bends form a polyline between live port anchors and override style/layout
routing. Custom geometry policies retain final control; path and arc-length label
anchor are shared by default renderers, hit targets and reconnection previews.
Endpoint/group movement and layout retain world-space bends; copy/paste and pattern
insertion translate them with the fragment. Collapsed endpoints temporarily use
projected group geometry. Minimap, fit/reveal, culling and history include bends;
edition comparison treats their identity/position as layout rather than meaning.

The optional field round-trips through existing v1 graph, snapshot, model and
edition codecs. Older readers can retain it, but older renderers cannot display
it. Mermaid reports waypoint geometry as projection loss. Composable interaction is available through the optional Foldkit adapter:

```ts
import { zlozView } from '@opsydyn/foldkit-zloz/foldkit';

const canvas = zlozView(h, editor, {
  id: 'architecture',
  label: 'Architecture',
  onEvent,
  edgeWaypoints: true,
  canChangeEdgeWaypoints: policy.canChangeEdgeWaypoints,
});
```

Select a connection to add, remove or reset bends. Drag a handle to preview; release
publishes one Undo transaction. Escape cancels. Arrow keys move in grid steps or
world units, Shift accelerates and Alt bypasses the grid, including modifier-only
updates during a drag. Each keyboard action is one Undo. Delete removes the focused
bend and returns focus to the canvas. A late policy veto or graph revision change
cannot publish the preview; the canonical graph and exports stay unchanged until
release. Additional bends split the longest authored segment rather than stacking
handles at the same anchor.

`resolveEdgeWaypointControls` and `resolveEdgeWaypointPreview` are pure core APIs.
Override `renderEdgeWaypoints` to compose `zlozEdgeWaypointHandle`,
`zlozEdgeWaypointAction` and `zlozEdgeWaypointReadout`, or return null to hide all
controls. Undefined keeps the default. The callback receives `diagnostics`; respect
`measurements` and `instructions` when displaying optional feedback. The readout
helper already suppresses measurements. Native semantics are independent of artwork;
attributes/children and readout attributes are composable. Default actions dock
inside the measured canvas; context exposes both the route anchor and panel bounds
for a designer's own placement. Theme tokens style controls in light and dark mode. `waypointLabelOffset` controls
the CSS-pixel displacement of labels that meet a selected handle (default 32px
above it; `{ x: 0, y: 0 }` disables the displacement without changing geometry).
Set `edgeWaypoints: false` to remove controls without changing authored data.

## Headless C4 and DDD nodes

The package owns architecture semantics and outline geometry independently of the
Astro example. C4 artwork is opt-in through the public presets below; the generic
Foldkit view keeps its existing defaults. Composable DDD renderers and atomic
pattern builders are also available through the package APIs below.

```ts
import {
  createArchitectureNode,
  createEditor,
  updateEditor,
  nodeShapeGeometry,
  nodeShapeContainsPoint,
  portPosition,
} from '@opsydyn/foldkit-zloz';

const store = createArchitectureNode({
  id: 'orders-store',
  label: 'Orders',
  position: { x: 40, y: 40 },
  size: { width: 200, height: 120 },
  ports: [{ id: 'out', kind: 'output', side: 'right', offset: 0.5 }],
  architecture: {
    family: 'c4',
    role: 'container',
    technology: 'PostgreSQL',
    description: 'Stores accepted orders',
    scope: 'internal',
  },
  appearance: { shape: 'cylinder' },
  data: { owner: 'sales' },
});
const geometry = nodeShapeGeometry(store); // local SVG outline and content bounds
const endpoint = portPosition(store, 'out'); // canonical world coordinates
const hit = nodeShapeContainsPoint(store, endpoint); // inclusive world-space hit test
const editor = createEditor({ nodes: [store], edges: [] });
const changed = updateEditor(editor, {
  type: 'NodeArchitectureChanged',
  id: store.id,
  architecture: { family: 'ddd', role: 'repository' },
});
const restored = updateEditor(changed, { type: 'UndoPressed' });
```

`ZlozNodeArchitecture` is a discriminated union. C4 roles are `person`,
`software-system`, `container`, `component`; only containers/components carry
`technology`. DDD roles are `entity`, `value-object`, `aggregate-root`, `aggregate`,
`domain-event`, `domain-service`, `repository`, `bounded-context`. Bounded contexts
may classify their `subdomain` as `core`, `supporting` or `generic`. These are
diagram semantics, not domain identity or executable business invariants.
`architectureNodePresets` is a frozen typed catalogue of names and default shapes.

`createArchitectureNode` validates/detaches a standalone node and picks a catalogue
shape when omitted. Supply IDs, dimensions, ports and `kind` yourself. An aggregate
must be a portless group. Groups can represent C4 system/container and DDD
aggregate/context boundaries; group shapes remain rectangular. A context-map
bounded context can instead be a normal port-bearing node. Assemble parenting
with a complete graph, rather than referencing missing parents in the factory.

`architecture` and `appearance` are optional node fields; consumer `data` is
untouched. A role alone does not alter geometry. `appearance.shape` explicitly
chooses `rectangle`, `rounded-rectangle` or `cylinder`. A Person preset uses a
rounded card; a person adornment is future renderer artwork. Semantic changes
preserve the selected shape. `NodeAppearanceChanged` edits the outline, and null
on either change event removes that descriptor. Both use read-only/gesture gates,
one-step Undo, revision/route invalidation and independent host policies:

```ts
import type { EditorPolicy } from '@opsydyn/foldkit-zloz';

const policy: EditorPolicy = {
  canChangeNodeArchitecture: (node, next, graph) => null,
  canChangeNodeAppearance: (node, next, graph) => 'Keep the approved notation',
};
```

Callbacks receive current and validated proposed nodes plus the current graph.
Returning a reason vetoes the whole change. Exact no-ops do not publish a new
revision/history; malformed descriptors throw `ZlozError` before commit.

`nodeShapeGeometry` returns local `bounds`, `contentBounds` and `outlinePath`;
render the outline in that authored coordinate system. Rounded corner radius is
`min(12, width/2, height/2)`; cylinder cap radius is `min(16, width/4, height/4)`.
Its safe content sits between both cap interiors and can be empty at tiny sizes.
`nodeShapeBoundaryPoint(node, side, offset)` projects onto the same outline in
world space. Layout, marquee and grouping keep the rectangular authored envelope;
`nodeShapeContainsPoint` is an optional precise outline hit test. No DOM state or
renderer registry is persisted.

`portAnchor(port, node)` resolves default side/offset ports onto the selected
outline. Omit the node to retain legacy rectangular normalized coordinates.
Explicit `port.anchor` always wins, including after a shape change or resize.
`portBoundaryPosition` projects along the routing hint onto the selected outline;
ELK rejoins authored anchors and force routing leaves the conservative envelope
before corridor search. Native/custom port contexts and anchor controls use the
same canonical coordinates. Snapping continues to author envelope coordinates;
it does not automatically constrain explicit anchors to a curved outline.

`PortAnchorReset` restores the same side at offset `0.5` through the existing
`canEditPort` position policy and Undo. Hiding optional controls does not disable
these package APIs or protection rules.

Version 1 documents accept the new optional descriptors and validate their
reserved fields strictly. Literal old/new fixtures and the pinned pre-contract
core (`ce978a2`) qualify retention through legacy rename/move/copy/paste/Undo and
export. Older code retains the fields but uses generic rendering and rectangular
geometry. Other serializers are not covered by that qualification.
Run `bun tools/check-zloz-architecture-compat.ts` from this repository to repeat
the pinned-core check. No migration or registry publication occurs here.

## DDD preset renderers

```ts
import {
  zlozView,
  zlozDddNode,
  zlozDddGroup,
  createZlozNodeBodyCache,
  type ZlozDddNodeOptions,
} from '@opsydyn/foldkit-zloz/foldkit';

// Keep options and cache stable per canvas. Call with or without a cache.
const dddOptions: ZlozDddNodeOptions<Message> = {
  bodyCache: createZlozNodeBodyCache(),
  renderBadge: ({ architecture }, h) =>
    architecture.role === 'aggregate-root' ? h.span([], ['Consistency owner']) : null,
};
const canvas = zlozView(h, model.editor, {
  id: 'domain',
  label: 'Ordering domain',
  onEvent: (event) => Message.ObservedZlozInput({ message: event }),
  renderNodeShell: (context, h) => zlozDddNode(context, h, dddOptions),
  renderGroupShell: (context, h) => zlozDddGroup(context, h, dddOptions),
});
```

The adapter renders all eight existing DDD roles: entity, value object, aggregate
root, aggregate, domain event, domain service, repository and bounded context.
Aggregates and explicit bounded-context groups are portless boundaries; ordinary
context nodes can connect through their ports. Other families return undefined,
allowing normal rendering or a composed C4 fallback. DDD meaning does not force
an outline or color notation; authored appearance uses core geometry.

`ZlozDddContentContext` provides the node, narrowed DDD architecture, selection
and preview state. `renderBadge`, `renderType`, `renderName`, `renderSubdomain`,
`renderDescription` and `renderBody` customize inert content: undefined keeps the
default, null omits it. The badge is omitted by default. Bounded contexts display
optional subdomain classification. Compact group headers omit descriptions by
default; custom slots can display them with suitable authored space.

Use `renderControls` for interactive content outside the native drag button and
body cache; undefined keeps native context/collapse/resize controls and an empty
array omits them. `attributes` owns classes and paint; Model geometry stays
authoritative. Retain ports from the render context to preserve custom sockets
and current policy reasons. Scoped theme tokens support light/dark and host
themes. Minimal mode hides diagnostics, not the model's semantic role labels;
slots can independently omit those labels while native selection names remain.
Keep artwork callbacks inert and options stable when using `bodyCache`.

These views introduce no saved fields or business-rule enforcement. Use the
headless `architectureNodePresets` catalogue to compose a role legend or palette.
Atomic pattern insertion and typed DDD relationships are separate roadmap slices.

## C4 preset renderers

```ts
import {
  zlozView,
  zlozC4Node,
  zlozC4Group,
  zlozLightTheme,
  zlozDarkTheme,
} from '@opsydyn/foldkit-zloz/foldkit';

const canvas = zlozView(h, model.editor, {
  id: 'architecture',
  label: 'Order platform · system context',
  onEvent: (event) => Message.ObservedZlozInput({ message: event }),
  renderNodeShell: zlozC4Node,
  renderGroupShell: zlozC4Group,
  theme: model.dark ? zlozDarkTheme : zlozLightTheme,
});
```

The package draws C4 Person, Software System, Container and Component nodes, and
system/container group boundaries. Other families return undefined and use the
normal renderer. Use authored dimensions and `appearance` from the headless
contract; a semantic role alone does not replace a document's outline. The Person
glyph fits inside its card. Cylinders use the core's `outlinePath` and
`decorationPaths`; no second shape calculation lives in the view.

The presets retain native focus/selection, movement, ports, policy reasons,
context actions, collapse and resize controls. Content uses safe core bounds
inside the authored height; increase dimensions for long descriptions. External
scope uses both text and dashes. Scoped ZLOZ tokens control paint in light/dark
or host/Pleat themes. Theme changes do not alter the document or history.

`ZlozC4NodeOptions<Message>` exposes `renderIcon`, `renderType`, `renderName`,
`renderTechnology`, `renderDescription` and `renderBody`. Undefined keeps the
default part; null omits it. These slots supply **inert** content inside the native
drag button. Omitting visible names preserves native accessible selection names.
`renderBody` replaces content inside the canonical outline. Use a complete shell
and the public primitives when replacing the whole structure.

`attributes` customizes frame classes and paint while Model bounds remain
authoritative. `renderControls(context, h)` supplies live interactive content
outside artwork; undefined keeps native chrome and `[]` omits it. Use the view's
`renderPort` to customize or hide sockets independently. Semantic content remains
visible in minimal mode; it is not a measurement diagnostic.

Optional `bodyCache` accepts `createZlozNodeBodyCache()`. Create it once per canvas
and keep the options object/slot functions stable for reuse. Artwork keys include
the builder, node, selection/preview and options; they exclude full EditorState,
source feedback and port authorization. Controls and ports evaluate current
context even when artwork is retained. Changing a slot's captured inputs requires
a new immutable options object; cache-hit counts or universal speedups are not
claimed.

The Astro workbench's **Open C4 system context** and **Open C4 container view**
buttons demonstrate separate abstraction levels through these package exports.
The container view includes a portless boundary and a curved data-store anchor.
These are authored examples; atomic pattern insertion is not implemented yet.

## FoldKit view

```ts
import { zlozView } from '@opsydyn/foldkit-zloz/foldkit';
import type { EditorEvent, EditorState } from '@opsydyn/foldkit-zloz';
import type { HtmlBuilder } from 'foldkit/html';

function view(h: HtmlBuilder<EditorEvent>, editor: EditorState) {
  return zlozView(h, editor, {
    id: 'my-flow',
    label: 'Workflow editor',
    onEvent: (event) => event,
    renderNode: (node, builder) => builder.p([], [node.label]),
  });
}
```

Use a document-unique `id`. Custom nodes use the parent's builder and normal
FoldKit messages. Inputs, textareas, selects and editable content keep their normal
behaviour. Add `data-flow-no-drag` to custom interactive areas as needed. Native
input and ResizeObserver resources are acquired by Mount and released on unmount;
input observation stops while DevTools displays a historical view. Resuming input
cancels any unfinished gesture retained in that Model snapshot.

- Drag node titles; Shift-click titles to select several. Drag the background to pan.
- Scroll over the surface to zoom around the pointer (0.1–4× by default). The surface owns touch
  gestures; this initial version supports one pointer, not pinch zoom.
- Tab to titles; Enter/Space selects and arrow keys move. Shift uses larger steps.
- Activate an output port, then an input port, by mouse or keyboard to connect.
- Escape cancels. Delete removes selected nodes and their incident edges together.
- Cmd/Ctrl+Z undoes; Shift+Cmd/Ctrl+Z or Ctrl+Y redoes. Text fields retain native undo.
- Connection buttons below the surface provide keyboard selection of edges.

The view measures node content. Width is controlled by `node.size.width`; height
follows content, with a 64px minimum. Fit through `fitViewport(graph, editor.surface)`
after the surface has reported dimensions. Zoom limits can prevent fitting extremely
large graphs. When replacing a document on an existing mounted surface, preserve
`editor.surface` (as the example's load handler does). Read-only editors retain
selection and viewport navigation.

Styles use ordinary HTML, inline geometry, and optional CSS variables:
`--flow-background`, `--flow-node-background`, `--flow-node-color`. No CSS import or
module registration is needed. Custom node content must remain accessible.

## Optional layout

Create a `layoutRequest(editor, uniqueRequestId)`, store it as the active request,
then run your chosen `LayoutEngine` in a Command. On completion pass the **current
active request** to `applyLayout(editor, active, result)`. The result is accepted
only if the request ID and revision still match and no gesture is active. Clear
the active request when loading/replacing a document; request IDs must not be reused
while old results can still arrive. Rendering never starts layout work.

Manual positioning has no layout dependency. The adapter receives a detached
snapshot; it cannot mutate the Model. All node positions are required exactly
once. Routes are optional, keyed by edge ID; node movement invalidates them and
the view uses straight lines until another arrange result is applied.

## Example and checks

Run `bun run --filter @opsydyn/web dev` and open `/flow` for custom text controls,
connections, ELK arrange, undo, save and reload. Storage belongs to that example.

```sh
bun run --filter @opsydyn/foldkit-zloz typecheck
bun run --filter @opsydyn/foldkit-zloz test
bun run --filter @opsydyn/foldkit-zloz pack:check
```

Initial scope: flat graphs, click-to-connect, single-pointer editing and bounded
history. Collaboration, execution,
virtualization and general layout algorithms are future work. Automated browser
checks do not establish assistive-technology or physical-touch acceptance.

Use `NodeWidthChanged` to commit an authored width while the view continues to
measure content height. `EdgeDataChanged` commits application-owned JSON metadata.
Both participate in undo/redo and graph serialization. The FoldKit view's
`edgeAppearance` callback can read edge data to customize stroke, width and dash
pattern. The editor still highlights the selected edge.

Use `renderEdge(context, h)` for custom SVG decoration along `context.path`.
The context includes the edge, label position, selection state, resolved
stroke, width and dash array, and an arrow marker reference. Return
`undefined` to draw the built-in edge. Keep custom SVG decorative and draw it
along the supplied path so ZLOZ's hit area, reconnect handles, and editable
label stay aligned. The SVG is hidden from assistive technology. Put
interactive controls in the host view.

Edge labels appear at the midpoint of the rendered path, including routed
edges. Select an unlabeled connection and choose **Add label**, or activate
an existing label to edit it. Enter saves, Escape cancels, and saving a blank
label removes it. Saving is one undo step. Read-only views display saved labels.

Use `renderEdgeLabel` for a custom badge and `renderEdgeLabelEditor` for an
inline editor. Each hook receives the edge, selection state, endpoint
description, and the same world anchor used by the default label. The editor
also receives the current draft. The view positions both in a protected HTML
layer on the canvas, so pointer and keyboard input inside a label can be used
without triggering canvas gestures.

```ts
// Import these primitives from @opsydyn/foldkit-zloz/foldkit.
renderEdgeLabel: (context, h) =>
  zlozEdgeLabelBadge(h, context, onEvent, [h.Class('relation-badge')], [
    context.edge.label || 'Add label',
  ]),
renderEdgeLabelEditor: (context, h) =>
  zlozEdgeLabelForm(h, context, onEvent, [h.Class('relation-editor')], [
    zlozEdgeLabelInput(h, context, onEvent, []),
    h.button([h.Type('submit')], ['Apply label']),
    zlozEdgeLabelCancel(h, context, onEvent, [], ['Discard']),
  ]),
```

Pass the same `onEvent` mapping used by `zlozView`. The badge is a native edit
button in editable views and static text in read-only views. The form handles
submit and Escape, while the input reads and updates the Model draft. Return
`undefined` from either hook to use the default. Return `null` from
`renderEdgeLabel` to hide the badge while retaining any enabled Rename action.
The hooks require a resolved label anchor. Saved labels and selected editable
unlabeled edges are eligible for the badge hook.

Set an edge's optional `pathStyle` to `straight`, `stepped`, or `smooth`.
These styles draw between the current ports and take precedence over layout
routes. `EdgePathStyleChanged` saves the style in one undo step. Pass
`pathStyle: null` in that event to restore automatic routing. Automatic uses the
layout route when available and a straight line otherwise.

Supply `renderWorldOverlay` to draw annotations and domain visuals in diagram
coordinates. Its context includes the visible nodes and edges, selection,
viewport, and measured surface. The layer shares the node transform and is
clipped to the canvas. Return `null` or `undefined` to omit it. Overlay
visibility is controlled by the host, including in minimal mode.

Use `zlozWorldOverlayItem` from `@opsydyn/foldkit-zloz/foldkit` to anchor
HTML at a world point. Decorative items pass pointer input through by
default. Set `interactive: true` for native controls that handle their
own input while ZLOZ's canvas gestures and shortcuts stay out of the way.

```ts
renderWorldOverlay: (_context, h) =>
  zlozWorldOverlayItem(h, { position: { x: 180, y: 60 } }, [], [
    h.span([], ['Review required']),
  ]),
```

With `nodeToolbar: true`, selecting one visible node or group shows **Duplicate
node** and **Delete node**. The toolbar follows the node in screen space and
keeps its size as you zoom. Supply `nodeToolbar: { placement: 'bottom', offset: 12 }`
to choose a side and a gap in CSS pixels. The default places it above the
node and switches below when the node is near the top. The canvas clips the
toolbar at its edges.

`renderNodeToolbar` receives the visible node, viewport, screen-space anchor,
and action descriptors. Compose native buttons with `zlozContextAction`, or
use your own FoldKit controls. Return `undefined` for the default contents
or `null` to suppress the toolbar for that selection. Deletion uses the same
`canDelete` policy as the keyboard and context actions. The toolbar is an
editing control, so it can appear in minimal mode when enabled.

Enable `edgeToolbar: true` to show Rename, path style, and Delete edge
controls beside a single selected edge. In the Connections list, activate an
edge and press Up Arrow to focus its actions. The toolbar uses native controls
and stays the same size as the canvas zooms. Deleting from the toolbar removes
only that edge and can be undone.

Add `edgeReconnection: true` to opt into native Source port and Target port
choosers in that toolbar. Pass the same `canReconnect`, `canConnectPort` and
`canConnect` policies used by `updateEditor` to the view. The chooser is an editing
control and remains available in minimal mode; protection explanations remain
visible even when optional diagnostics are disabled. The expanded toolbar offers
up to 320 px width and scrolls within the canvas.

Enable `connectionCreation: true` for a native source/target chooser above the
canvas. Pass the same `canConnectPort` and `canConnect` policies used by
`updateEditor`. The panel is opt-in and independent of optional diagnostics, so
it remains operable in minimal mode. `renderConnectionCreation(context, h)`
replaces its layout; return `undefined` for native defaults or `null` to omit it.

For a standalone inspector, use the pure resolver and the FoldKit panel:

```ts
import { resolveConnectionCreation } from '@opsydyn/foldkit-zloz';
import { zlozConnectionCreation } from '@opsydyn/foldkit-zloz/foldkit';

const context = resolveConnectionCreation(model.editor, policy);
const panel = zlozConnectionCreation(h, context, onEvent, { idPrefix: 'my-create' });
```

The context exposes `source`, `target` and `cancel`. Source choices check output
permissions and send `PortActivated` to stage `EditorState.connection`, without
adding history. Target choices check both ports, direction, duplicates and the
global connection policy. They send the same event through the reducer, which
rechecks the current graph/policy, allocates a fresh ID and creates one Undo step.
No second draft or preallocated edge ID is stored by the chooser. Canvas port
activation and the chooser operate on the same pending source.

Choices have stable endpoint values, labels, current/hidden flags, nullable
reasons and typed activation events. Visible alternatives are the default, with
the pending source retained even when hidden. Pass `{ scope: 'all' }` to the
resolver, or `connectionCreation: { scope: 'all' }` to the view, to include all
authored ports. Recompute contexts each view and keep policy callbacks pure.

Use `zlozConnectionCreationField`, or compose `zlozConnectionCreationSelect`
and `zlozConnectionCreationReasons` with the same `idPrefix`, for custom layouts.
`zlozConnectionCreationCancel` supplies a native cancel button. Distinct widgets
need distinct prefixes. `optionLabel` customizes native option text; richer
widgets can consume the headless entries directly. Field `reason` blocks editing;
`hint` explains an unselected source or an empty candidate set without removing
the field from keyboard navigation. Preserve required descriptions in custom UI.

Completing a connection resets both fields to their placeholders and retains
focus on the target. Native type-ahead and Tab remain available. Escape from a
chooser with an active pending source cancels it; the placeholder and Cancel
button also cancel. Cancellation adds no history. Explicit read-only, gesture
and source-port restrictions still disable the affected fields. Existing Undo
and Redo retain their usual selection behavior.

For a custom inspector, derive the choices from the core and compose the native
field from `@opsydyn/foldkit-zloz/foldkit`:

```ts
import { resolveEdgeReconnection } from '@opsydyn/foldkit-zloz';
import { zlozEdgeEndpointField } from '@opsydyn/foldkit-zloz/foldkit';

const context = resolveEdgeReconnection(model.editor, edgeId, 'target', policy);
const field = context
  ? zlozEdgeEndpointField(h, context, onEvent, { idPrefix: 'my-inspector' })
  : h.div([], ['Connection no longer exists.']);
```

`resolveEdgeReconnection` returns `null` for an absent edge. It enumerates ports
of the matching direction, excluding hidden/collapsed alternatives by default
and always retaining the current endpoint. Pass `{ scope: 'all' }` to include
hidden alternatives, including via `edgeReconnection: { scope: 'all' }` in the
view. Hidden current endpoints are labeled; missing current ports remain visible
as unavailable. The resolver does not change visibility, selection or the graph.

Each entry contains a stable `value`, endpoint, label, current/hidden flags,
nullable protection `reason`, and typed `EdgeReconnected` event. Values encode
the node/port pair rather than its index, so reordering cannot retarget a choice.
`context.reason` explains read-only, active-gesture or endpoint-lock states.
`context.emptyReason` explains when no eligible alternatives remain; the unchanged
current choice stays focusable so an accepted edit does not unexpectedly drop focus. Candidate reasons share the reducer's direction, port,
duplicate and global connection checks. The replaced edge is excluded from the
global policy's graph; only the changing port is checked for new-port permission.
The unchanged endpoint is a no-op. Policy functions must be pure, since rendering
evaluates them for multiple candidates. Recompute contexts each view; events are
proposals and the reducer rechecks current policy when committing.

Use `zlozEdgeEndpointSelect` and `zlozEdgeEndpointReasons` separately to build
your own layout, passing the same `idPrefix` to both. Distinct simultaneous fields
for the same edge end need distinct prefixes. The select supplies a stable key,
ID, accessible name and description, disabled states and native change behavior.
`optionLabel` customizes native option text; fully custom widgets can consume the
headless entries. Required protection copy is available as data and through the
reasons primitive, independently of optional diagnostic readouts. Preserve that
association in custom designs. `renderEdgeToolbar` receives optional
`context.reconnection` with both endpoint contexts and a scoped `idPrefix` when
enabled. Native Tab/selection behavior is preserved; each accepted change is one
Undo step, with edge metadata, selection and focused chooser retained.

### Searching and grouping endpoint choices

Both creation and reconnection field/select/reasons options accept `query` and
`groupByNode`. Filtering is a view projection: keep query text in the host Model
and pass the same options to the select and reasons. Flat, unfiltered lists remain
the default. Native groups use node identity, preserving separate groups for
nodes that share a label. `groupLabel` customizes group text; `optionLabel` still
customizes each option.

`resolveEndpointChoices(entries, { query })` is exported from the pure core for
custom widgets. It returns filtered `entries`, node `groups`, `matchCount` and
nullable `emptyReason`. Matching uses literal, case-insensitive substrings for
every whitespace-separated token across labels and endpoint IDs. It preserves
entry/event references and input order, and always retains current selections,
even when hidden, protected or nonmatching. `matchCount` excludes those retained
nonmatches. Group order follows the first visible entry for each node. Entries
from the built-in resolvers include optional `nodeLabel` metadata; older/custom
entries fall back to the node ID.

Compose the native query primitives from `@opsydyn/foldkit-zloz/foldkit`:

```ts
const options = { query: model.portQuery, groupByNode: true, idPrefix: 'target' };
const search = resolveEndpointChoices(context.entries, options);
const searchOptions = { idPrefix: 'target-filter', label: 'Search target ports' };
const changed = (query: string) => Message.ChangedPortQuery({ query });

const controls = [
  zlozEndpointSearchInput(h, search, changed, [], searchOptions),
  zlozEndpointSearchClear(h, changed),
  zlozEndpointSearchFeedback(h, search, [], searchOptions),
  zlozEdgeEndpointField(h, context, onEvent, options),
];
```

Use `zlozConnectionCreationField` with the same options for creation. Supply
distinct search prefixes for simultaneous widgets, pairing input and feedback
with the same prefix. Escape in the search input clears only its query and keeps
focus; Escape on a creation select retains its existing cancellation behavior.
The Clear button remains focusable after clearing. Query changes do not stage a
source, edit the graph or add Undo entries.

No-match feedback is associated with the input and select. The feedback primitive
accepts attributes so a custom layout can keep its live region available while
showing a single visible explanation through the operation's reasons primitive.
Global protection reasons remain visible regardless of filtering; matching denied
choices stay disabled, and current selections remain recognizable. Empty creation
results retain the placeholder, preventing implicit selection of another port.
Filtering cannot widen the resolver's visibility scope or authorize an edit: the
existing reducer rechecks the current graph and policies on every commit. Search
and grouping do not virtualize the list or reduce the resolver's policy workload.

### Custom edge toolbars

With `edgeToolbar: true`, supply `renderEdgeToolbar` to arrange, style, or
omit individual actions. Its context contains the selected edge, the shared
label anchor in world coordinates, and the typed actions `rename`,
`deleteEdge`, and `changePathStyle`. Use the package primitives or send the
events through the same `onEvent` mapping as the canvas.

```ts
// Import these primitives from @opsydyn/foldkit-zloz/foldkit.
renderEdgeToolbar: (context, h) =>
  h.div([h.Class('edge-actions')], [
    zlozEdgePathStyleSelect(h, context, onEvent, []),
    zlozEdgeToolbarButton(h, context.actions.deleteEdge, onEvent, [], ['Delete edge']),
  ]),
```

The positioned frame keeps the same screen-space placement as the default
toolbar and offers up to 256 px of width. Arrow Up from the selected connection
focuses the first available control in DOM order, or the group itself when
there are no eligible controls. Return `undefined` for the default layout or
`null` to hide the toolbar and its keyboard shortcut for that edge.

With `contextActions: true`, use `renderContextMenu` to replace the contents of
the node, group, or edge context panel. The context is discriminated by
`kind` and contains the selected item, surface point, and typed actions.
Group contexts include fit, aspect ratio, and dimension editing. The package
still owns panel placement, the accessible group, and input handling.

```ts
// Import the primitives from @opsydyn/foldkit-zloz/foldkit.
renderContextMenu: (context, h) =>
  h.div([h.Class('context-panel')], [
    ...(context.kind === 'edge'
      ? [zlozContextAction(h, context.rename, onEvent, [], ['Rename'])]
      : [zlozContextAction(h, context.duplicate, onEvent, [], ['Duplicate node'])]),
    zlozContextAction(h, context.close, onEvent, [], ['Close']),
  ]),
```

Use `zlozContextDimensionInput` for a native number field with the current
value, grid step, and disabled state. The group's `showMeasurements` flag
carries the effective diagnostics preference. Return `undefined` to use the
default content. On opening, ZLOZ focuses the first focusable control or the
panel itself. Escape returns focus to the canvas. Clicking or moving focus
outside dismisses the panel.

Use `renderConnections` to arrange the visible edges in a custom list. The
context provides their selected state, endpoint labels, optional context
actions, and whether the list is compact or read-only. ZLOZ owns the named
Connections group and its compact disclosure, and calls the renderer only
when the list is open. Edges hidden inside collapsed groups are filtered
before the renderer runs.

```ts
// Import these primitives from @opsydyn/foldkit-zloz/foldkit.
renderConnections: ({ entries }, h) =>
  h.ul([], entries.map((entry) =>
    h.li([h.Key(entry.edge.id)], [
      zlozConnectionButton(h, entry, onEvent, [], [entry.label]),
      ...(entry.contextAction
        ? [zlozContextTrigger(h, entry.contextAction, onEvent, [], ['⋯'])]
        : []),
    ]),
  )),
```

The selection button includes Arrow Up to the active toolbar and Shift+F10
or the Context Menu key when context actions are available. Return
`undefined` for the default list.

Use a group's **Collapse** and **Expand** buttons to change its canvas
presentation. A collapsed group hides its descendants and internal edges.
Connections that cross the boundary remain visible and attach to the compact
group. Expand the group to access its individual ports. Collapsing and
expanding also work in read-only views. They are editor-session actions and
leave saved documents and undo history intact.

Set `resizeHandles: true` on the FoldKit view to enable pointer resizing.
Card handles adjust width while height follows content. The drag range is 140
to 320 graph units, extended to include an existing width outside that range.
Escape or pointer cancellation restores the starting width. Releasing commits
one undo step. Provide a keyboard control via `NodeWidthChanged` when enabling
handles in an editable view.

Selected expanded groups show four corner handles and four midpoint side handles.
Corners adjust width and height; unlocked sides adjust only their own axis.
The opposite corner stays anchored and children keep their canvas positions. Shrinking stops at the contents
plus 24 units of padding, with a minimum of 224 × 96 (or the starting dimensions
when already tighter). Parent containment clamps
growth unless `expandParent` enables ancestor expansion. Focus the handle and use
arrow keys to adjust by 5 graph units, or Shift+Arrow by 20. With grid snapping
on, these steps are one and four grid intervals respectively. Each keyboard action
is one undo step; pointer drags commit once and Escape restores the original
bounds. Hosts can dispatch `GroupResizeNudged` with an `id` and `{ x, y }` delta.
Collapsed and read-only groups cannot be resized.

Drag from an output port to see a preview and highlight an eligible input.
You can also activate an output and then an input with Enter or Space.
The editor announces completion or cancellation in its status region.

Send `EdgeReconnected` with an edge ID, the end to replace, and the new port.
The editor checks port direction, duplicates, and the connection policy before
committing one undo step. The policy receives the proposed edge and the graph
with the previous version of that edge removed.

### Scoped themes and Pleat

Pass `theme: zlozLightTheme` or `theme: zlozDarkTheme` to a FoldKit view.
The presets cover the canvas, nodes, groups, ports, edges, and interaction
feedback. Each also sets the color scheme for native controls within that
editor. The presets and the typed token contract are exported by
`@opsydyn/foldkit-zloz/foldkit`.

```ts
import { zlozDarkTheme, type ZlozTheme } from '@opsydyn/foldkit-zloz/foldkit';

const theme: ZlozTheme = {
  ...zlozDarkTheme,
  tokens: { ...zlozDarkTheme.tokens, selection: 'var(--app-accent)' },
};
```

Explicit `theme.tokens` take precedence over class values for the same
tokens. Supply a partial token object to inherit the other variables from
the host. The editor's theme can change on any render without recreating
its state.

Set `themeClassName` on a ZLOZ view to scope a theme to that editor. Existing
CSS variables still inherit from ancestors. A host using Pleat can combine a
class from `cssClass()` with a CSS class that maps its semantic theme tokens
to the ZLOZ variables. Pleat owns the host theme and style registration.

| Part        | CSS variables                                                                                                                            |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Canvas      | `--flow-background`, `--flow-canvas-border`, `--flow-grid-line`, `--flow-grid-dot`                                                       |
| Node        | `--flow-node-background`, `--flow-node-color`, `--flow-node-border`, `--flow-node-radius`                                                |
| Ports       | `--flow-input-port`, `--flow-output-port`, `--flow-port-border`, `--flow-control-color`                                                  |
| Edges       | `--flow-edge`, `--flow-edge-width`                                                                                                       |
| Interaction | `--flow-selection`, `--flow-valid-target`, `--flow-resize-background`, `--flow-resize-readout-background`, `--flow-resize-readout-color` |

For example, given a Pleat theme that exposes the app's semantic CSS tokens:

```css
.release-flow-theme {
  --flow-background: var(--app-surface);
  --flow-node-background: var(--app-panel);
  --flow-node-color: var(--app-text);
  --flow-selection: var(--app-accent);
}
```

Pass `themeClassName: 'release-flow-theme'` in the ZLOZ view options. To apply
a Pleat style directly to the root as well, append its `cssClass(style)` result.
A per-edge `edgeAppearance` stroke or width takes precedence over the default
edge tokens, and the selection token controls the selected stroke.
See [Pleat's FoldKit and theme APIs](https://github.com/Manzanita-Research/pleat#theming).

Select an edge to expose its available endpoint handles. Drag a handle to a
compatible port to reconnect the edge. Escape or dropping elsewhere cancels.

Set `portLabels: true` on `zlozView` to show each port's `label`, falling
back to its ID. Labels use the canonical world anchors and follow node
visibility, collapse, and viewport culling. They stay visible in minimal
mode while opted in. Set `portLabels: false` to hide them.

Use `portLabels: { offset: 24, placement: 'right' }` to customize the
default gap and side. Without a placement, each label follows its port's
routing side. The offset is in world units and defaults to 18.
`renderPortLabel(context, h)` replaces a complete label. Return
`undefined` for the default or `null` to omit an individual label.
Compose `zlozPortLabel(h, context, attributes, children)` for custom badges
and per-port placement. It owns the anchored frame and passes pointer input
through. Labels render independently of custom node and group shells.
Keep them decorative. The port button retains its accessible name.

Use `renderPort(context, h)` to replace the native port presentation.
Compose `zlozPort(h, context, context.port, attributes, children)` to
keep its anchor, accessible name, keyboard activation and connection
policy. The context supplies the label, normalized anchor, active state,
accepted target state and disabled reason. Return `undefined` for the
default control or `null` to omit one control. Use `canConnectPort` to
govern whether a connection is allowed.

Custom node and group shells can append `context.ports ?? []` as direct
frame children to use the configured renderer. Existing shells that
construct their own ports continue to own their presentation. Custom port
rendering uses the normal node view path alongside the existing culling
option. The built-in node-view cache applies to standard port rendering.

Add a port with `{ type: 'PortAdded', nodeId, port }`. The host supplies
its ID, direction, label and position. Invalid ports, duplicate IDs and
unknown nodes fail before publication. Caller-owned anchors are detached.

Change display text with `{ type: 'PortLabelChanged', endpoint, label }`.
The endpoint ID, direction, position and attached connections stay unchanged.
Pass `undefined` to remove the label and restore the port-ID fallback.
Strings are preserved exactly, including empty strings. Identical labels
and missing endpoints are no-ops; invalid labels fail graph validation.
Each accepted change is one Undo transaction and respects read-only and
active-gesture guards. Hosts own any draft UI and decide when to commit.

Remove a port with `{ type: 'PortRemoved', endpoint }`. Its attached
connections are removed in the same transaction. `canDelete` evaluates
the complete attached-edge set and can veto the whole operation.
`resolvePortRemoval(graph, endpoint, canDelete)` provides the same
decision for host controls. Removing a missing port is a no-op.

Each accepted operation creates one Undo entry, invalidates stale layout
routes, and respects read-only and active-gesture guards. Port removal
does not call deletion policy when there are no attached edges. Existing
graph documents and snapshots already support the resulting port data.

Use `EditorPolicy.canEditPort` to protect direct port edits individually:

```ts
import type { EditorPolicy } from '@opsydyn/foldkit-zloz';

const policy: EditorPolicy = {
  canEditPort: ({ operation, node, port }) =>
    node.id === 'review' && port.id === 'in' && operation !== 'add'
      ? 'Review input is managed upstream.'
      : null,
};
```

`PortEditCandidate` contains `operation` (`add`, `label`, `position`, or
`remove`), the current node, and the current port. Addition supplies the
proposed port instead. This is a capability check, independent of proposed
label text or coordinates. The reducer evaluates it against the current
full graph before publishing. A veto preserves graph, routes, revision,
selection and history, and reports the reason in `notice`. One protected
port vetoes an entire position batch; unchanged labels and positions are
no-ops and skip policy checks.

`portEditReason(candidate, graph, policy.canEditPort)` resolves the same
trimmed reason for host controls; blank rejections use a default message.
For removal controls pass both policies:
`resolvePortRemoval(graph, endpoint, policy.canDelete, policy.canEditPort)`.
Port edit protection is checked first, including unused ports, followed
by attached-edge deletion protection. Wire creation/reconnection continue
to use the connection policies. Whole-node deletion, graph replacement,
and Undo/Redo retain their existing policies and history semantics.

The optional `/foldkit` entry point also exports composable port inspector
primitives. `portInspectorContext(editor, nodeId, policy, options)` returns
an Effect `Option` containing the node and its current entries, or `None`
for a missing node or group. Each entry includes `labelControl`,
`positionControl` and `removeControl`. Null `reason` enables a control;
non-null reasons include policy, read-only and active-gesture protection.
Render `entry.reasons` once: identical reasons share an ID across controls.
`ZlozPortInspectorOptions` accepts `idPrefix`, `readOnlyReason`, and
`busyReason`; give simultaneous inspectors distinct prefixes.

Hosts own their draft Model and messages. This standalone helper composes
a label form without prescribing a layout or CSS:

```ts
import type { HtmlBuilder } from 'foldkit/html';
import {
  zlozPortLabelForm,
  zlozPortLabelInput,
  zlozPortLabelSave,
  zlozPortLabelCancel,
  zlozPortProtectionReason,
  type ZlozPortInspectorEntry,
  type ZlozPortLabelFormMessages,
} from '@opsydyn/foldkit-zloz/foldkit';

export function portLabelEditor<M>(
  h: HtmlBuilder<M>,
  entry: ZlozPortInspectorEntry,
  draft: string,
  messages: ZlozPortLabelFormMessages<M>,
  changed: (text: string) => M,
) {
  return zlozPortLabelForm(
    h,
    messages,
    [],
    [
      zlozPortLabelInput(h, entry, draft, changed, []),
      zlozPortLabelSave(h, entry, [], ['Save']),
      zlozPortLabelCancel(h, messages.cancelled, [], ['Cancel']),
      ...(entry.labelControl.reason !== null
        ? [zlozPortProtectionReason(h, entry.labelControl, [])]
        : []),
    ],
  );
}
```

`zlozPortLabelEditButton` opens the host draft. Enter submits the form,
Escape cancels, and Cancel remains available when editing is protected.
The host's saved message commits `PortLabelChanged` with the current
policy; these view contexts are preflight information, not authorization
tokens. Recompute them on each view. The primitives own native types,
bindings, disabled state and description links. Attributes can customize
names, autofocus and styling; children can supply badges or other content.

`zlozPortRemoveButton` emits the entry's atomic `PortRemoved` event.
`portAdditionContext(editor, nodeId, proposedPort, policy, options)`
preflights a host-supplied proposal. `zlozPortAddButton` takes that context
and a host message so identity allocation can occur against the latest
Model in update, including rapid repeated clicks. All primitives are
unstyled and may be arranged or omitted independently. Position controls
can use the resolved `positionControl` and existing `PortPositionsChanged`.

Compose per-port position editing with `portPositionDraft(port)`,
`updatePortPositionDraft(draft, change)`, and `portPositionEditorContext`.
`ZlozPortPositionDraft` keeps unvalidated text in either `offset` or
`anchor` mode, so empty fields never become document coordinates.
`portPositionFromDraft` returns an Effect `Option<PortPosition>`: all
active numbers must be finite fractions from 0 to 1. Save commits that
complete position through `PortPositionsChanged` with the current policy,
giving side and coordinate changes one Undo entry. Hosts own draft
lifecycle and decide when to discard drafts after document changes.

Use `zlozPortPositionEditButton` to open a draft. Inside
`zlozPortPositionForm`, compose `zlozPortPositionModeSelect`,
`zlozPortPositionSideSelect`, `zlozPortPositionInput` for each item in
`context.inputs`, `zlozPortPositionSave`, and `zlozPortPositionCancel`.
The controls use `entry.positionControl`, native required/min/max
validation, Enter to save and Escape to cancel. They retain disabled
states and reason links while Cancel remains available. Attributes and
children control presentation; both selects also accept an optional
final record of custom option labels.

```ts
const context = portPositionEditorContext(entry, draft);
const fields = context.inputs.map((input) => zlozPortPositionInput(h, context, input, changed, []));
// Render fields in a host-owned layout inside zlozPortPositionForm.
```

Edge offset mode uses the side and an along-edge fraction. Box coordinates
use normalized X/Y from the node frame's top-left; side remains a routing
direction hint. Switching to box coordinates starts at the same cardinal
anchor. Switching back projects onto the chosen side using Y for left/right
and X for top/bottom. It intentionally returns the anchor to that edge.

Opt in to direct positioning with `zlozView`'s `portAnchorHandles: true`.
Selected visible nodes get separate anchor handles. Socket wiring keeps
its normal controls and connection policy. Pass `canEditPort` to both
the view and reducer so handles reflect the current position permission.
Read-only handles are disabled and protected handles carry their reason
as a native description. The selected-node inspector can render the same
reason visibly through its existing context.

Drag previews use normalized node-frame coordinates, clamp to 0–1, and
preserve the port's routing side. Pointer capture keeps tracking outside
the canvas. Release records one Undo entry; no-movement and out-and-back
drags preserve the original representation without history. Escape,
pointer cancellation, lost capture, or a policy/read-only veto restore
the starting document. Policy is checked at start, during movement and
again at release. Preview revisions invalidate stale routes; cancellation
does not consume redo history. Arrow keys nudge by 1%, or 10% with Shift,
using the same policy and normal Undo transactions.

`PortAnchorDragStarted`, `PointerMoved`, `PointerReleased` and
`GestureCancelled` are the headless gesture contract. `PortAnchorNudged`
accepts a normalized frame delta for keyboard or host controls.

Customize the native handle through `renderPortAnchorHandle` and
`zlozPortAnchorHandle`; null omits a handle and undefined uses the default.
`ZlozPortAnchorHandleContext` includes the node, port, normalized anchor,
world position, active state and rejection reason. The primitive belongs
in the world layer, so it works independently of custom node shells and
socket renderers. Attributes and children control its shape, size, copy
and contents. `portAnchorHandles: { offset: { x: 24, y: 0 } }` changes
the world-unit displacement from the socket; the default follows its
routing side and stays fixed throughout the drag. This bounded anchor gesture does not auto-pan
or change the side hint; the position editor handles side changes.

Opt in to edge attraction through the core editor:

```ts
const editor = createEditor(graph, { portAnchorSnapDistance: 12 });
```

The distance is in CSS pixels. Its default is zero, preserving free
placement. `PortAnchorSnapDistanceChanged` changes it while idle without
editing the document or history; invalid distances are ignored. Initial
options require a finite non-negative value. During an anchor drag, the
nearest frame edge within that radius attracts the position. Distances
account for node dimensions and viewport zoom. Exact ties prefer the
port's routing side, then left/right/top/bottom order. Only position is
snapped; the routing-side hint remains unchanged.

`resolvePortAnchorSnap(candidate, { size, zoom, distance, preferredSide })`
exposes the same pure calculation for headless consumers. It clamps raw
normalized candidates to the frame, returns `{ anchor, side }`, and uses
null side when attraction is disabled or no edge is close enough.
`PortAnchorSnapOptions` and `PortAnchorSnapResult` describe that contract.
Clicking without movement and out-and-back drags retain the starting
representation. Moving away from an edge releases its attraction. Policy
vetoes, cancellation and Undo retain the anchor drag's atomic behavior.

Active `ZlozPortAnchorHandleContext.snappedSide` identifies the attracted
edge. The default handle highlights it and updates its native description;
custom renderers can use the same context for their own feedback. This
session preference is independent of connection snapping and node-grid
snapping. Keyboard nudges and explicit numeric position edits remain exact
even when pointer attraction is enabled. The resolver attracts one edge at a time.

Set `portAnchorSnapHysteresis` in `EditorOptions` to stabilize an acquired
edge. The default is zero. A positive CSS-pixel margin extends its release
radius to `portAnchorSnapDistance + portAnchorSnapHysteresis`. A competing
edge must be inside the normal acquisition radius and closer by more than
the margin to take over. At the exact margin the current edge stays held.
Once released, an edge must enter the normal radius to acquire again.
Setting the edge snap distance to zero disables edge attraction.

`PortAnchorSnapHysteresisChanged` changes the margin while idle without
editing graph data or history. Initial options and the pure resolver
require finite non-negative values; invalid change events are ignored.
The pure resolver's optional `hysteresis` and `previousSide` fields support
the same behavior for headless consumers. Feed the previous result's side
back during a gesture; `preferredSide` remains only a routing-hint tie
breaker. The reducer carries retention in its existing gesture state.
Policy vetoes, cancellation, no-motion behavior, keyboard/numeric precision
and one-step Undo keep their existing semantics.

Set `zlozView`'s `portAnchorSnapBypassModifier: 'Alt'` to enable temporary
free positioning during an anchor drag. The default has no mapping.
`ZlozPortAnchorSnapBypassModifier` also accepts `Control`, `Meta` and
`Shift`, so hosts can choose their shortcut. The native resource captures
that mapping at pointer-down; changes apply to the next gesture.

Holding the mapped key bypasses edge/corner/midpoint attraction and hysteresis while
retaining frame clamping and edit policies. Pressing or releasing it
recomputes the last raw pointer sample in the Model, even without mouse
movement. Releasing performs fresh acquisition; it clears the old retained
edge. Releasing the pointer while holding the key commits the free position
as the drag's single Undo entry. Snap preferences stay intact. Blur,
Escape, capture loss and policy vetoes retain normal cancellation.

Headless consumers can supply `snapBypassed` on `PortAnchorDragStarted`,
`portAnchorSnapBypassed` on `PointerMoved`, or
`PortAnchorSnapBypassChanged` with the active pointer and `bypassed` value.
The gesture retains its raw `point` for key-only updates. These facts apply
only to the matching anchor gesture. A start fact can include the captured
`snapBypassModifier` for renderer hints. Handle contexts expose `snapBypassed`
and `snapBypassModifier` for custom feedback; the default uses a dashed
border and native description. Other gestures and idle keyboard nudges
retain their existing modifier behavior.

Set `portAnchorCornerSnapDistance: 12` in `EditorOptions` for corner
attraction within a circular 12 CSS-pixel radius. It defaults to zero,
independently of `portAnchorSnapDistance`, so corners can be enabled alone.
The candidate is clamped to the node frame first. With the default priority, a corner in range takes
priority over midpoint and edge attraction; outside the corner range, other
enabled modes or free placement apply. The radius stays constant at any zoom.

`PortAnchorCornerSnapDistanceChanged` changes the radius while idle without
adding document history. Values must be finite and non-negative; invalid
change events are ignored. Positive `portAnchorSnapHysteresis` also retains
an acquired corner within radius plus margin. A competing corner must be
in the acquisition radius and closer by more than the margin. Exact ties
keep the retained corner; without retention the stable order is top-left,
top-right, bottom-left, bottom-right. Corner acquisition takes priority over
retained edges, and a released corner can fall back to ordinary edge acquisition.

The pure `resolvePortAnchorSnap` accepts `cornerDistance` and
`previousCorner`. Feed its optional `corner` result back during a gesture;
`side` is null during a corner snap. `PortCorner` names the four corners.
`ZlozPortAnchorHandleContext.snappedCorner` exposes that feedback for custom
renderers. `zlozPortAnchorHandle` supplies a corner description and
`data-flow-anchor-corner`; the default handle adds a diamond and selection
border. Returning `undefined` uses the default, and `null` omits the handle.
Bypass clears all anchor snap retention and resumes fresh acquisition
on key release. The authored routing side and port identity stay intact;
previews, cancellation, current edit protection and one-step Undo/Redo
share the existing anchor-drag transaction. Keyboard nudges and numeric
edits stay exact. These are session preferences, not serialized graph fields.

Set `portAnchorMidpointSnapDistance: 12` in `EditorOptions` to attract
port anchors to exact edge centers: left `(0, 0.5)`, right `(1, 0.5)`,
top `(0.5, 0)` and bottom `(0.5, 1)`. The circular CSS-pixel radius defaults
to zero and works independently of corner and edge attraction. The
candidate is clamped before measuring distance, and zoom does not change
the radius. By default, corners take priority over midpoints; midpoints take priority
over edges, including retained edges. Outside a retained midpoint's band,
normal acquisition in the remaining enabled modes applies.

`PortAnchorMidpointSnapDistanceChanged` changes the radius only while idle
without changing graph/history. Initial/resolver values must be finite
and non-negative; invalid change events are ignored. The shared
`portAnchorSnapHysteresis` extends a midpoint's radial release band and
requires a competing midpoint to win by more than the margin. The routing
side breaks acquisition ties, followed by left, right, top, bottom.
With corners-first priority, an eligible corner also takes priority over a retained midpoint.

Headless consumers pass `midpointDistance` and `previousMidpoint` to
`resolvePortAnchorSnap`. Its optional `midpoint` result is a `PortSide`;
`side` is null during midpoint attraction. Feed the result back for
retention. `ZlozPortAnchorHandleContext.snappedMidpoint` supports custom
badges via `zlozPortAnchorHandle`; the helper supplies a midpoint
description and `data-flow-anchor-midpoint`. The default handle shows a
center marker. Bypass clears midpoint retention too, including stationary
key transitions, and resumes fresh acquisition. Precise release, policy
rollback, cancellation and single-step Undo/Redo retain the same drag
transaction. Authored routing direction, keyboard nudges, explicit position
edits and graph serialization retain their existing semantics.

Use `EditorPolicy.portAnchorSnap` to override snapping for individual ports:

```ts
const policy: EditorPolicy = {
  portAnchorSnap: ({ node, port }, graph) => {
    if (node.id === 'review' && port.id === 'in')
      return { distance: 0, cornerDistance: 0, midpointDistance: 18, hysteresis: 6 };
    if (port.id === 'precise') return { distance: 0, cornerDistance: 0, midpointDistance: 0 };
    return undefined;
  },
};
const next = updateEditor(state, event, policy);
```

The callback receives the current node, port and full graph at an allowed
anchor drag's start. `PortAnchorSnapOverrides` accepts `distance` (edges),
`cornerDistance`, `midpointDistance` and `hysteresis`, in CSS pixels. Missing
or undefined fields inherit editor settings; zero explicitly disables that
rule. Returning `undefined` inherits every setting. Overrides can enable
attraction even when editor defaults are zero. The optional `priority` field
can change point-kind ordering; edges remain the final fallback. The pure `resolvePortAnchorSnapSettings(defaults, overrides)`
helper returns a detached `PortAnchorSnapSettings` record, filling absent
defaults with zero and validating finite non-negative effective values.
Invalid settings throw `ZlozError` before any gesture, graph or history change.

Effective settings are captured in `gesture.snapSettings`, including
inherited values. Mutating a returned override or changing the host policy
affects the next drag. The callback is not re-evaluated during previews,
bypass transitions or rendering. Custom handle contexts expose a detached
`snapSettings` record while that port is actively dragged; it is absent
while idle. This supports custom rule feedback without repeating the policy.
The view reads the Model; no additional `zlozView` configuration is needed.

Supply the current policy to `updateEditor` as usual: `canEditPort` remains
authoritative at start, preview and release. Snap overrides cannot bypass
protection, clamping, cancellation or the single Undo/Redo transaction.
Modifier bypass temporarily disables all attraction while preserving the
captured preferences. Keyboard/numeric edits stay exact. Policies and
captured preferences are runtime/editor state, not serialized graph fields.

`PortAnchorSnapTargets` adds optional `allowedEdges`, `allowedCorners` and
`allowedMidpoints` lists to overrides, effective settings and the pure snap
resolver's options. For left/right midpoints only, a policy can return:

```ts
{ distance: 12, cornerDistance: 12, midpointDistance: 18,
  allowedEdges: [], allowedCorners: [], allowedMidpoints: ['left', 'right'] }
```

Missing/undefined lists allow all targets of that kind. Empty lists disable
the kind even with a positive radius. The settings helper inherits lists
from its defaults when supplied, and an explicit list replaces the default
list. Supply all four names to restore all targets. Edges/midpoints accept
`PortSide` names; corners accept `PortCorner` names. Invalid names or non-array
values throw `ZlozError` before starting a gesture, including when a radius
is zero. Duplicate names are normalized into canonical order. Array order
does not change established tie-breaking or corner/midpoint/edge priority.

Only allowed candidates participate in nearest-target selection and
hysteresis; a forbidden previous target cannot remain held. Bypass still
disables all attraction. These lists govern attraction: free placement,
frame clamping, keyboard nudges and numeric edits retain their behavior.
They do not constrain the authored port position or routing direction.

The settings helper and drag start detach every target list. Host list
changes affect the next drag. Active handle `snapSettings` also receives
detached lists for custom feedback, without evaluating the policy again.
Serialization, edit protection, cancellation and the single Undo/Redo
transaction keep the same contract.

Set `EditorOptions.portAnchorSnapPriority: 'midpoints-first'` to prefer a
midpoint when its zone overlaps a corner's. `PortAnchorSnapPriority` also
accepts `'corners-first'`, the existing default. Priority changes only the
order of these two target kinds; edges remain the final fallback. A
preferred kind must still have a permitted, enabled target within its
acquisition or retention band. Otherwise the other point kind is tried,
then edges, then free placement.

`PortAnchorSnapPriorityChanged` updates the editor preference while idle,
without graph/history changes. Invalid preference events are ignored.
The pure resolver accepts `priority`, as do `PortAnchorSnapOverrides`
and captured `PortAnchorSnapSettings`. A per-port override wins over the
editor preference; an omitted/undefined override inherits it. Omitted
priority remains implicitly corners-first for existing settings records.
Invalid initial, helper or resolver values throw `ZlozError`.

Priority is captured at drag start with the other settings, including
through bypass and stationary modifier changes. A target in the preferred
kind wins over a retained target in the lower kind. Hysteresis and routing
tie-breaks within each kind retain their existing rules. Bypass clears
retention and restores fresh acquisition in the captured order. Current
permission checks, cancellation, exact edits and one-step Undo/Redo are
unchanged. Guide enumeration retains canonical target order and includes
all permitted kinds; active feedback reflects the resolved winner and
custom renderers receive the captured priority. This preference is not a
serialized graph field.

Set `zlozView`'s `portAnchorGuides: true` to show permitted targets during
an anchor drag. Guides are off by default and include only target kinds
with positive acquisition radii and permitted names in the captured rules.
The default uses edge lines and point markers, highlighting the attracted
target. Markers and strokes retain their screen size at zoom. No radii or
measurements are printed.

Guides follow the existing `alignmentGuides` diagnostic flag. Minimal mode,
`diagnostics: false`, or `diagnostics: { alignmentGuides: false }` hides
them before custom rendering. They also disappear during bypass, after
release/cancellation, for read-only or protected ports, and when the node
is not in the visible canvas. Editing and snapping do not depend on guides.
The overlay is decorative, aria-hidden, inert and pointer-transparent.

`renderPortAnchorGuide(context, h)` replaces one guide with SVG in world
coordinates. Returning `undefined` uses the native guide; `null` omits it.
`ZlozPortAnchorGuideContext` includes the node/port, normalized `target`,
resolved world `start`/`end` (equal for points), `active`, `viewport` and
detached captured `settings`. Compose `zlozPortAnchorGuide(h, context,
attributes)` to customize paint while keeping native geometry, or supply
your own SVG using those coordinates. The package owns the inert overlay
and target identity wrappers. The renderer does not run the policy callback.

Headless consumers can use `portAnchorSnapGuideTargets(settings)` to enumerate
normalized `PortAnchorSnapGuide` values for their own presentation. The
helper validates settings and shares canonical corner/midpoint geometry
with the snap resolver. It reports permitted targets regardless of cursor
distance, without changing graph data, gestures or history.

Set `zlozView`'s `portAnchorKeyboardTargets: true` to enable plain Page Down
(next), Page Up (previous), Home (first), and End (last) on focused port
anchor handles. It defaults to off. Native handles expose shortcut metadata
and help; custom handle contexts receive `keyboardTargets`. Text fields,
disabled/read-only controls, modified keys and active pointer captures keep
their existing behavior. Held-key repeats are consumed without producing
repeated edits. Tab keeps its normal focus order. Arrows still nudge exactly
1%, or 10% with Shift, independently of target cycling.

`PortAnchorTargetStepped` is the headless editor fact, with an `endpoint`
and `step: 'next' | 'previous' | 'first' | 'last'`. Each idle action resolves
the current per-port settings and checks edit permission before selecting
from enabled, permitted corner and midpoint targets. Edges are continuous
and do not participate. Radii enable target kinds; keyboard selection can
reach a permitted point from any current position. Priority orders the
two point kinds, with canonical order within each: top-left, top-right,
bottom-left, bottom-right for corners; left, right, top, bottom for midpoints.

Next/previous wrap at the ends. From a position outside the target set,
next chooses the first and previous chooses the last. Home/End choose those
endpoints directly. Every different position is one Undo/Redo transaction,
preserving routing direction, port identity and wiring. Already-at-target
actions preserve the existing position representation and history. Empty
sets leave the document alone and report a named no-target notice. Protected
ports report their current reason; active gestures and read-only editors
ignore the action. The standard status region announces the selected target
even when diagnostic presentation is visually hidden. Keyboard actions are
atomic and do not create a pointer gesture or keep pointer guides open.

`resolvePortAnchorTargetStep(anchor, settings, step)` supports custom
controls. It returns `PortAnchorTargetStepResult`: either `{ type: 'empty' }`
or a detached `PortAnchorPointTarget`, zero-based `index`, and `count`.
The helper validates settings/actions without changing editor state. Hosts
can use the typed fact for their own buttons or bindings with the native
mapping off. Target names, list normalization and priority reuse the same
package rules as pointer snapping and guides.

Set `connectionDropRadius: 32` on the view to snap new connections within
32 CSS pixels of a rendered port center. The default is zero.
Set `reconnectionDropRadius` to give existing edge reconnections their
own radius. It inherits `connectionDropRadius` when omitted. Use `0`
to require an exact port hit. Both values must be finite and non-negative.
The preview and release use the first eligible nearby port in distance order.
An exact port hit takes priority and can show its normal rejection reason.
The distance stays constant in screen space as the canvas zooms.

Pass `connectionSnapHysteresis: 12` to `createEditor` to steady nearby
target selection for both new wires and reconnections. Use it with a
positive drop radius. The current eligible target stays selected until
another eligible port is closer by more than 12 CSS pixels. Leaving the
drop radius releases it immediately, and exact port hits take priority.
The margin defaults to zero and must be finite and non-negative.
Send `ConnectionSnapHysteresisChanged` with a `distance` while idle to
change it. This preference stays outside graph undo and saved documents.

Custom input adapters can include a finite, non-negative `distance` on
each `nearbyTargets` endpoint. Keep the array sorted by distance.
Endpoint-only messages retain their nearest-eligible behavior.

Pass `canConnectPort(endpoint, graph)` to both `updateEditor` and `zlozView`
to lock individual ports. Return a reason to block the port or `null` to allow
it. Locked outputs cannot start new wires, and locked inputs reject drops.
Existing edges stay visible. Reconnecting an edge checks the destination port
for the end being moved. Use `canReconnect` to lock the edge end itself and
`canConnect` for rules that depend on the proposed pair.

The view disables locked port buttons, including custom shells that use
`zlozPort`. Use `data-flow-port-locked` to style them. The reducer checks the
policy again before committing pointer, keyboard, and direct connection edits.

Pass the same `canReconnect` callback to `updateEditor` and `zlozView` to
lock specific edge ends. The callback receives the existing edge, the end
(`'source'` or `'target'`), and the full graph. Return a reason to lock the
end or `null` to allow an attempt. Locked handles are omitted. The reducer
checks again during a drag and before committing, including for direct
`EdgeReconnected` events from an inspector. Allowed targets still go
through port validation and `canConnect`.

```ts
const canReconnect: EditorPolicy['canReconnect'] = (edge, end) =>
  edge.id === 'approval' && end === 'source' ? 'Approval source is locked.' : null;
```

Hosts can offer the same edit through keyboard controls using `EdgeReconnected`.

A node with `kind: 'group'` draws a boundary. Set a node's `parentId` to a
group ID to make it a member. Groups can contain other groups. Positions
remain in canvas coordinates, including inside a group. Dragging or nudging a
group moves its descendants once, even when some are also selected. Deleting
a group deletes its descendants and their connections in one undo step.

Drag a node or group title into an expanded boundary to change its parent.
The deepest eligible group under the pointer highlights as the drop target.
Drop outside all eligible boundaries to move the selection to the canvas root.
Only the roots of the dragged selection change parent, so nested contents stay
together. Position and membership share one undo step. Escape cancels the drag.

Group membership is explicit. Layout engines can return an optional size on a
group position to fit the boundary to its children. The ELK adapter arranges
both flat and nested graphs.

`SelectionGrouped` wraps selected siblings in a new boundary sized to their
contents. `SelectionUngrouped` removes selected boundaries and promotes their
contents to the nearest remaining parent. Both preserve canvas positions and
connections and commit one undo step.

Shift-drag the canvas background to draw a selection box. Releasing selects
fully enclosed nodes and replaces the previous selection. If the box encloses
a group and its children, the group represents them in the selection. Escape
cancels without changing the prior selection. Box selection leaves the graph
and undo history intact.

Set `minimap: true` to show the diagram overview after the canvas is measured.
The rectangle shows the current viewport. Click the overview to center the
canvas on that point at the current zoom. This changes only the viewport.

Set `viewportControls: true` to show **Zoom in**, **Zoom out**, and **Fit view**
above the canvas. Zoom is centered on the visible canvas. The controls are
available in read-only views and work with standard button keyboard input.

Enable `snapToGrid` in editor options or send `GridSnapToggled` to toggle
a canvas grid (`gridSpacing`, default 20 units). While dragging, the grabbed node snaps to the grid and
the rest of the selection follows by the same offset, including group contents.
Group resize handles and width edits snap the moving boundary in canvas units,
including top/left boundaries and side handles. Size limits, content and parent
constraints, and locked proportions take precedence when a grid intersection
cannot satisfy them. Resizing preserves fixed children and its opposite anchor.
The setting is session state and each completed drag is one undo step.
Background appearance is configured separately and follows pan and zoom.

Copy, Paste, and Duplicate work from canvas focus with Ctrl/Cmd+C, V, and D.
Enable `snapToAlignment` or send `AlignmentSnapToggled` to align the dragged
selection's edges and centers with nearby visible nodes. Guides appear within
six screen pixels of a match at any zoom. Alignment takes priority on a matched
axis; grid snapping still applies on the other axis. Guides disappear on
release or cancellation. Set `--flow-alignment-guide` to theme their color.

Set `autoPan: true` on the FoldKit view to pan near the canvas boundary
during node moves, connection drags, and reconnections. The drag remains
anchored to the pointer as the viewport moves. Release or Escape stops the
pan. Viewport travel stays separate from graph undo.

Set `wheelNavigation` to choose how the canvas handles wheel and trackpad
scrolling:

| Mode     | Behavior                                                                  |
| -------- | ------------------------------------------------------------------------- |
| `'zoom'` | The default. Vertical wheel motion zooms around the cursor.               |
| `'pan'`  | Scroll pans in both axes. Hold Ctrl or Command to zoom around the cursor. |
| `'off'`  | Wheel events keep their native page or browser behavior.                  |

The option applies only to wheel input on the canvas. Editable controls
keep their own wheel behavior. ZLOZ updates its default help text to match
the option. Custom help receives the same `wheelNavigation` value.

Set `doubleClickZoom: true` to zoom in 1.25× around the pointer when
double-clicking the background. You can supply a finite multiplier
greater than 1 for a different step. The feature defaults to off and
works independently of wheel and pinch zoom. Box select, Zoom to area,
and interactive canvas items keep their own input behavior. Background
clicks still clear selection during normal navigation.

Set `spaceToPan: true` to pan temporarily with Space. Focus the canvas,
hold Space, then drag from the background. The drag preserves selection
and leaves Box select or Zoom to area available for the next drag.
Releasing Space during a drag lets it finish. Escape cancels the drag,
and focus loss clears the shortcut. Space continues to activate buttons
and enter text when those controls have focus. The feature defaults to off.

Set `middleButtonPan: true` to pan by middle-dragging the canvas background.
The gesture preserves selection and leaves Box select or Zoom to area
ready for a primary-button drag. Links and controls keep their native
middle-click behavior. This option defaults to off and is independent of
Space-drag and wheel navigation.

Pass `zoomLimits: { minZoom: 0.75, maxZoom: 1.3 }` and
`fitViewPadding: 96` to `createEditor` to customize the camera. Wheel,
pinch, double-click, toolbar, and Fit view share the inclusive range. Both limits must
be finite and positive, and equal limits fix the zoom. An explicit
`viewport` must be in range. Without one, ZLOZ starts at the allowed zoom
closest to 1.

Fit view uses CSS pixels for padding and caps the inset at a quarter of the
shorter canvas side. The defaults are 0.1–4× and 24 px. Dispatch
`ViewportConstraintsChanged` while idle to change both settings. If the
current zoom falls outside the new range, ZLOZ clamps around the canvas
center and stops any running fit. For host-controlled camera operations,
`zoomAt` and `fitViewport` take the same `ZoomLimits` as an optional fourth
argument.

Pass `fitViewDuration: 400` to `createEditor` to animate Fit view over
400 milliseconds. The default is zero for instant fitting. The FoldKit
view fits immediately when the browser prefers reduced motion. Panning,
zooming, or starting a canvas gesture takes over from the current camera
position. Dispatch `FitViewDurationChanged` to update the preference at
runtime. Camera movement stays outside graph history.

Set `pinchZoom: true` on the FoldKit view for two-finger touch navigation.
Move both fingers together to pan or change their distance to zoom around
the midpoint. A second touch cancels an active graph drag. Lifting a finger
ends navigation without starting another edit. Pinch and pan stay outside
graph undo and are available in read-only views.

Set `viewportControls: true` and `selectionModeControl: true` to show the
**Box select** toggle. While it is active, dragging the background draws a
selection box with touch or a mouse. Toggle it off to resume background pan.
Two-finger navigation and Shift-drag still work. The mode is editor session
state and can also be set initially with `selectionMode` or toggled by sending
`SelectionModeToggled`.

The editor's clipboard lives in session state. Copy includes selected groups,
their descendants, and connections with both endpoints in the selection.
Pasted nodes get new IDs, retain their internal hierarchy, and are offset
from the originals. If a copied node's parent was outside the selection,
its copy becomes a top-level node. Paste and Duplicate are single undo steps.

Set `contextActions: true` on the FoldKit view to open actions with a
right-click on a node or edge. Use Shift+F10 or the context menu key on a
focused node title or connection. Nodes offer Duplicate and Delete, and edges
offer Delete. Escape dismisses the panel.

The same option adds More actions buttons on nodes and beside entries in
the Connections list for touch and keyboard access.

Set a child's `extent: 'parent'` to constrain pointer drags and keyboard nudges
to its parent's authored bounds. The child keeps its parent on drag-out.
A selection moves by one common clamped offset. Moving the parent still moves
its descendants. Nodes larger than the parent are held on the oversized axis.
Sizing and content measurement are independent of this movement constraint.
The optional field is preserved by graph export and import.

Set a child's `expandParent: true` to grow its parent when an authored width
change or measured content height exceeds the group bounds. Growth adds
16 units of padding on overflowing sides and preserves canvas positions.
Enable expansion on an inner group to propagate growth to its own parent.
Pointer resizing and parent growth share one undo step. Smaller content
keeps the group's grown bounds.

Send `GroupFitClicked` with a group ID to fit its authored boundary to all
descendants. The group context panel exposes **Fit group to contents**.
Fitting preserves child positions, reserves header space and padding, and
commits one undo step. Empty groups keep their bounds. A constrained group
requires enough space in its parent or enabled parent expansion.

### Per-node resize limits

Set optional `resizeLimits` on a node to customize manual resizing in graph units:

```ts
resizeLimits: { minWidth: 180, maxWidth: 520, minHeight: 120, maxHeight: 400 }
```

Each supplied limit must be finite and positive; a minimum cannot exceed its
maximum. Partial limits are supported and survive save/load, clipboard and Undo.
Cards apply width limits to pointer handles and `NodeWidthChanged`; card height
continues to follow content. Groups apply both axes through pointer handles,
`GroupResizeNudged` and width edits. When proportions are unlocked, only edited axes change. Group contents and
parent containment can prevent a resize when there is no valid size. Existing
nodes may start outside their limits; their next manual edit clamps the edited
axis. Layout, Fit group to contents, measurements and ancestor expansion remain
independent of manual resize limits. Omitting the field preserves default ranges.

### Lock group proportions

Set `keepAspectRatio: true` on a group, or dispatch `GroupAspectRatioToggled` with
its `id`. The package context panel offers **Lock proportions**; the sample also
shows it beside Fit group to contents. The toggle is saved, copied and undoable.
Cards cannot declare this field because their height follows content.

Manual pointer, keyboard and width edits then scale both dimensions together
from the group's current proportions, keeping children fixed. Corner handles anchor
the opposite corner; side handles anchor the opposite edge and preserve the
perpendicular center. Corner resizing follows the larger proportional axis change. The
scale is bounded by both dimensions' resize limits, contents and parent extent;
conflicting bounds leave the graph unchanged. Escape cancels a pointer drag,
and releasing commits once. Repeated edits at a bound do not add Undo entries.
Layout and explicit fitting can establish new proportions for the next resize.

Pointer `NodeResizeStarted` and keyboard `GroupResizeNudged` accept an optional
`handle`: `'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'top' | 'right' | 'bottom' | 'left'`.
The existing `corner` field remains supported; `handle` takes precedence when both
are supplied. Omitting both preserves bottom-right behavior. `delta` follows the moving handle's canvas
direction: moving a left handle right shrinks width; moving a top handle down
shrinks height. Pointer positions remain surface CSS pixels, with zoom handled
by the reducer. Top handles reserve 48 units above contents for the group header;
other moving boundaries reserve 24. Existing tighter bounds are preserved.

Side handles ignore perpendicular pointer movement and keyboard arrows. With
proportions locked, the dragged axis drives both dimensions and the perpendicular
center stays fixed. Limits, content padding and parent bounds apply to the full
result, including the centered dimension. A conflicting intersection is a no-op.

### Background grids

`zlozView` defaults to dots even when snapping is off. Built-in backgrounds accept
positive finite `gap` (graph units) and `size` (dot radius or square line width),
plus a CSS `color`. An omitted gap follows `editor.gridSpacing` (default 20);
size defaults to 1. An explicit visual gap overrides spacing only for that backdrop. Use `{ type: 'none' }` for a plain canvas.

```ts
zlozView(h, model.editor, {
  id: 'workflow',
  label: 'Workflow',
  onEvent: (message) => Message.ObservedZlozInput({ message }),
  background: { type: 'squares', gap: 20, size: 1, color: 'var(--grid-color)' },
});
```

For a custom layout, use `{ type: 'custom', render }`. The callback receives
`{ id, viewport, surface, spacing }` and the host's typed `HtmlBuilder`. `surface`
can be `null` before measurement. Return ordinary FoldKit HTML/SVG; keep it
decorative. ZLOZ places it behind the graph in a non-interactive, aria-hidden
screen-space layer. Apply the supplied viewport when drawing canvas-space grids.
No browser mutation, effects, or second UI runtime is needed.

```ts
background: {
  type: 'custom',
  render: ({ viewport, spacing }, builder) => builder.div([
    builder.Style({
      position: 'absolute', inset: '0',
      'background-image': 'radial-gradient(circle, #64748b 1px, transparent 1px)',
      'background-size': `${spacing * viewport.zoom}px ${spacing * viewport.zoom}px`,
      'background-position': `${viewport.x - spacing * viewport.zoom / 2}px ${viewport.y - spacing * viewport.zoom / 2}px`,
    }),
  ], []),
}
```

`ZlozBackground<Message>` and `ZlozBackgroundRenderContext` are exported from
`@opsydyn/foldkit-zloz/foldkit`. Background selection belongs to the host Model;
it never changes the graph or Undo history. The sample demonstrates dots,
squares, a composed custom graph-paper renderer, and no grid.

### Shared grid spacing

Initialize `createEditor(graph, { gridSpacing: 32, snapToGrid: true })`, or dispatch
`{ type: 'GridSpacingChanged', spacing: 32 }`. Spacing must be finite and positive;
fractional units are supported. Invalid initialization throws; invalid, redundant,
read-only or active-gesture changes are ignored. Changing spacing does not move
nodes, change revision or add an Undo step. Undo/Redo retain the current preference.

Node drag snapping, group boundary snapping, resize keyboard steps, default dots
and squares, and custom renderer `context.spacing` share the setting. Resize keys
move one interval, or four with Shift, while snapping is enabled. Duplicate/paste
placement offsets use two grid intervals. Explicit background `gap` remains an
independent visual override. Grid spacing is editor session state, excluded from
graph JSON; hosts can persist preferences separately. The sample retains it when
switching examples and loading/importing diagrams.

### Resize alignment guides

Enable `snapToAlignment` (the sample's **Snap to nodes**) for magnetic group
resizing. Pointer drags align moving edges to nearby visible card edges and
collapsed group edges within six screen pixels. Expanded boundaries and the
resized group's descendants are excluded. Corner handles can align both axes;
side handles align their moving axis. Keyboard sizing keeps its existing steps.

Alignment overrides the grid only on a matching axis. With locked proportions,
the closest matched edge drives uniform scaling. Content, parent and size limits
remain authoritative: a guide is shown only if the resulting edge reaches its
target. Guides live in the resize gesture, clear when leaving the target, and
vanish on release or Escape. A completed resize remains one Undo step. The
FoldKit renderer draws them using the existing `--flow-alignment-guide` token.

Use `renderAlignmentGuide(context, h)` to replace the decorative SVG for
either drag or resize guides. The context provides the resolved guide,
`start` and `end` in graph coordinates, the gesture phase, and the viewport.
Use the supplied endpoints so the decoration follows the snap result.

```ts
renderAlignmentGuide: ({ start, end }, h) =>
  h.line([
    h.X1(String(start.x)), h.Y1(String(start.y)),
    h.X2(String(end.x)), h.Y2(String(end.y)),
    h.Stroke('#0f766e'), h.StrokeWidth('2'),
    h.Style({ 'vector-effect': 'non-scaling-stroke' }),
  ], []),
```

Return `undefined` for the default dashed guide or `null` to omit it.
ZLOZ calls the hook only for resolved guides when the effective
`alignmentGuides` diagnostic is enabled. Guide visibility is independent
of snapping.

### Lock node movement

Pass `canMoveNode(node, graph)` in `EditorPolicy` to allow or block dragging
and keyboard nudging. Return `null` to allow a node to move, or a reason to
block it. A move checks the entire selection, including descendants of groups.
One locked node blocks the whole move. A drag uses the graph as it was at the
start of the gesture and checks the policy again before committing. Pass the
same callback to `zlozView` to expose the lock on node handles. Custom shells
receive `moveDisabledReason` and can still use `zlozDragHandle` for selection.

### Lock node dimensions

Pass `canResizeNode(node, graph)` in `EditorPolicy` to restrict explicit
resizing. Return a reason to block an edit or `null` to allow it. The policy
covers pointer resizing, keyboard resize steps, direct dimension edits, and
Fit group to contents. If an edit would also grow an ancestor with locked
dimensions, ZLOZ rejects the whole edit.

Pass the same callback to `zlozView` to hide locked resize handles and
disable group dimension controls. Custom node shells receive
`resizeDisabledReason`. Movement permissions apply separately.

### Control which items can be selected

Pass `canSelectNode(node, graph)` or `canSelectEdge(edge, graph)` in
`EditorPolicy`. Return `null` to allow selection or a reason to exclude
the item. ZLOZ checks direct selection and interactions that select an item,
such as opening its context menu. An excluded group can still contain
individually selectable nodes.

Pass the same callbacks to `zlozView` so selection controls and the marquee
preview agree with the reducer. Excluded items remain visible. Custom node
shells, connection rows, and edge labels receive `selectionDisabledReason`.
These callbacks govern new selection attempts. To clear a selection after
changing the policy, send `SelectionCleared`.

### Fit the selection

Set `fitSelectionControl: true` with `viewportControls: true` to show
**Fit selection**. Custom viewport controls can render
`context.actions.fitSelection` with `zlozViewportControl`. The action
emits `{ type: 'FitSelectionClicked' }`.

Fit selection frames selected visible nodes and connections together.
For edges, it uses the displayed endpoint bounds and any stored route
used by the built-in path. A collapsed endpoint uses its group boundary.
The camera follows the configured padding, zoom limits, and Fit view
animation, including reduced motion. Selection and undo history are
preserved. Custom SVG geometry can extend outside the fitted bounds.

### Zoom to an area

Set `zoomAreaControl: true` with `viewportControls: true` to show **Zoom to
area**. Custom viewport controls can use `context.actions.zoomArea` with
`zlozViewportControl`. The action emits `ZoomAreaModeToggled`. The next
background drag fits its rectangle and returns to the previous canvas mode.
Each side must span at least 5 CSS pixels. Escape on the canvas or the
pressed control cancels.

The fit uses the configured padding, zoom limits, animation, and reduced
motion behavior. It works in read-only views and preserves selection and
undo history. Use `renderZoomAreaMarquee(context, h)` to paint the preview
inside ZLOZ's pointer-inert frame. The context provides normalized world
bounds and the viewport. Return `undefined` for the default or `null` to
hide the decoration.

### Back to previous view

Set `previousViewControl: true` with `viewportControls: true` to show
**Back to previous view**. Custom controls can use
`context.actions.previousView` with `zlozViewportControl`, or send
`{ type: 'PreviousViewClicked' }` directly.

ZLOZ keeps one session checkpoint. Fit view, Fit selection, Zoom to area,
and node or connection reveal capture the camera before moving it.
Manual pan and zoom leave the checkpoint available. Back uses it once,
respects the current zoom limits and reduced-motion preference, and works
in read-only views. It preserves the current selection, group expansion,
graph, and undo history. Snapshots save the current camera only.

### Reveal a node

Send `{ type: 'NodeRevealRequested', id }` to center a node. ZLOZ keeps the
current zoom when the node fits and zooms out as needed within the active
limits. It expands collapsed ancestors and uses the existing Fit view timing,
including reduced motion. Graph edits, selection, and history are separate
from this camera action.

Use `revealableNodes(state)` to populate a search or navigation control.
It includes nodes inside collapsed groups and filters explicitly hidden
nodes and descendants. Reveal requires a measured canvas and an idle
gesture, and works in read-only mode.

### Reveal a connection

Send `{ type: 'EdgeRevealRequested', id }` to frame both endpoint nodes
and the stored route when the edge uses it. ZLOZ opens collapsed ancestors
of the endpoints, preserves selection and history, and uses the same zoom
and timing rules as node reveal. The frame uses authored endpoint bounds and
stored route points. Custom SVG path extensions can extend beyond that frame.

Use `revealableEdges(state)` for connection search. It includes edges inside
collapsed groups and excludes explicitly hidden edges or edges with hidden
endpoints.

### Save the camera with the graph

Call `serializeSnapshot({ graph, viewport })` to include pan and zoom in a
version 1 document. `parseSnapshot(text)` validates the graph and any camera
it contains. For graph-only documents, the returned snapshot omits
`viewport`. `serializeGraph` and `parseGraph` continue to read and write the
graph on its own.

```ts
const saved = serializeSnapshot(editor);
const { graph, viewport } = parseSnapshot(saved);
const reopened = createEditor(graph, viewport ? { viewport } : {});
```

Snapshots include the authored graph and optional camera. Selection, undo
history, routes, and active gestures are session state. The viewport must
have finite pan coordinates and a positive finite zoom. Hosts using custom
zoom limits can bound the saved zoom before initializing the editor.

### Retain built-in node views during camera and chooser updates

Pass one FoldKit `createLazy()` slot per canvas as `nodeViewCache`.
Keep `onEvent` and any `renderNode` callback stable to reuse the node and
port layer across camera-only renders. With viewport culling enabled, the
layer is reused while the mounted node set stays the same. Entering or leaving
the overscan area rebuilds the layer from the current graph. The slot holds
one layer per canvas. Graph edits, selection changes, and changes to the
other layer inputs also rebuild it. Pending connection creation is eligible:
the staged source is a layer input, so source changes, cancellation and creation
refresh native port feedback while unrelated chooser filtering can reuse the layer.
Read-only changes also rebuild the layer. With culling, a staged source remains
pinned until cancellation or creation changes the mounted set.

Whole-layer retention falls back to live views for custom node shells, node policies,
node filtering through visibility or group collapse, open context panels,
custom ports and editing gestures. Port policies stay live so changing
protection reasons remain current. The retained context trigger resolves its
anchor against the latest viewport when activated.

### Retain bodies while ports stay live

For policy-controlled or custom ports, supply a separate per-canvas body cache:

```ts
import { createLazy } from 'foldkit/html';
import { createZlozNodeBodyCache, zlozView } from '@opsydyn/foldkit-zloz/foldkit';

const nodeViewCache = createLazy();
const nodeBodyCache = createZlozNodeBodyCache();

// Inside the host view; keep these cache instances stable for this canvas.
zlozView(h, editor, {
  id: 'workflow',
  label: 'Workflow',
  onEvent,
  nodeViewCache,
  nodeBodyCache,
  canConnectPort: policy.canConnectPort,
});
```

`nodeBodyCache` also works independently. When both are supplied, the whole-layer
slot is preferred where eligible; otherwise the built-in frame and ports render
live around retained bodies. Port callbacks and custom `renderPort` hooks run on
every view. Native disabled states, protection reasons and pending-source feedback
therefore follow the current Model without becoming cache permissions.

The body contains the title/drag handle, context/resize controls and `renderNode`
content. A layout-transparent wrapper preserves control order and leaves ports
as direct frame children. That wrapper stays consistent across cache/fallback
transitions while the body option is present, preserving focused body controls.
Bodies track node identity, selection, read-only state and their rendering inputs,
not the pending source or a graph snapshot. Keep `onEvent` and content callbacks
stable; replace a callback when its captured display inputs change.

The factory uses weak immutable node identities rather than retaining a permanent
map of editor IDs. Use one instance per canvas; never share a slot between two
simultaneously mounted canvases. Replacing a node object rebuilds that body.
Custom shells, node-body policies, open context panels, visibility/group filtering
and editing gestures keep their live path. This is view memoization only; graph
edits, current permission checks, measurements and Undo remain Model-owned.

### Compose the cache inside a custom shell

Custom shells can call the same public cache explicitly. The workbench Orbit
node caches its SVG/label using `[h, node, selected, selectionPreview]`; the Orbit
group caches only its label using `[h, node]`. Handles, resize/collapse buttons,
frames and sockets stay live. Do not pass the complete context, graph or a port
policy into an artwork-only key.

```ts
const shellCache = createZlozNodeBodyCache(); // one cache per canvas/body position

// Inside a custom shell; drawArtwork accepts exactly these immutable inputs.
const artwork = shellCache(context.node, drawArtwork, [
  h,
  context.node,
  selected,
  context.selectionPreview,
]);
return zlozNodeFrame(
  h,
  context,
  [],
  [
    zlozDragHandle(h, context, [], [artwork]),
    ...context.resizeHandles,
    ...(context.ports ??
      context.node.ports.map((port) =>
        zlozPort(h, context, port, [], [port.kind === 'output' ? '→' : '←']),
      )),
  ],
);
```

Use the same artwork constructor and root shape with caching on or off so an
optional optimization does not replace live controls. Include every value the
artwork actually reads in its arguments. The automatic `nodeBodyCache` option
still falls back for complete custom shells; this is explicit composition using
public frames, controls and cache functions, without private input attributes or
an alternate permission path. See the
[Orbit composition evidence](../../apps/zloz-demo/evidence/orbit-body-cache.md).

### Cull canvas items outside the viewport

Set `viewportCulling: true` on `zlozView` to mount canvas items near the
measured viewport. The default is off. Use `{ overscan: 96 }` to customize the
buffer in CSS pixels. Before the surface is measured, the whole canvas renders.

Focused and selected items stay mounted, along with active gesture items.
Built-in edge bounds include crossing edges and routes. Authored edge labels
and edges with custom geometry or drawing hooks stay mounted so their content
can extend beyond the default bounds. Custom node shells can choose more
overscan for content that extends outside their node frame. Offscreen shells
can remount as the camera moves, so keep their durable state in the Model.
The tab order includes mounted canvas controls.

Fit view, the minimap, the Connections list, world overlay inputs, and graph
operations still use the full visible graph.

### Hide nodes and edges

Use `createEditor(graph, { visibility })` for initial visibility and send
`VisibilityChanged` to replace it during the session. Omit either list to
show those items again.

```ts
const next = updateEditor(state, {
  type: 'VisibilityChanged',
  visibility: { hiddenNodeIds: ['review'], hiddenEdgeIds: ['optional-link'] },
});
```

Hiding a node hides its incident edges. Hiding a group also hides its
descendants. Collapsed groups still project edges between visible boundaries.
The canvas, minimap, Connections list, Fit view, and marquee use the same
visible items. Changing visibility clears hidden selections and cancels
in-progress gestures. The underlying graph, exports, and Undo history retain
the authored items. Use editor policies to restrict edits to graph data.

### Protect nodes and edges from deletion

Pass a pure `canDelete` callback in `EditorPolicy` to `updateEditor`. It
receives the nodes and edges that would be removed, including selected
groups' descendants and incident edges, and the original graph. Return a
reason to reject the entire deletion or `null` to accept it. A rejection
sets the editor notice and preserves the graph, revision, and Undo/Redo
history. Accepted deletions use the existing transaction boundary.

```ts
const canDelete: NonNullable<EditorPolicy['canDelete']> = ({ nodes, edges }) =>
  nodes.some((node) => node.id === 'required-step') ||
  edges.some((edge) => edge.id === 'required-link')
    ? 'This workflow step or connection is required.'
    : null;

const next = updateEditor(state, event, { canDelete });
const view = zlozView(h, next, { id: 'workflow', label: 'Workflow', onEvent, canDelete });
```

Pass the same callback to `zlozView` for disabled Delete actions and their
reason in the built-in context panels and edge toolbar. Custom controls can
read `disabledReason` from the action descriptors or call `resolveDeletion`
with their own targets. The policy may run during rendering and again when
the editor handles a deletion, so keep it synchronous and pure. The host
decides how to identify required items.

### Box selection matching

Full containment is the default. To include cards that overlap only part of
the marquee, initialize the editor with `boxSelectionMatch: 'partial'` or
send `{ type: 'BoxSelectionMatchChanged', match: 'partial' }` while idle.
The setting applies to both Shift-drag and Box select. It belongs to the
editor session and is separate from the saved graph and Undo history.

Partial matching requires positive-area overlap. Touching an edge or
drawing a zero-area rectangle selects no items by overlap. Expanded group
frames still require full containment, so a marquee inside a group can
select its children independently. Collapsed groups match using their
visible bounds, and hidden descendants stay excluded. Selection is applied
on release.

### Live box-selection preview

While drawing a marquee, ZLOZ highlights the nodes that would be selected
on release. The preview uses the same match rule, collapsed-group
projection, and ancestor selection as the final selection. Pressed states
and selection actions continue to reflect the committed selection until
release. Escape clears the preview and keeps the prior selection.

Custom node and group shells receive `selectionPreview` for their own
highlight styling. Set `selectionPreviewHighlights: false` to disable node
highlights. The marquee hook still receives `previewNodeIds` so a host can
show its own feedback. Preview remains available in minimal mode.

### Custom box-selection marquee

Use `renderSelectionMarquee(context, h)` to replace the decoration during
a box-selection gesture. The context contains normalized `bounds` in graph
coordinates, the current `viewport`, the matching rule, and `previewNodeIds`. ZLOZ positions and sizes the frame
using the same bounds as selection on release. Use decorative content that
fills the frame.

```ts
renderSelectionMarquee: (_, h) =>
  h.div([h.Style({
    position: 'absolute',
    inset: '0',
    border: '2px dashed #0f766e',
    background: 'rgb(20 184 166 / 0.15)',
  })], []),
```

Return `undefined` for the default outline or `null` to omit the decoration.
The frame ignores pointer input and stays available during selection in
minimal mode.

### Live resize dimensions

The FoldKit view shows a width × height readout in the canvas's lower-left corner
during pointer resizing. With `resizeHandles: true`, it also stays visible for a
single selected, expanded group so keyboard resizing has the same feedback.
Card readouts are transient. Read-only views and collapsed/hidden groups omit it.
Set `resizeReadout: false` to disable the readout. To replace its appearance,
use `renderResizeReadout(context, h)` with the host's typed FoldKit builder.

```ts
renderResizeReadout: ({ node, widthText, heightText }, h) =>
  h.div([h.Class('dimensions')], [
    node.label + ' · Width ' + widthText + ' · Height ' + heightText,
  ]),
```

The renderer receives the node with raw Model dimensions, the formatted
values, and the `resizing` or `selected-group` phase. ZLOZ keeps placement
and the polite status region. Return `undefined` for the default badge or
`null` to omit an eligible readout. The renderer runs only when the effective
`measurements` diagnostic and the readout option allow it.

Values come from the current Model in graph units, including snapping, limits,
locked proportions and measured card height. Up to two decimal places are shown;
this never rounds authored geometry. The badge stays the same screen size while
zooming, ignores pointer input, and uses a native polite status region. Releasing
keeps a selected group's result visible; Escape restores its original dimensions.
Selection clearing hides it. Theme it with `--flow-resize-readout-background` and
`--flow-resize-readout-color`, alongside existing node border/color tokens.

### Numeric group dimensions

With `contextActions: true`, open a group's **More actions** panel to edit Width
and Height in graph units. Each field applies on native change (for example,
leaving the field), creating one Undo step. The panel stays open for sequential
edits and displays the resulting dimensions after grid snapping, size/content
limits, parent containment or expansion, and locked proportions. Controls are
disabled for collapsed groups and unavailable in read-only views. Escape closes
the panel; changes already applied remain undoable.

Hosts can dispatch `{ type: 'GroupDimensionChanged', id, dimension: 'height',
value: 320 }` (or `dimension: 'width'`). Numeric edits anchor the group's top-left
corner and keep child positions fixed. With proportions locked, changing either
dimension also scales the other. Invalid/non-positive values and active-gesture
edits are ignored; repeated clamped values add no history. `NodeWidthChanged`
continues to support group width through the same geometry path. The fields trim
floating-point display noise without rounding authored geometry.

### Custom canvas help and status

Use `renderCanvasHelp` for instructions and `renderCanvasStatus` for notices
or a diagram summary. Both receive `defaultText` and the effective
`visible` flag. Help also includes the selection mode, toolbar availability,
and read-only state. Status includes the current notice and visible node
and connection counts.

```ts
renderCanvasHelp: ({ defaultText }, h) =>
  h.div([h.Class('canvas-help-card')], [
    h.strong([], ['Canvas controls']),
    h.p([], [defaultText]),
  ]),
renderCanvasStatus: ({ defaultText }, h) =>
  h.span([h.Class('canvas-status-badge')], [defaultText]),
```

ZLOZ keeps the description ID referenced by the canvas and node controls,
and updates status inside the existing polite live region. Diagnostics
visually hide these containers while preserving their accessible content.
Keep meaningful text in both renderers, including when `visible` is false.
Return `undefined` to use the default copy.

### Diagnostics and minimal mode

Use `minimalMode: true` for a clean package view, or `diagnostics: false` to
suppress all diagnostic presentation. Both override individual flags. Defaults
preserve existing presentation. Configure individual diagnostics with:

```ts
zlozView(h, model.editor, {
  id: 'workflow',
  label: 'Workflow',
  onEvent: (message) => Message.ObservedZlozInput({ message }),
  minimalMode: model.minimalMode,
  diagnostics: {
    measurements: false, // size readout, numeric group inputs and numeric resize tips
    alignmentGuides: false, // visual lines; snapping remains active
    zoomLevel: false, // percentage; zoom controls remain usable
    status: false, // visually hide notices/counts, retain polite announcements
    instructions: false, // visually hide help, retain accessible descriptions
    overview: false, // hide an enabled minimap
    connectionList: false, // replace the verbose list with a compact Connections disclosure
  },
});
```

Connection actions remain keyboard-accessible through the compact disclosure.
Its `ConnectionListToggled` fact updates editor session state without changing
graph geometry, revision or Undo history; it also works in read-only views.
Opening it is an explicit inspection action. Full lists keep their existing
presentation. Graph labels, ports, selection/resize handles, background styles
and editing controls are not diagnostics and retain their own options.

`resolveZlozDiagnostics(options)` and the `ZlozDiagnostics` /
`ZlozDiagnosticOptions` types are exported from `/foldkit`. Use the resolver in
custom node renderers or host chrome to apply the same effective flags; the
package cannot identify diagnostics in arbitrary consumer content. The existing
`resizeReadout: false` option still independently hides just the size badge.
These are view preferences, not graph document fields. Minimal mode never turns
off snapping, constraints or other editing behavior. The workbench demonstrates
global and individual toggles, retains stored flag choices, and hides its own
inline controls without changing node footprints.

### Design freedom and public composition

With `viewportControls: true`, supply `renderViewportControls` to lay out or
omit any action. The context contains `actions`, `diagnostics`,
`selectionModeControl`, and the current `state`. Use `zlozViewportControl` for
native button semantics, or map an action's `event`, `disabled`, and `pressed`
fields into your own component. The action `label` supplies the accessible name
and can be translated or changed to match your visible text.

```ts
renderViewportControls: ({ actions }, h) =>
  h.nav([h.AriaLabel('Diagram navigation')], [
    zlozViewportControl(h, { ...actions.fitView, label: 'Frame graph' }, onEvent,
      [h.Class('frame-action')], ['Frame graph']),
  ]),
```

With `minimap: true`, `renderMinimap` receives visible nodes in paint order and
world bounds from the current Model, including collapsed groups. Compose
`zlozMinimap(h, context, onEvent, frameAttributes, svgChildren)` inside the ZLOZ
surface for pointer input. Its inner SVG stretches to fit the frame and maps
clicks using the area inside the border and padding. Draw node marks in world
coordinates, and add `zlozMinimapViewport(h, context.geometry, svgAttributes)`
when you want a camera outline. You can also draw your own outline from
`geometry.visible`, or leave it out. Arrow keys pan the camera (Shift takes
larger steps), Home fits, and Enter or Space centers the overview.

Return `undefined` from either hook to use the shipped design. Existing feature
flags still control whether hooks are called. Minimal mode and the `overview`
diagnostic hide the minimap, while zoom and fit remain available. Navigation
works in read-only mode and leaves graph history unchanged.

### Design freedom and public composition

Freedom and control apply to the engineering API as well as end-user preferences.
The target is supported composition of complete presentation parts, with stable
interaction primitives and a headless behavior core. Consumers should not need
private DOM bindings, package forks or CSS specificity overrides to implement a
design. Presentation and geometry responsibilities must remain explicit.

The optional `/foldkit` entry now exposes `renderNodeShell(context, h)` and
`renderGroupShell(context, h)` alongside the existing content-only `renderNode`.
Return `undefined` from a shell hook to use the default for that node. A full shell
owns its contents; the content-only callback is used only by the default card.

```ts
import {
  zlozView,
  zlozNodeFrame,
  zlozGroupFrame,
  zlozDragHandle,
  zlozPort,
} from '@opsydyn/foldkit-zloz/foldkit';

zlozView(h, model.editor, {
  id: 'diagram',
  label: 'Architecture',
  onEvent: (message) => Message.ObservedZlozInput({ message }),
  renderNodeShell: (context, builder) =>
    zlozNodeFrame(
      builder,
      context,
      [builder.Class('my-node'), builder.Style({ padding: '16px', background: '#fff' })],
      [
        zlozDragHandle(builder, context, [], [context.node.label]),
        ...context.node.ports.map((port) =>
          zlozPort(builder, context, port, [builder.Class('my-port')], ['●']),
        ),
        ...context.resizeHandles,
      ],
    ),
  renderGroupShell: (context, builder) =>
    zlozGroupFrame(
      builder,
      context,
      [builder.Class('my-boundary')],
      [
        zlozDragHandle(builder, context, [], [context.node.label]),
        ...(context.collapseToggle ? [context.collapseToggle] : []),
        ...context.resizeHandles,
      ],
    ),
});
```

Use your host's normal event wrapper for `onEvent`. Every primitive accepts the
host builder, Model-derived context, normal builder attributes and children.
There are no default visual styles in the primitives. Classes and `h.Style` can
own borders, shape, typography, padding, icons and colors directly. The bundled
cards/groups use these same primitives.

- `zlozNodeFrame`: one measured HTML frame per ordinary node. Model owns its
  position and width; content controls height, reported through `NodeMeasured`.
- `zlozGroupFrame`: one boundary per group, with both dimensions from Model.
  Empty boundary space passes pointer events through to its descendants.
- `zlozDragHandle`: a native button carrying selection, movement, focus and drag
  behavior, with its node name and help description.
- `zlozPort`: a native connection button, centered on the Model's authored anchor
  independent of its visual size. Keep ports as direct children of the frame.
- `zlozResizeHandle(builder, context, handle, attributes, children)`: a native
  resize button. Groups support eight directions; ordinary nodes use width-only
  resizing (`right`). Arrow keys resize groups; Left/Right resize ordinary nodes.
  Shift increases the step. Grid snapping, limits, read-only policy and Undo use
  the same core path as the bundled view.

The context includes `node`, `state`, resolved `diagnostics`, `collapsed` and
`dropTarget`. It also supplies optional `contextAction`, `collapseToggle` and
`resizeHandles` from enabled default controls. Place or omit them freely, or use
native host controls with public editor events. Omit nested interactive controls
inside drag buttons. Consumers never need to copy private input attributes.

**Geometry contract:** frame position, width, group height, box sizing and input
markers belong to the primitives. Port position and transform belong to its Model
anchor. The primitives merge style attributes and apply those geometry properties
last. Keep frames at the supplied world coordinate level; avoid CSS transforms,
margins, size constraints or ancestor positioning that would move/scale the frame
away from Model geometry. Visual node height may intentionally change with
content or a shell switch; ZLOZ remeasures it and rebases history. Fixed group
bounds do not auto-fit to new content; use `GroupFitClicked` when desired.

The sample's **Node design** selector switches between the default cards and
complete circular SVG shells, including different group chrome, ports and resize
controls. Both use the same graph and package input lifecycle. The SVG artwork is
inside a measured HTML frame; native buttons retain keyboard behavior.

`renderEdge` decorates the shared resolved path; the geometry policy below
changes that path and its label anchor together. Follow-on boundaries are recorded in
[ADR 0004](https://github.com/opsydyn/fold-kit-experiments/blob/main/docs/adr/0004-composable-flow-presentation.md).

### Shared custom edge geometry

Use `ZlozEdgeGeometryPolicy` and `resolveEdgeGeometry` from the dependency-free
root entry, or pass a policy as `zlozView`'s `edgeGeometry` option. The optional
FoldKit entry also re-exports the policy/context/result types.

```ts
import type { ZlozEdgeGeometryPolicy } from '@opsydyn/foldkit-zloz';

const raisedArc: ZlozEdgeGeometryPolicy = ({ source, target, edge, route }) => {
  // Preserve authored styles and layout routing in this example.
  if (edge.pathStyle !== undefined || route) return undefined;
  const control = { x: (source.x + target.x) / 2, y: Math.min(source.y, target.y) - 100 };
  return {
    path: `M${source.x},${source.y} Q${control.x},${control.y} ${target.x},${target.y}`,
    labelPosition: {
      x: (source.x + 2 * control.x + target.x) / 4,
      y: (source.y + 2 * control.y + target.y) / 4,
    },
  };
};

// Include these options alongside your normal id, label and onEvent options:
// edgeGeometry: raisedArc,
// edgeAppearance: (edge) => ({ hitWidth: 18 }),
```

The policy context contains `graph`, `edge`, `source`, `target`, `route`,
`sourceGroup`, `targetGroup` and `defaultGeometry`. Coordinates are world units.
Endpoints already account for collapsed groups. The default geometry already
resolves authored path styles and layout routing. An accepted custom result takes
precedence; returning `undefined` preserves the default. A pure headless consumer
uses `resolveEdgeGeometry(graph, edge, { policy, route, sourceGroup, targetGroup })`.
The original `edgePath` helper continues to return built-in geometry.

One resolved `path` feeds SVG decoration and selection. Its `labelPosition` feeds
on-canvas labels, label editing and toolbar placement. Set `labelPosition` to
`undefined` to omit those anchored parts. Connection-list selection and actions
remain available. `renderEdge` receives this same resolved path/anchor and remains
a decorative callback. Draw along `context.path` to retain interaction agreement.

The public `zlozEdgeHitTarget(builder, { edge, path, hitWidth }, attributes?)`
primitive encapsulates SVG selection bindings for composed presentations.
`zlozView` uses it for both default and custom decoration, with a transparent
12-unit selection corridor. `edgeAppearance.hitWidth` controls that width per
edge. It must be positive and finite. Native connection-list controls continue
to provide keyboard selection; reconnection handles stay anchored to ports.

Policies must be pure, keep their path endpoints at the supplied canonical
anchors, and choose their label anchor deliberately. The package rejects empty
paths and non-finite label coordinates with `ZlozError`; it does not validate SVG
syntax or infer label positions by reading the DOM. Keep path geometry out of CSS
transforms/overrides and out of `renderEdge` if it differs from the resolved path.
No policy functions are stored in Model or serialized documents.

The sample's **Edge design** selector demonstrates raised arcs in both node
presentations. Obstacle avoidance and custom-route bounds for Fit view remain
outside this contract. Connection-drag previews use the contract below.

## Generated API reference

```sh
bun run --filter @opsydyn/foldkit-zloz docs
# Open packages/foldkit-zloz/docs/index.html through a local static server.
```

The TypeDoc reference covers the public core and FoldKit entry points, optional
ELK and force adapters, and the lightweight force eligibility subpath. Signatures,
fields, unions and source links come from TypeScript exports. Its landing page
explains Model ownership, composition and package boundaries.

The Pages workflow builds the [ZLOZ API reference](https://opsydyn.github.io/fold-kit-experiments/zloz/api/).
That route becomes available when the updated workflow reaches Pages; generating
it locally does not publish the site or npm packages.

### Connection-drag previews

`resolveConnectionPreview(state, geometryPolicy?)` is a pure core helper. It
returns no preview for idle state, keyboard-only port selection or read-only
views. An active preview contains logical output-to-input `source`/`target`
points in world units, the actual world `pointer`, nullable endpoint identities,
`movingEnd`, projected `sourceGroup`/`targetGroup`, and the existing `edge` when
reconnecting. New incomplete connections have no synthetic edge or fake port ID.

`ZlozConnectionFeedback` is a union: `free`, `valid` with an accepted endpoint,
or `invalid` with a rejected endpoint and reason. Feedback comes from the same
core validation used on drop, including direction, duplicate and host-policy
checks. `Gesture.target` remains the accepted endpoint or null. Its optional
`rejected` details are mutually exclusive with an accepted target.

The view exposes two independent hooks:

```ts
import type {
  ZlozConnectionGeometryPolicy,
  ZlozEdgeGeometryPolicy,
  Point,
} from '@opsydyn/foldkit-zloz';

// Share one pure curve function across both policy contexts.
const curve = ({ source, target }: { source: Point; target: Point }) => ({
  path: `M${source.x},${source.y} Q${source.x},${target.y} ${target.x},${target.y}`,
  labelPosition: undefined,
});
const edgeGeometry: ZlozEdgeGeometryPolicy = curve;
const connectionGeometry: ZlozConnectionGeometryPolicy = curve;

// zlozView options alongside the host's normal id, label and onEvent:
// edgeGeometry,
// connectionGeometry,
// renderConnection: (context, builder) => builder.path([
//   builder.D(context.path), builder.Fill('none'),
//   builder.Stroke(context.stroke), builder.StrokeWidth('5'),
// ], []),
```

`connectionGeometry` returns the same geometry result shape as the finished-edge
policy, or `undefined` for built-in geometry. Defaults are straight for new
connections and follow authored path style during reconnection. Valid and
rejected hovered ports use their canonical anchors; free space uses the cursor.
Source reconnection keeps the logical output at the path start.

`renderConnection` receives that geometry and core feedback plus default `stroke`,
`strokeWidth` and `dashArray`. It owns decorative SVG through the host builder;
return `undefined` for the default dashed wire, or empty SVG to omit the visual
without disabling the interaction. The package owns pointer capture and the
pointer-inert, hidden-from-assistive-technology preview layer. Preview SVG must
stay decorative. Existing native port buttons retain keyboard operation.

Default colors use `--flow-selection`, `--flow-valid-target` and
`--flow-invalid-target`. Rejection reasons also reach the existing live status.
Gesture data stays in Model; geometry is derived and callbacks remain host view
configuration. Preview functions and styles are not serialized.
The sample combines **Edge design** with **Connection preview** choices for
dashed, ribbon and hidden presentation in both card and SVG node designs.

### Custom port anchors

Ports support two mutually exclusive positions. Existing documents keep their
cardinal side/offset form. Custom anchors use normalized coordinates in the node
box; both fractions must be finite and between 0 and 1:

```ts
import type { Port } from '@opsydyn/foldkit-zloz';

const cardinal: Port = { id: 'out', kind: 'output', side: 'right', offset: 0.5 };
const diagonal: Port = {
  id: 'out',
  kind: 'output',
  side: 'right',
  anchor: { x: 0.84, y: 0.16 },
};
```

`side` is the outward routing/reconnection hint for either form. It does not move
an explicit anchor. Do not provide both `offset` and `anchor`. `PortPosition`
models that choice; `PortSide` names its direction. Use `portAnchor(port)` for
normalized coordinates, `portPosition(node, id)` for the canonical world point,
and `portBoundaryPosition(node, id)` for its projection onto the hinted box side.

The same authored point drives public port presentation, edge geometry, previews
and snapping to targets. Coordinates rescale with authored width and measured
height. Frame primitives separate a border-free coordinate plane from the visual
shell: frame attributes/classes/styles decorate that measured static shell, so
borders and padding do not shift port centers. Keep ports as direct logical frame
children and avoid positioned/transformed wrappers between them and the frame.
Do not style private geometry elements. The existing restrictions against moving
frames with CSS transforms or margins still apply.

Change one or many positions atomically through the core:

```ts
const next = updateEditor(state, {
  type: 'PortPositionsChanged',
  positions: [
    {
      endpoint: { node: 'review', port: 'out' },
      position: { side: 'right', anchor: { x: 0.84, y: 0.16 } },
    },
  ],
});
```

Edits retain IDs, directions, labels and edge metadata. The batch validates before
publication, detaches anchor coordinates, advances revision, clears cached routes
and creates one Undo step. Duplicate/unknown endpoints and malformed positions
are rejected. No-op batches leave history unchanged. Read-only and active-gesture
protection use the normal core path.

ELK receives fixed boundary projections and rejoins its routes to the exact
anchors. Force routing extends its leads beyond the hinted node boundary before
avoiding other cards. Reconnection controls use the same boundary hints so they
remain reachable outside opaque node shells. Adapter routes may traverse their
own endpoint node; custom-shape clipping/obstacle geometry is not inferred.

`serializeGraph` preserves anchors in version 1 documents; legacy side/offset
documents remain readable. Builds predating anchor support may reject custom
anchor documents. Outside-box anchors and arbitrary routing normals are not
supported in this slice. The sample's **Port anchors** selector demonstrates
cardinal and diagonal circle-perimeter positions; it derives its value from the
document so Undo, Redo and imports stay consistent.

## Repository performance benchmarks

From this monorepo, `bun run --filter @opsydyn/foldkit-zloz bench:choosers`
measures chooser resolution, projection and field construction. The
[benchmark method, raw results and browser driver](../../apps/zloz-demo/evidence/endpoint-chooser-benchmark.md)
cover reproducible workbench typing measurements and the retained-node comparison.
The [validation indexing follow-up](../../apps/zloz-demo/evidence/endpoint-chooser-indexing.md)
compares per-resolution indexes against that baseline with fresh policy checks.
The [pending-creation retention follow-up](../../apps/zloz-demo/evidence/endpoint-creation-retention.md)
adds retained-creation comparisons and production feedback checks.
The [live-port body-retention report](../../apps/zloz-demo/evidence/node-body-policy.md)
adds policy-enabled comparisons and focused-control qualification.
These are repo-only diagnostic tools with no machine-dependent CI timing gate.

### Host-owned sidebar and fill-height layouts

`height: 'fill'` sizes the view inside a bounded flex/grid parent; omitting height
retains the 440px default and numbers still mean pixels. `renderLayout` receives
`ZlozViewLayoutParts`: `canvas`, `canvasId`, `help`, `controls`, `creation`,
`minimap`, `status` and `connections`. Controls, creation and minimap can be null
when disabled. The same native parts implement the default presentation.

```ts
zlozView(h, model.editor, {
  id: 'workflow',
  label: 'Workflow canvas',
  onEvent: zlozInput,
  height: 'fill',
  viewportControls: true,
  minimap: true,
  renderLayout: (parts, builder) =>
    builder.div(
      [
        builder.Style({
          display: 'grid',
          'grid-template-columns': '20rem minmax(0, 1fr)',
          height: '100%',
          'min-height': '0',
        }),
      ],
      [
        builder.aside(
          [builder.Style({ overflow: 'auto', 'min-height': '0' })],
          [
            builder.a([builder.Href('#' + encodeURIComponent(parts.canvasId))], ['Skip to canvas']),
            parts.help,
            ...(parts.controls ? [parts.controls] : []),
            ...(parts.creation ? [parts.creation] : []),
            ...(parts.minimap ? [parts.minimap] : []),
            parts.connections,
            parts.status,
          ],
        ),
        builder.section([builder.Style({ 'min-width': '0', 'min-height': '0' })], [parts.canvas]),
      ],
    ),
});
```

Give the host container a definite height. Keep each part at most once and retain
the help/ID relationship. Theme variables scope the entire result, including
relocated controls. Feature gates, diagnostics, policy reasons and typed events
are already resolved. A relocated minimap retains native pointer/keyboard input
through its own Live-scoped Mount; no canvas DOM protocol needs to be copied.
The pure root export and numeric/default layout remain compatible.

## Named editions and read-only history

```ts
import {
  captureEdition,
  appendEdition,
  serializeEditions,
  parseEditions,
  createHistoryReview,
  updateHistoryReview,
  compareEditions,
} from '@opsydyn/foldkit-zloz';
import { zlozHistoryGhosts } from '@opsydyn/foldkit-zloz/foldkit';

const edition = captureEdition({
  id: 'ordering-v1',
  name: 'Ordering · initial design',
  snapshot: { graph: model.editor.graph, viewport: model.editor.viewport },
});
const editions = appendEdition(model.editions, edition);
const archive = serializeEditions(editions);
const reopened = parseEditions(archive);
const review = createHistoryReview(reopened[0]!, model.editor);
// Route historical canvas events here; retain model.editor as the working editor.
const nextReview = updateHistoryReview(review, event);
const comparison = compareEditions(baselineEdition, selectedEdition);
// Optional world-overlay content; emit an accessible change list alongside it.
const ghosts = zlozHistoryGhosts(h, comparison, {
  enabled: model.showGhosts,
  nodes: true,
  edges: true,
  movements: true,
});
```

Editions are validated, detached and deeply frozen graph/optional-camera
checkpoints. Supply stable IDs and names yourself; duplicate IDs reject append,
and no clock or ID generator is hidden in core. The separate
`foldkit-zloz-editions` version-1 archive contains captured editions, not an
implicit working document or session Undo stack. Existing graph/snapshot wire
version 1 is unchanged. Parse validates versions, reserved fields, all graphs,
cameras and duplicate identities. Host Commands own file/storage/network I/O,
retention and input budgets. Capturing, comparing and encoding use full snapshots;
no compressed journal or large-history performance guarantee is claimed.

`createHistoryReview` builds a separate read-only editor. Keep the complete working
editor while inspecting it; returning means discarding the review. Selection,
focus, pan, zoom, Fit and surface measurements go through `updateHistoryReview`.
Its explicit navigation allowlist blocks graph edits, node measurements and Undo/
Redo; `isHistoryNavigationEvent` lets hosts disable corresponding controls. New
editor events are blocked unless explicitly qualified. Route host-specific import,
layout, direct model replacement and other mutation actions separately; do not let
them overwrite the working editor while a review is displayed. Cancel or reject
stale pending work when entering review. After resizing during review, refresh
only the present surface measurement on return; retain its camera, graph and Undo.

`compareEditions` uses IDs, not labels or array positions. Node meaning includes
label, architecture, host data, group ownership and port identity/kind/label.
Layout includes position, dimensions, appearance, constraints and port locations.
Edge endpoints, label and data are meaning; path style and core path geometry are
layout. Camera-only and array paint-order changes do not create graph change entries. Object-key order does not create changes. Custom renderer output and
external layout routes are not archived or compared. Use `semanticChanged` and
`layoutChanged` flags independently; renaming an ID is an addition/removal, not a
guessed identity match.

`zlozHistoryGhosts` composes inside `renderWorldOverlay`. It creates inert SVG
outlines, dashed baseline edges and movement connectors without editor nodes,
ports, hit targets or Undo entries. Node, edge and movement switches are
independent; `enabled: false` omits the layer. Optional `renderNode`, `renderEdge`
and `renderMovement` callbacks replace marks with inert SVG; undefined keeps the
default and null omits it. Keep custom content noninteractive. The visual-only SVG
is aria-hidden; supply a textual change list/legend through the comparison model.
Use the complete uncollapsed comparison in this slice; host filtering/collapse
projections and custom route fidelity require explicit integration. Themes use
scoped ZLOZ paint tokens. Minimal-mode masking is a host presentation choice.

This is named snapshot review, separate from session Undo and the monotonic editor
freshness revision. Playback, fork/merge, collaborative history and agent history commands remain
subsequent slices. Archive import and undoable restore are described below. The workbench demonstrates named
capture, portable archive download, rewind, baseline comparison, ghost controls
and return; it labels session ownership and does not automatically persist data.

## Import and restore editions

```ts
import {
  parseEditions,
  mergeEditions,
  resolveEditionRestore,
  restoreEdition,
} from '@opsydyn/foldkit-zloz';

const incoming = parseEditions(archiveText);
const merged = mergeEditions(model.editions, incoming);
// merged.type is merged / unchanged / blocked. Never discard the working editor.
const options = { expectedRevision: model.editor.revision, policy: hostRestorePolicy };
const preview = resolveEditionRestore(model.editor, selectedEdition, options);
// Keep the target and expectedRevision in your Model. On explicit confirmation:
const result =
  preview.type === 'ready'
    ? restoreEdition(model.editor, preview.edition, {
        expectedRevision: preview.expectedRevision,
        policy: currentRestorePolicy,
      })
    : null;
// Only result?.type === 'restored' publishes a new graph transaction.
```

`mergeEditions` is additive and atomic. Identical IDs with identical names and
snapshots are skipped, ignoring JSON object-key order. Conflicting IDs or duplicate
incoming IDs reject the entire batch. No edition is overwritten; an unchanged
merge retains the existing collection reference. Parse errors throw through the
canonical codec, and merge conflicts return `ZlozEditionMergeDecision`.

`ZlozEditionRestoreOptions.expectedRevision` is required. Store it with the exact
target when presenting a preview and retain it at confirmation; passing the latest
revision instead would defeat stale-intent protection. Both resolve and commit
check freshness, read-only state, idle gestures, canonical target validity and
current policy. Restore requires enabled Undo history. Exact graph no-ops return
unchanged without a new revision or Undo entry. Invalid editions fail before
mutation; expected denials return a blocked reason and the original editor.

Restore uses the existing graph transaction: one Undo entry, a new monotonic
freshness revision, invalidated routes and cleared connection/draft state. The
working camera is preserved; the edition's saved camera is for inspection.
Undo/Redo recover the previous/restored graphs. The edition collection is not part
of graph Undo and is never modified by restore.

`ZlozEditionRestorePolicy` extends `EditorPolicy` with `canRestoreEdition` for whole
replacement rules, including fields without granular hooks. Existing deletion,
movement/reparenting, resize, architecture, appearance and retained-node port-edit
hooks are enforced. Port kind changes check remove/add. Node deletion and initial
ports on added nodes follow the existing node operation semantics. New/rewired
connections recheck connection policies against the complete candidate graph
without that edge; reconnect hooks use the original edge/current graph, and an
unchanged endpoint is not a new port connection. Policy vetoes, including blank
strings, never silently become permission. Keep policies pure and pass current
policy at confirmation rather than caching a ready result.

The workbench reads a single archive up to 5 MiB with strict UTF-8 decoding,
validates before merging, and rejects cancelled, superseded or collection-stale
results. Import preserves the working graph/camera/Undo. A preview, cancel action,
live protection reason and explicit **Restore as new change** action demonstrate
the package contract. Editions remain session-owned until exported; import does
not enable automatic persistence. Forks, merging branches and playback remain
separate slices.

### Fork an edition into another model

`captureModelDocument` owns portable document identity separately from local
node/edge/port IDs. `forkEdition` selects an edition in that model's collection,
checks distinct identity and an optional `canForkEdition` veto, and returns a new
immutable document. The source is untouched. Each document owns its own edition
IDs; the fork starts without captured editions. `origin` pins the immediate
parent's ID/name and exact edition. It is not a complete ancestry DAG or an
attestation of ownership. Hosts allocate model IDs unique within their registry.

```ts
import {
  captureModelDocument,
  forkEdition,
  createModelEditor,
  serializeModelDocument,
  parseModelDocument,
} from '@opsydyn/foldkit-zloz';

const source = captureModelDocument({
  id: 'ordering',
  name: 'Ordering',
  snapshot: { graph },
  editions: [edition],
  origin: null,
});
const fork = forkEdition(source, edition.id, {
  id: 'ordering-alternative',
  name: 'Alternative ordering',
});
if (fork.type === 'forked') {
  const portable = parseModelDocument(serializeModelDocument(fork.document));
  const editor = createModelEditor(portable); // fresh editable session; empty Undo/Redo
}
```

The independent `foldkit-zloz-model` version-1 JSON envelope preserves snapshot,
editions and pinned origin. Existing graph/snapshot and edition-archive version-1
formats remain unchanged and do not carry model identity. Old strict snapshot
readers reject model envelopes; use `parseModelDocument`, then `createModelEditor`.
Editor options remain host-owned; the snapshot camera is used unless explicitly
overridden. Undo, selection, gestures, routes and clipboard are never persisted.
Forking is distinct from undoable restore and does not merge model branches.

The standalone CLI validates model envelopes and reports explicit metadata losses
when projecting them to Mermaid. The workbench Open model JSON action opens a
separate session and rejects already-open IDs without overwrite or renaming. Its
existing diagram importer remains graph/snapshot-only. Use the explicit model
codec when identity, editions and origin must survive a round trip.

## Atomic architecture patterns

`insertPattern` adds any self-contained graph fragment without replacing existing
content. `createArchitecturePattern('c4-context' | 'ddd-aggregate' | 'event-storming')` supplies fresh,
customizable starters; use your own graph for other patterns.

```ts
import { createArchitecturePattern, insertPattern } from '@opsydyn/foldkit-zloz';

const result = insertPattern(editor, createArchitecturePattern('ddd-aggregate'), {
  offset: { x: 800, y: 40 },
  policy: {
    canInsertPattern: (fragment, current) => null,
    canConnectPort: (endpoint, proposed) => null,
  },
});
if (result.type === 'inserted') {
  editor = result.editor;
  const newRootId = result.nodeIds.get('source');
}
```

Every node and edge gets a fresh ID, returned in separate `ReadonlyMap`s. Parent
and endpoint references are remapped; node-local port IDs, geometry, semantics
and JSON data survive. JSON strings are opaque and are never rewritten as IDs.
Offsets translate all world positions equally, including nested groups. Placement
and overlap handling belong to the host.

The complete fragment is validated and detached. Invalid input throws `ZlozError`;
expected vetoes return `blocked` with the original editor and a nonempty reason.
Empty fragments return `unchanged`. Read-only/busy editors and disabled Undo
block insertion. Whole-pattern and existing connection policies run on every
call; each edge policy sees the complete proposed graph excluding that edge.
Selection policies filter the new root selection independently of insertion.
One successful insertion records one Undo step and clears Redo/routes, preserving
the camera, clipboard, model identity and editions. Persistence stays version one.

## Event-storming notes

The original EventStorming process-note subset models `command`, `domain-event`,
`policy` and `actor` roles with optional description. These remain ordinary nodes
using existing geometry, ports, membership, serialization and semantic-edit Undo.
They cannot themselves be group boundaries. The wider headless workshop union now
also includes external systems, hotspot annotations and lane frames, documented
below; their renderer qualification is separate.
The separate DDD `domain-event` role keeps its existing structural meaning.

```ts
import { createArchitecturePattern, insertPattern } from '@opsydyn/foldkit-zloz';
import { zlozEventStormingNode } from '@opsydyn/foldkit-zloz/foldkit';

const result = insertPattern(editor, createArchitecturePattern('event-storming'));
// In zlozView options:
const renderNodeShell = (context, h) => zlozEventStormingNode(context, h);
```

The starter shows Customer → Place order → Order placed → a policy → Request
payment. Edges describe an illustrative process; notes do not execute policies or
enforce causality. Adapt labels, ports, outlines and relationships to your model.

`ZlozEventStormingNodeOptions` offers `renderType`, `renderName`,
`renderDescription`, `renderBody`, `renderControls`, `attributes` and `bodyCache`.
Undefined slot results retain defaults, null omits content, and an empty controls
array hides chrome. Keep interactive UI in `renderControls`; sockets and control
feedback stay outside cached inert artwork. Compose this renderer with C4/DDD
renderers using their undefined fallback.

Scoped theme tokens `eventStormingCommand`, `eventStormingEvent`,
`eventStormingPolicy` and `eventStormingActor` override role accents, including
with host/Pleat variables. Light/dark defaults retain visible type labels so color
is supplemental. Outlines and geometry remain independent of semantic roles.
Graph/model envelopes remain version one; older readers can reject this new
semantic family. Mermaid strict export rejects omitted architecture metadata;
report mode explicitly discloses that loss. This is a bounded vocabulary, not a
complete workshop methodology or process engine.

## Opt-in edition playback

`createEditionPlayback` creates a session cursor over an ordered collection of
unique edition IDs. It stores no graphs, browser resources or working editor.
Hosts own the clock and resolve the selected ID against their own edition store.

```ts
import {
  createEditionPlayback,
  updateEditionPlayback,
  playbackEditionId,
} from '@opsydyn/foldkit-zloz';

let playback = createEditionPlayback(
  editions.map((edition) => edition.id),
  {
    intervalMs: 2000,
    reducedMotion: prefersReducedMotion,
  },
);
playback = updateEditionPlayback(playback, { type: 'PlayClicked' });
// From a host-owned subscription, only while status is 'playing':
playback = updateEditionPlayback(playback, { type: 'Elapsed', milliseconds: 2000 });
const selectedId = playbackEditionId(playback);
```

Playback starts paused. Reduced motion defaults true until explicitly supplied;
`editionPlaybackReason` gives a visible reason when automatic play is unavailable.
Events include PlayClicked, PauseClicked, RewindClicked, PreviousClicked,
NextClicked, EditionSelected, IntervalChanged and ReducedMotionChanged. Rewind,
manual steps, seeking, speed changes and enabling reduced motion pause/reset timing.
Removing reduced motion never resumes automatically. Empty/single collections
cannot play automatically; manual steps remain available with reduced motion.

At most one edition advances per elapsed event; overshoot is discarded to avoid
catch-up bursts. Playback pauses at the end. Play at the last edition restarts at
the first without looping. Invalid identities, intervals or active elapsed values
throw `ZlozError`. Replace the controller when the edition collection changes.

Use `createHistoryReview` for the selected edition and `compareEditions` plus
`zlozHistoryGhosts` for optional comparison. Preserve the working editor and its
Undo. Hosts must cancel subscriptions and reject stale scoped ticks after pause,
model/collection changes, leaving history or lifecycle changes. The workbench
uses a scoped Effect Stream timer with model/run identity, pauses for hidden
pages and live reduced-motion changes, and lets manual inspection take priority.
Playback is session-only and never changes portable document formats.

## Composable playback controls

Core `resolveEditionPlaybackControls` projects the cursor into named actions,
status text and availability reasons. `blockedReason` adds a host restriction on
play/manual navigation; `automaticReason` adds a restriction on automatic play
only. Core reduced-motion and boundary guards remain in force. Pause stays
available while running. Blank reasons retain a nonempty fallback, and labels can
be localized with the `labels` record. `editionLabel` resolves your store's name
without putting edition data inside the cursor.

```ts
import { resolveEditionPlaybackControls } from '@opsydyn/foldkit-zloz';
import { zlozPlaybackControls, zlozPlaybackControl } from '@opsydyn/foldkit-zloz/foldkit';

const context = resolveEditionPlaybackControls(playback, {
  editionLabel: currentEditionName,
  blockedReason: editingReason,
  automaticReason: visibilityReason,
});
const controls = zlozPlaybackControls(h, context, toMessage, {
  renderControl: (action, builder, onEvent) =>
    zlozPlaybackControl(builder, action, onEvent, [builder.Class('my-pill')], [action.label]),
});
```

The Foldkit entry exposes the group composition and individual native helpers
`zlozPlaybackControl`, `zlozPlaybackStatus` and `zlozPlaybackReason`. The component
is unstyled. Customize `renderControl`, `renderStatus`, `renderReason` and
`renderLayout`, or use the helpers independently inside your own frame. Slot
undefined retains a default; null omits a part. `controls` sets an ordered subset
(duplicates are removed); `[]` omits all controls. Frame/status/reason labels are
configurable, and status/reason helpers accept custom children and label options.

Native helpers preserve button types, accessible names, disabled state, reason
descriptions and polite status semantics. Supply a Key through attributes when
composing repeated actions in one parent. Custom HTML can replace them entirely;
its semantics then belong to the consumer. Contexts are view projections, not
permission grants: keep live update guards and host timer/lifecycle handling.
No state, generated DOM IDs, subscription or persistence format is introduced.
The workbench demonstrates custom icon pills, a timeline badge and reason layout
using these same public APIs.

## Edition scrubber and explicit seeking

Core `resolveEditionScrubber` derives ordered entries, current value text and
manual-seek restrictions from the existing playback cursor. Customize names with
`labelEdition`, `formatValueText`, `label` and `emptyLabel`. No ordinal counters
are required in the visible readout. Manual seeking remains available with
reduced motion.

```ts
import {
  resolveEditionScrubber,
  editionScrubberRequest,
  resolveEditionSeek,
  updateEditionPlayback,
} from '@opsydyn/foldkit-zloz';

const context = resolveEditionScrubber(playback, {
  labelEdition: (id) => names.get(id) ?? id,
  blockedReason: editingReason,
});
const request = editionScrubberRequest(context, '3');
// In update: recheck the host session and resolve against current state/policy.
const decision = resolveEditionSeek(playback, request, { blockedReason: editingReason });
if (decision.type === 'ready') playback = updateEditionPlayback(playback, decision.event);
```

Requests carry an edition ID, not a saved array index. Reordering cannot redirect
the request to a different edition. Missing IDs and malformed/out-of-bounds native
values are ignored; no clamping or implicit substitute is chosen. Host vetoes
return a nonempty blocked reason. Applying the ready EditionSelected event pauses
playback and clears elapsed timing. The host projects a read-only review while
preserving the working editor and Undo.

The `/foldkit` entry exposes `zlozEditionScrubber` and individual input, readout,
reason and Open-button helpers. The controlled native range supports browser
keyboard navigation and uses `aria-valuetext` for human labels. Its readout is
non-live to avoid another announcement of each range value. A single edition
locks the range but remains explicitly openable; Open also handles an unchanged
first position while present.

Use `renderInput`, `renderReadout`, `renderReason`, `renderOpen` and `renderLayout`
to replace, omit or rearrange parts. Undefined retains defaults and null omits a
part. Helpers are unstyled, generate no DOM IDs and allow attributes/custom
children/labels. They create no draft selection, timer or persistence format.
Custom HTML owns its own semantics. Hosts must check current identity, policy and
callback lifetime in update; the workbench uses a dedicated seek-session token
that survives continuous seeking but expires on leaving history, returning to
present, collection/model changes or disable/re-enable. Its eight-checkpoint
sample is synthetic demonstration data, not a business change log.

## Composable history comparison controls

Core owns baseline choices and ghost preferences without a renderer or timer:

```ts
import {
  resolveHistoryComparisonControls,
  resolveHistoryComparisonRequest,
  type ZlozHistoryComparisonControlsState,
} from '@opsydyn/foldkit-zloz';

let settings: ZlozHistoryComparisonControlsState = {
  baselineId: 'original',
  ghosts: { enabled: true, nodes: true, edges: true, movements: true },
};
const policy = {
  minimalMode,
  ghostReasons: { edges: 'Edge overlays are managed by this workspace.' },
};
const context = resolveHistoryComparisonControls(editions, viewedEditionId, settings, policy);
// In update, resolve again against current metadata, settings and policy:
const decision = resolveHistoryComparisonRequest(editions, viewedEditionId, settings, {
  type: 'GhostVisibilityToggled',
  part: 'nodes',
});
if (decision.type === 'ready') settings = decision.state;
```

Pass the **same current policy** to both resolvers. `BaselineSelected` carries an
edition ID or explicit null clear. Unknown/self IDs are ignored; stale stored IDs
produce no active baseline without rewriting preferences. Duplicate/blank IDs
and blank names reject with `ZlozError`. `GhostVisibilityChanged` sets an absolute
value; native controls emit `GhostVisibilityToggled` for fresh-state updates.
No-op requests return unchanged; denied requests return blocked with a reason.

Use `context.effectiveGhosts` with `zlozHistoryGhosts`. Minimal mode and the master
switch retain each layer choice. Preferences can be configured before reviewing.
Global `blockedReason`, `baselineReason` and per-part `ghostReasons` protect
controls independently, with visible reasons. Labels and edition names can be
localized through context options.

```ts
import {
  zlozHistoryComparisonControls,
  zlozHistoryGhostToggle,
} from '@opsydyn/foldkit-zloz/foldkit';

const controls = zlozHistoryComparisonControls(h, context, toMessage, {
  renderGhost: (control, builder, onRequest) =>
    builder.label([], [zlozHistoryGhostToggle(builder, control, onRequest), control.label]),
});
```

The optional entry also exports `zlozHistoryBaselineSelect`,
`zlozHistoryComparisonStatus` and `zlozHistoryComparisonReason`. Helpers are
unstyled native controls. Compose individually or customize `renderBaseline`,
`renderGhost`, `renderStatus`, `renderReason` and `renderLayout`. Undefined keeps
defaults; null omits a part. `ghosts` selects/reorders visible layers (duplicates
are removed; [] hides all). Attributes style controls without replacing native
checked/disabled/selection semantics. Custom renderers own any replacement
semantics. Hosts own request lifetimes, comparison data, accessible change lists
and playback interruption; these helpers never edit the graph or Undo.

## Composable history change navigation

`resolveHistoryChangeNavigator(comparison, options)` derives native-control
contexts and a filtered list from `compareEditions`. Options include independent
`filters` for `added`, `removed` and `changed` (all default true), `filterLabels`,
`labelChange`, global `blockedReason` and per-item `focusReason`. Node/edge IDs
have separate namespaces. Counts describe the unfiltered comparison; filtering
never changes the comparison or ghost preferences.

```ts
import { resolveHistoryChangeNavigator, resolveHistoryChangeFocus } from '@opsydyn/foldkit-zloz';
import { zlozHistoryChangeNavigator, zlozHistoryChangeButton } from '@opsydyn/foldkit-zloz/foldkit';

const options = { filters, blockedReason: busyReason };
const context = resolveHistoryChangeNavigator(comparison, options);
const view = zlozHistoryChangeNavigator(
  h,
  context,
  { onFilter, onFocus },
  {
    renderEntry: (entry, builder, focus) =>
      builder.li([], [zlozHistoryChangeButton(builder, entry, focus, [], [entry.summary])]),
  },
);
// In update, recheck current comparison, preferences and policy:
const decision = resolveHistoryChangeFocus(comparison, request, options);
```

Requests carry both edition IDs and entity type/ID. Unknown, stale or filtered-out
requests return ignored; current restrictions return blocked with a visible
reason. A ready decision carries an entry and target. For `side: 'selected'`,
apply `target.event` through `updateHistoryReview` to reveal the current node or
edge, including collapsed ancestors. For `side: 'baseline'`, `target.nodes` are
earlier node/endpoint geometry: fit a camera with
`fitNodes(target.nodes, surface, padding, zoomLimits)`
and apply a `ViewportChanged` navigation event. Never insert these nodes into the
working or review graph. Removed-edge framing uses baseline endpoint nodes;
computed layout routes are outside the portable edition contract.

Hosts own camera measurement, operation policies, callback freshness, optional
playback pause and review projection. Compare requests against the current pair
and host/model scope. Camera focus leaves keyboard focus on the native button;
no DOM focus is performed. Ghost visibility remains independent, including when
focusing a removed item with its ghost hidden.

The optional entry also exports `zlozHistoryChangeFilter`,
`zlozHistoryChangeStatus` and `zlozHistoryChangeReason`. Composition supports
nullable `renderFilter`, `renderEntry`, `renderStatus`, `renderReason`, and a
`renderLayout` hook. Undefined keeps defaults; null omits parts. `filters` in view
options selects/reorders filter **controls**, while core options decide which
changes appear. Custom entries own their list-item semantics. Labels, attributes,
status/reason content and frame/list names are configurable. No generated IDs,
selection cursor, timer, graph edits or persistence format are introduced.

## Typed event-storming relationships

Edges can carry `architecture: EventStormingEdgeArchitecture` independently of
their visible `label` and host-owned `data`. ZLOZ's default process conventions
are:

| Role        | Source       | Target       |
| ----------- | ------------ | ------------ |
| `issues`    | actor        | command      |
| `handles`   | command      | aggregate    |
| `emits`     | aggregate    | domain event |
| `produces`  | command      | domain event |
| `activates` | domain event | policy       |
| `triggers`  | policy       | command      |

DDD aggregate/aggregate-root and domain-event nodes participate alongside
EventStorming notes. An aggregate boundary still needs ordinary ports; an
aggregate root is usually the useful connection endpoint. These are adaptable
modelling conventions, not executable business rules or a universal grammar.

```ts
import {
  createEventStormingPattern,
  createEditor,
  updateEditor,
  resolveEventStormingRelationship,
  eventStormingRelationshipPolicy,
} from '@opsydyn/foldkit-zloz';

const graph = createEventStormingPattern({ includeAggregate: true });
const policy = eventStormingRelationshipPolicy({}, existingHostPolicy);
const decision = resolveEventStormingRelationship(graph, candidateEdge);
// A candidate without architecture can be inferred without changing the graph.
if (decision.type === 'allowed') {
  const typed = { ...candidateEdge, architecture: decision.architecture };
  const next = updateEditor(
    createEditor(graph),
    { type: 'ConnectionCreated', edge: typed },
    policy,
  );
}
```

The resolver returns `allowed` (descriptor, matched rule, inferred flag),
`unrelated` for ordinary untyped connections, or `blocked` with a stable code and
readable reason. It checks semantic roles only. The editor continues to enforce
port direction, duplicates, read-only/gesture state and host policies. Pass the
same live conventions to the resolver, native creation/reconnection chooser and
update path. `eventStormingRelationshipPolicy(options, basePolicy)` preserves
host veto precedence and checks incident links when a node changes role.

Custom rules are first-class and replace the complete default catalogue:

```ts
import {
  eventStormingRelationshipRules,
  eventStormingRelationshipPolicy,
} from '@opsydyn/foldkit-zloz';

const options = {
  rules: [
    ...eventStormingRelationshipRules,
    {
      architecture: { family: 'event-storming', role: 'custom', name: 'delegates' },
      sources: ['command'],
      targets: ['command'],
      label: 'Delegates',
    },
  ],
} satisfies import('@opsydyn/foldkit-zloz').ZlozEventStormingRelationshipOptions;
const policy = eventStormingRelationshipPolicy(options, existingHostPolicy);
```

`roleOf` can interpret custom host nodes; use `eventStormingParticipantRole` as the
default fallback. `eventStormingRelationshipKey` identifies built-in or named
custom descriptors for native controls; descriptions are authored meaning rather
than identity. Rule descriptors must have unique keys, supported nonempty role
sets and nonempty labels. Multiple compatible inference rules produce a blocked
ambiguity reason until the author chooses an explicit descriptor. Empty catalogues
are valid. Structural port and policy checks remain active with custom rules.

Edit an existing relation with `EdgeArchitectureChanged` (`architecture: null`
clears the descriptor). `canChangeEdgeArchitecture` receives previous edge, next
edge and full graph. Edits are undoable, preserve layout routes and do not create
Undo entries for identical descriptors or rejected changes. Legacy untyped edges
need no migration. `isEdgeArchitecture` validates strict reserved syntax; custom
roles require a nonempty name. Graph/snapshot/model version 1 serializes optional
descriptors, while history distinguishes these semantic changes from layout.
Imports and Undo/Redo preserve unresolved drafts; compatibility enforcement is
opt-in and never rewrites a model when conventions change. Older readers may not
understand or enforce the new meaning, so qualify mixed-version roundtrips.

Mermaid reports `edge-fields-omitted` semantic loss for descriptors. Strict loss
policy rejects; report mode projects labels/identity without pretending it can
roundtrip architecture. No executable process, automatic metadata stamping,
semantic side effects or dependency is introduced. The compact
`createArchitecturePattern('event-storming')` remains five notes with typed links;
the detailed factory adds an aggregate root.

## Composable causal relationship controls

Core derives a chooser and explicit inference action from the current editor and
inspector target. Pass current conventions and the same policy used by the editor:

```ts
import {
  resolveEventStormingRelationshipControls,
  resolveEventStormingRelationshipRequest,
  eventStormingRelationshipPolicy,
  updateEditor,
} from '@opsydyn/foldkit-zloz';

const options = {
  conventions,
  policy: eventStormingRelationshipPolicy(conventions, hostPolicy),
  blockedReason: operationReason,
  inferenceLabel: 'Use inferred meaning',
};
const context = resolveEventStormingRelationshipControls(editor, inspectedEdgeId, options);
// In update, use the current target, graph, conventions and policy:
const decision = resolveEventStormingRelationshipRequest(editor, inspectedEdgeId, request, options);
if (decision.type === 'ready') editor = updateEditor(editor, decision.event, options.policy);
```

Requests are `RelationshipSelected` with edge ID and nullable semantic key (null
is an explicit clear), or `InferenceApplied` with edge ID. The resolver rejects
changed inspector targets and unknown keys as ignored; it never converts a stale
choice into a clear. It returns blocked with a reason for current restrictions,
unchanged for an existing key, or a ready `EdgeArchitectureChanged` event. Ready
is not a lasting permission grant: apply through the editor with current policy.
Hosts own model/session callback scope and asynchronous operation restrictions.

Compatibility reasons remain visible independently of enforcement. Omitting the
policy allows unresolved drafts; rendering a chooser never enables convention
validation. Read-only and gesture guards still apply. `blockedReason` adds a host
restriction. `label`, `clearLabel`, `inferenceLabel` and `labelRule` customize
control text. Unfamiliar stored descriptors remain selected as unavailable
current-only options until the host restores their convention or the author
explicitly chooses another meaning. Ambiguous inference requires an explicit
choice. Inference cannot replace authored descriptions for the same semantic key.

```ts
import {
  zlozEventStormingRelationshipControls,
  zlozEventStormingRelationshipSelect,
  zlozEventStormingRelationshipInference,
} from '@opsydyn/foldkit-zloz/foldkit';

const controls = zlozEventStormingRelationshipControls(h, context, toMessage, {
  renderSelect: (context, builder, onRequest) =>
    builder.label(
      [],
      [context.label, zlozEventStormingRelationshipSelect(builder, context, onRequest)],
    ),
  renderInference: (action, builder, onRequest) =>
    zlozEventStormingRelationshipInference(
      builder,
      action,
      onRequest,
      [],
      ['Use inferred meaning'],
    ),
});
```

Individual native helpers also include `zlozEventStormingRelationshipStatus` and
`zlozEventStormingRelationshipReasons`. Composition supports `renderSelect`,
`renderInference`, `renderStatus`, `renderReasons` and `renderLayout`. Undefined
keeps defaults; null omits a part. Frame/status/reasons names, native attributes,
button/status content and wrappers are customizable. Default reasons show both
availability and compatibility; a custom renderer can choose the desired level
of detail. Native disabled/description/value semantics stay model-derived.
Server-rendered options explicitly retain selection, including unavailable stored
values. No generated IDs, new cursor/draft, timer or persistence format is added.

## Read-only causal relationship audit

`auditEventStormingRelationships(graph, options?)` uses the existing convention
resolver for every edge. The same `rules` and `roleOf` options are supported.

```ts
import { auditEventStormingRelationships } from '@opsydyn/foldkit-zloz';

const audit = auditEventStormingRelationships(graph, conventions);
// audit.status: 'compatible' | 'incompatible'
// audit.summary: { edges, typed, inferred, unrelated, blocked }
for (const entry of audit.entries) {
  if (entry.status === 'blocked') console.log(entry.edgeId, entry.code, entry.message);
}
```

Entries have stable edge ID/label, source/target port identity and distinct
`typed`, `inferred`, `unrelated` or `blocked` status. Typed/inferred entries carry a
non-null architecture descriptor and relationship key. Blocked entries preserve
any authored descriptor and the existing resolver code. Ordering is canonical
UTF-16 edge-ID order, independent of graph-array order or process locale.

A compatible report means **no blocked relationships under this convention**;
it does not mean every edge has authored semantic metadata. Inferred meaning is
reported without stamping it into the graph. Unrelated edges remain explicitly
unrelated. Counts include every edge. Empty graphs succeed, while invalid rule
catalogues reject even with no edges. Reports omit host-owned data and callbacks.
The graph and any surrounding editor/Undo state remain untouched.

Use the graph codec for structural validation; this audit is semantic only. The
standalone Effect CLI exposes the same report as `zloz relationships audit`,
including bounded custom JSON rule files. See the
[CLI command contract](../foldkit-zloz-cli/README.md#causal-relationship-audit).

## Edition-aware audit comparison

Compare the current graph, or a chosen edition, against an explicit baseline:

```ts
import { compareModelEventStormingRelationships } from '@opsydyn/foldkit-zloz';

const result = compareModelEventStormingRelationships(
  document,
  { baselineId: 'before', selectedId: 'after' }, // Omit selectedId for current graph.
  conventions,
);
if (result.type === 'compared') {
  const { introduced, resolved, persisting, baseline, selected } = result.comparison;
  // persisting entries retain { before, after }; both sides include full audits.
} else {
  console.log(result.code, result.editionId, result.reason);
}
```

Only editions owned by the supplied model are selectable. Missing IDs return
`unknown-baseline` or `unknown-edition`, with no fallback or implicit lineage
lookup. The model is validated with the existing capture boundary; malformed
documents or rule catalogues throw the existing core error. No document, edition,
camera or Undo history is changed.

Both sides use the same `rules` and pure `roleOf` interpretation. Findings are
blocked entries identified by **edge ID and diagnostic code**. Changed codes
resolve the old finding and introduce the new one; label, endpoint, reason and
presentation changes retain that identity, with both projections visible.
Removed edges resolve findings and renamed IDs introduce findings. These are
diagnostic changes, not proof that removing a relationship repaired the design.
Typed, inferred and unrelated entries are preserved in the full audits but do
not become findings. Arrays retain canonical edge-ID order.

The report includes model ID, explicit edition/current source references,
`summary: { introduced, resolved, persisting }` and status `regressed` or
`no-new-findings`. **No new findings does not mean compatible**: existing blocked
relationships may persist. Comparing an edition to itself is valid and retains
its existing findings as persisting. No serialization format is changed.

## Composable audit comparison controls

The package also supplies a pure control context and request resolver. Keep this
small state in your host model, independently of its visible history camera:

```ts
import {
  resolveAuditComparisonControls,
  resolveAuditComparisonRequest,
  type ZlozAuditComparisonState,
  type ZlozAuditComparisonControlsOptions,
} from '@opsydyn/foldkit-zloz';

const state: ZlozAuditComparisonState = {
  baselineId: 'before',
  selectedId: null, // Current graph; an edition ID explicitly selects that snapshot.
  filters: { introduced: true, resolved: true, persisting: true },
};
const options: ZlozAuditComparisonControlsOptions = {
  ...conventions,
  blockedReason: busyReason,
  focusReason: (item) => (canInspect(item) ? null : 'Inspection is protected.'),
};
const context = resolveAuditComparisonControls(document, state, options);
const decision = resolveAuditComparisonRequest(document, state, request, options);
// ready: store decision.state
// focus: apply decision.event to the editor for decision.source
// blocked: show decision.reason; ignored: retain the current model
```

`context.comparison` retains the full audit delta even when filters hide entries.
No baseline gives an explicit unavailable reason; missing stored choices remain
visible in the native selectors. Sources are model-owned editions or the current
graph. Resolved findings reveal the baseline. Introduced and persisting findings
reveal the target; persisting entries also carry `previous` for custom displays.
Same-edition comparisons are allowed. Control state is transient and does not
change document serialization.

Focus requests carry model, comparison, category, edge and diagnostic identity.
The resolver recomputes findings and rechecks filters and protection before
returning a source plus an ordinary `EdgeRevealRequested` event. It never changes
the graph, camera, selection, playback or Undo itself. Hosts should add an epoch
check across model replacements/async operations, pause playback for explicit
navigation, and apply the event to the selected source editor. A historical source
should be opened read-only rather than copied into the working graph. Filters
remain usable while other controls are protected.

The optional Foldkit composition is unstyled and supports custom cards/badges:

```ts
import { zlozAuditComparisonControls, zlozAuditFindingButton } from '@opsydyn/foldkit-zloz/foldkit';

const controls = zlozAuditComparisonControls(h, context, toMessage, {
  showCounts: false,
  renderStatus: () => null,
  renderEntry: (entry, builder, onRequest) =>
    builder.li(
      [],
      [
        zlozAuditFindingButton(
          builder,
          entry,
          onRequest,
          [],
          [builder.strong([], [entry.kind]), ` ${entry.label}`],
        ),
      ],
    ),
});
```

Individual helpers are `zlozAuditEditionSelect`, `zlozAuditFindingFilter`,
`zlozAuditFindingButton`, `zlozAuditComparisonStatus` and
`zlozAuditComparisonReason`. Attributes, text, control names, filter order/subsets,
selectors, entries, status, reason and layout are customizable. Undefined keeps
default parts; null omits them. Custom entries own list-item semantics. The native
helpers retain model-derived selection, protection and descriptions. `showCounts`
hides numeric filter and status readouts without changing preferences. Hosts can
bind it to diagnostics or minimal mode and omit status through its render slot.
Rendering preferences do not replace functional protection policies.

<a id="ddd-relationship-contracts-unreleased"></a>

## DDD relationship contracts

DDD meaning is an optional reserved edge descriptor, independent of label, shape
and host-owned data. The root exports `DddEdgeArchitecture`,
`ZlozDddRelationship`, `ZlozDddRelationshipRule`,
`ZlozDddRelationshipOptions`, `ZlozDddRelationshipDecision`,
`isDddEdgeArchitecture`, `dddRelationshipRules`, `dddRelationshipKey`,
`resolveDddRelationship` and `dddRelationshipPolicy`.

```ts
import {
  resolveDddRelationship,
  dddRelationshipPolicy,
  updateEditor,
  type DddEdgeArchitecture,
} from '@opsydyn/foldkit-zloz';

const architecture: DddEdgeArchitecture = {
  family: 'ddd',
  scope: 'strategic',
  role: 'upstream-downstream',
  upstream: ['open-host-service', 'published-language'],
  downstream: 'anti-corruption-layer',
};
const decision = resolveDddRelationship(graph, {
  sourceNodeId: 'orders',
  targetNodeId: 'billing',
  architecture,
});
// On a real edge with valid output/input ports; host vetoes still apply.
const policy = dddRelationshipPolicy({}, hostPolicy);
const next = updateEditor(
  editor,
  {
    type: 'EdgeArchitectureChanged',
    id: 'orders-to-billing',
    architecture,
  },
  policy,
);
```

| Scope     | Built-in meaning                       | Default participant convention                                                         |
| --------- | -------------------------------------- | -------------------------------------------------------------------------------------- |
| Tactical  | references                             | entity/value object/aggregate root/domain service → entity/value object/aggregate root |
| Tactical  | contains                               | aggregate/aggregate root/entity/value object → entity/value object/aggregate root      |
| Tactical  | emits                                  | aggregate/aggregate root/entity/domain service → DDD domain event                      |
| Tactical  | persists                               | repository → entity/aggregate root                                                     |
| Tactical  | uses                                   | entity/aggregate root/domain service → domain service/repository                       |
| Strategic | partnership, shared-kernel             | two distinct bounded contexts; symmetric                                               |
| Strategic | upstream-downstream, customer-supplier | source upstream/supplier → target downstream/customer                                  |

These tactical roles are ZLOZ conventions, not a universal DDD grammar. A
`contains` annotation does not assign `parentId`, and influence direction is not
necessarily message/data flow. Directional strategic roles optionally accept a
nonempty, duplicate-free upstream list of `open-host-service` and
`published-language`, and one downstream choice of `conformist` or
`anti-corruption-layer`. Symmetric roles do not accept side fields. List order is
retained as authored. Description is optional on every descriptor. Reserved fields
reject unknown keys, mixed scopes and misplaced side roles. `isEdgeArchitecture`
recognizes both supported families; use `isDddEdgeArchitecture` or
`isEventStormingEdgeArchitecture` to narrow a family-specific consumer.

Named custom meaning uses `{ family: 'ddd', scope, role: 'custom', name }`.
Supply a complete replacement `rules` catalogue to recognize it, including
allowed DDD participant roles, label and directed/symmetric interpretation. Keys
include scope, so tactical and strategic names do not collide. Custom rules cannot
change the direction of a built-in pattern or mix strategic and tactical roles.
Unknown custom descriptors remain portable; the current convention returns an
explicit blocked reason. No inference writes meaning onto untyped connections.

Logical validation references node IDs and can inspect portless aggregate/context
frames. It does **not** create an edge, attach a port, serialize a second relation
store or relax graph validity. Persisted graph edges still need real output/input
ports. Use connectable bounded-context cards for strategic edges today; frame
projection and context-map renderers/starters are subsequent slices.

`dddRelationshipPolicy(options, base)` is opt-in and composes host vetoes with
creation/reconnection, edge-meaning and incident node-role checks. Untyped and
other-family edges remain outside that grammar. Compose with
`eventStormingRelationshipPolicy` in either order. Causal controls display existing
DDD meaning as protected and never infer over or clear it. Clearing via the normal
edge edit is explicit and undoable. Import and Undo/Redo preserve snapshots even
when a later modelling convention changes. Read-only and gesture guards remain.

Graph/snapshot/edition/model envelopes remain v1. Role lists are detached at the
edit boundary; equal descriptors do not create an Undo step or increment revision.
Meaning changes appear in edition comparison. Old readers may reject unfamiliar
DDD descriptors; equal format versions do not promise old-reader semantics.

Mermaid retains ordinary geometry/endpoints but reports omitted DDD meaning;
strict export rejects losses. Review packets preserve the full descriptors in
snapshots. Their existing relationship audit remains **EventStorming-only**:
DDD edges are unrelated to that audit, not certified compatible DDD models. No new
DDD CLI audit, renderer, context-map pattern, publication or deployment is included.
See [ADR 0038](../../docs/adr/0038-define-ddd-relationship-contracts.md).

<a id="composable-context-maps-unreleased"></a>

## Composable context maps

The headless root exports `createContextMapPattern` and
`resolveContextMapRelationship`, plus `ZlozContextMapRelationship`,
`ZlozContextMapParticipant` and `ZlozContextMapBadge`. The detached starter has four
ordinary ported bounded-context cards and examples of upstream/downstream,
customer/supplier, shared kernel and partnership. `createArchitecturePattern('context-map')`
uses the same factory; `insertPattern` retains its existing policy, remapping and
one-Undo transaction.

```ts
import { createContextMapPattern, resolveContextMapRelationship } from '@opsydyn/foldkit-zloz';
import {
  zlozView,
  zlozContextMapConnector,
  zlozContextMapLabel,
} from '@opsydyn/foldkit-zloz/foldkit';

// In view: resolve from the current displayed graph, including read-only review.
const meanings = new Map(
  editor.graph.edges.flatMap((edge) => {
    const relationship = resolveContextMapRelationship(editor.graph, edge);
    return relationship ? [[edge.id, relationship] as const] : [];
  }),
);
const canvas = zlozView(h, editor, {
  id: 'context-map',
  label: 'Context map',
  onEvent,
  renderEdge: (context, h) => {
    const meaning = meanings.get(context.edge.id);
    return meaning ? zlozContextMapConnector(h, context, meaning) : undefined;
  },
  renderEdgeLabel: (context, h) => {
    const meaning = meanings.get(context.edge.id);
    return meaning ? zlozContextMapLabel(h, context, meaning, onEvent) : undefined;
  },
});
```

`resolveContextMapRelationship(graph, edge, conventions?)` returns null outside
strategic DDD meaning. It derives pattern, intended directed/symmetric/unknown
presentation, source/target names, full side-role badge descriptions and any
restriction from the existing DDD convention. Custom catalogues are supported.
Unknown custom meanings have no assumed arrow direction. A known builtin omitted
from the current convention still shows its authored direction plus an explicit
restriction. This is presentation of intent, not a DDD audit or technical data flow.

The optional entry also exports `zlozContextMapParticipant`,
`ZlozContextMapConnectorOptions`, `ZlozContextMapLabelOptions`,
`ZlozContextMapParticipantOptions` and `ZlozContextMapLabelParts`. All use the host
builder and existing theme variables. Use `edgeAppearance` for color/width/dashes;
connectors share the resolved geometry and preserve native hit targets. Symmetric
links have no arrow by default. Marker override and a nullable custom path renderer
are explicit choices. Supply matching current edge/relationship contexts.

Label pattern, authored name, both participants, reason and layout are replaceable
or nullable. Participant name/badge renderers and attributes allow custom visual
language. Parts inside the native edit action must be inert; use the existing
`renderEdgeLabelEditor` hook for interactive forms. Native actions respect read-only
and selection restrictions, with full side-role accessible descriptions. Semantic
badges do not depend on numeric diagnostics; omit parts deliberately through view
configuration when desired.

Custom label callbacks can render unlabeled, unselected and read-only edges.
Returning undefined preserves previous default visibility; null suppresses content.
A missing geometry label anchor still suppresses the label. No placeholder label
or document edit is required to display semantics. Rendering does not change
source/target, graph data, Undo, selection or policies. DDD validation remains
separately opt-in. Context cards have real ports; portless-frame projection and
storage remain outside this slice. The workbench demonstrates both themes and a
presentation toggle that retains the authored model. No publication or deployment.
See [ADR 0039](../../docs/adr/0039-compose-context-map-presentation.md).

<a id="composable-ddd-relationship-controls-unreleased"></a>

## Composable DDD relationship controls

The headless root exports `resolveDddRelationshipControls` and
`resolveDddRelationshipRequest`. Context, options, request/decision, choice,
upstream/downstream role and control types are public `ZlozDdd*` contracts. The
optional Foldkit entry exports `zlozDddRelationshipControls`,
`zlozDddRelationshipPatternSelect`, `zlozDddUpstreamRole`,
`zlozDddDownstreamRoleSelect`, `zlozDddRelationshipStatus`,
`zlozDddRelationshipReasons`, `ZlozDddRelationshipControlsViewOptions` and
`ZlozDddRelationshipControlsParts`.

```ts
import {
  resolveDddRelationshipControls,
  resolveDddRelationshipRequest,
  dddRelationshipPolicy,
  updateEditor,
} from '@opsydyn/foldkit-zloz';
import { zlozDddRelationshipControls } from '@opsydyn/foldkit-zloz/foldkit';

const options = { policy: dddRelationshipPolicy(conventions, hostPolicy), conventions };
const context = resolveDddRelationshipControls(editor, inspectedEdgeId, options);
const controls = zlozDddRelationshipControls(h, context, onRequest, {
  renderStatus: () => (minimalMode ? null : undefined),
});
// In the host update, recheck current editor/inspector and live options:
const decision = resolveDddRelationshipRequest(editor, inspectedEdgeId, request, options);
if (decision.type === 'ready') {
  const nextEditor = updateEditor(editor, decision.event, options.policy);
}
```

Requests carry edge identity and editor revision plus a pattern key or side-role
intent. They never carry a saved descriptor or permission result. Changed graph
revision (including Undo/Redo), missing/replaced inspector targets and unknown
choices return ignored. Current read-only, gestures, host busy reasons and policy
vetoes return blocked with a reason. Hosts additionally check their model/session
identity and active inspector, then apply ready events immediately with the same
policy. A ready result is not authorization for a later or different editor.

Pattern choices expose `compatibilityReason` independently of permission `reason`.
Only the supplied editing policy enforces conventions; display never silently
turns validation on. Custom catalogues and labels are supported. Stored unknown
custom meaning stays visible as a current-only choice. An explicit clear removes
DDD meaning; foreign EventStorming descriptors are protected from this inspector.
No DDD inference or automatic family conversion is performed.

Pattern changes retain authored description. Directional-to-directional changes
preserve authored side roles, including **absence** rather than injecting catalogue
defaults. Explicit symmetric/tactical/custom transitions remove unsupported side
fields as the same undoable edit. Upstream checkboxes preserve role ordering;
removing the last role removes the field. Downstream offers an explicit None.
Same-value changes are no-ops. Existing canonical codecs, semantic comparison and
Undo/Redo own the resulting graph behavior; there is no independent form draft.

Native helpers retain selected values, keyboard semantics, disabled state and
accessible reasons. Pattern, each upstream role, downstream, status, reasons and
layout have independent replace/omit seams; undefined retains defaults, null omits
a part. Helper attributes and label options allow custom presentation. Functional
editing/reasons do not depend on numeric diagnostics. Keep custom callbacks pure;
control state and callback lifetime belong to the host.

The workbench exposes a custom composition in **Inspect**, with a switchable
Orders–Billing meaning-edit veto in the real host policy. Protection also covers
direct metadata events. Read-only history and stale model/epoch/revision requests
cannot change working content. No new codec, dependency, audit/CLI command,
publication or deployment. See [ADR 0040](../../docs/adr/0040-compose-ddd-relationship-editing-controls.md).

### EventStorming-to-DDD mapping preview

`previewEventStormingDddMapping` is a pure, headless advisory API. It inspects
EventStorming notes and incident edges in graph order and returns `nodes`, `edges`
and prospective `disclosures`. Each decision carries the original descriptor, its
source ID and a human-readable reason. It never changes the graph or Undo history,
returns no converted graph/event, and makes no editing-permission claim.

```typescript
import { previewEventStormingDddMapping } from '@opsydyn/foldkit-zloz';

const preview = previewEventStormingDddMapping(graph, {
  nodes: [
    { nodeId: 'place-order', architecture: { family: 'ddd', role: 'domain-service' } },
    { nodeId: 'customer', architecture: null }, // retain the workshop actor
  ],
  edges: [
    { edgeId: 'issues-order', architecture: null }, // retain causal meaning
  ],
});

for (const decision of preview.nodes) {
  if (decision.type === 'proposed') {
    console.log(decision.nodeId, decision.architecture, decision.origin);
  } else if (decision.type === 'ambiguous') {
    console.log(decision.nodeId, decision.candidates, decision.reason);
  }
}
console.log(preview.edges, preview.disclosures);
```

Defaults propose a named domain event as a DDD domain event. Commands remain
ambiguous between non-exhaustive aggregate-root/domain-service interpretations;
policies remain ambiguous even with one domain-service candidate. Actors are
unmapped. An explicit valid DDD node choice resolves intent for this preview;
null retains the source. Source descriptions are inherited unless the target
explicitly supplies one. Selecting aggregate on a card rejects: the API does not
create frames, change kind, geometry, parentage or ports.

Only an authored causal `emits` proposes tactical DDD `emits`, and only when the
proposed endpoints satisfy `resolveDddRelationship`. Other causal/custom/untyped
edges stay unmapped unless explicitly chosen or retained. Edge choices can be
`blocked` by endpoint roles or the replacement `relationships.rules` catalogue.
Already-authored DDD edges are checked and retained; workshop choices cannot
remap them. C4 nodes, existing DDD anchors and unrelated edges are left alone.
Duplicate, missing, foreign IDs and malformed choices/catalogues throw `ZlozError`
before returning a preview. Ordinary ambiguity is returned as data.

Every proposed reserved workshop descriptor replacement produces a
`workshop-meaning-replaced` disclosure. This is prospective semantic loss, not a
claim that conversion occurred or is lossless. Source meaning is detached in the
preview, not persisted as provenance. Retaining an edge explicitly makes no DDD
compatibility claim. Recompute after source/choices/conventions change. A future
conversion must independently enforce model identity, freshness, live edit policy,
lifecycle, loss consent, provenance preservation and atomic Undo; this API grants
none of those. UI, conversion and C4 mapping remain separate slices.

### Conversion plans and loss consent

`createEventStormingDddConversionPlan` builds an ephemeral headless review plan from
a complete source document and mapping choices. The host supplies a nonempty
`sessionId` and safe nonnegative `revision`; advance the session when replacing the
source, including reopening identical graph values. The API captures a detached,
deeply frozen source document as `plan.provenance.document`, preserving identity,
camera, graph/host data, editions and fork ancestry. This is review provenance,
separate from the document's `origin`; it is not persisted by the planner.

```typescript
import {
  createEventStormingDddConversionPlan,
  resolveEventStormingDddConversionConsent,
  type ZlozEventStormingDddLossConsent,
} from '@opsydyn/foldkit-zloz';

const source = { document, sessionId: sourceSessionId, revision: editor.revision };
const plan = createEventStormingDddConversionPlan(source, mappingChoices);

if (plan.type === 'blocked') {
  console.log(plan.blockers); // resolve or explicitly retain uncertain meaning
} else if (plan.type === 'reviewable') {
  console.log(plan.changes, plan.preview.disclosures);
  // Only after the host records explicit acceptance of every displayed loss:
  const consent: ZlozEventStormingDddLossConsent = {
    planKey: plan.key,
    accepted: true,
  };
  const review = resolveEventStormingDddConversionConsent(source, mappingChoices, consent);
  console.log(review.type); // consented is a review condition; no Apply occurs
}
```

Unresolved ambiguity, unmapped intent and incompatible edges block the whole plan;
blocked plans expose no partial `changes` list. Explicit null choices retain source
meaning. A resolved plan with replacements is `reviewable`; all-retained or unrelated
sources are `unchanged`. Proposed changes replace reserved descriptors at the same
node/edge IDs. No converted graph, events, new IDs, frames or structural edits are
returned. Retained causal edges make no compatibility claim and may still be vetoed
by a future host policy.

The consent resolver always rebuilds from the current source and mappings. Without
an affirmative record matching the exact plan, it returns `consent-required`.
Pass null to revoke consent. Blockers cannot be bypassed by acceptance. Source
identity/content/camera/editions/ancestry, session/revision, mapping targets and the
effective DDD catalogue are all bound into the key, even when loss IDs are unchanged.
`plan.mappings` retains detached explicit choices and the effective catalogue for
reproducing the review. Keys use exact encoding, so ordering differences can also
invalidate consent conservatively. Keys contain source data: do not log them,
place them in the DOM or treat them as credentials. No portable plan codec or
cryptographic authenticity is claimed.

The planner never writes graph, Undo, document or editions. The source document can
be recovered with the existing model JSON codec, but conversion provenance still
needs a storage decision at the future apply boundary. `consented` is neither
editing permission nor proof of a human decision. A future Apply must recheck live
source/session/revision, policy, lifecycle, Undo, loss consent and provenance
retention atomically. Planning and acknowledgement remain separate from the atomic Apply API below.

### Atomic Apply and portable provenance

`applyEventStormingDddConversion` rebuilds the plan from the live editor and current
source document/session. It requires exact source graph, camera and revision,
resolved mappings, explicit all-loss consent, enabled Undo and current lifecycle
and policy checks. No-op returns the same editor without a receipt. Expected vetoes
return `blocked` with the original editor; malformed input or a throwing host policy
throws without publishing a partial edit.

```typescript
import {
  applyEventStormingDddConversion,
  captureModelDocument,
  serializeEventStormingDddConversion,
} from '@opsydyn/foldkit-zloz';

const liveSource = {
  document: captureModelDocument({
    ...document,
    snapshot: { graph: editor.graph, viewport: editor.viewport },
  }),
  sessionId: currentSourceSessionId,
  revision: editor.revision,
};
const result = applyEventStormingDddConversion(editor, liveSource, {
  mappings: reviewedMappingChoices,
  consent: recordedLossConsent, // affirmative exact-plan record, or null
  policy: currentEditingPolicy,
  blockedReason: currentHostBusyReason, // e.g. pending import/layout/external draft
});
if (result.type === 'applied') {
  // Publish both values in one host Model update; run storage/export in a Command.
  const nextEditor = result.editor;
  const conversion = result.conversion;
  const portableProvenance = serializeEventStormingDddConversion(conversion);
}
```

Only reserved architecture descriptors change. Node/edge IDs, ports, wiring,
parentage, labels, geometry, appearance and host data survive. The result has one
new graph Undo step; Undo restores the whole source graph and Redo restores the
whole converted graph. Camera and surviving selection remain. Model identity/name,
editions and fork `origin` are preserved in the returned target document.

`canApplyEventStormingDddConversion(plan, targetDocument)` can veto the complete
transaction using its fully validated final state. Existing
`canChangeNodeArchitecture` / `canChangeEdgeArchitecture` hooks then check every
replacement with their normal **current graph** contract. All callback inputs are
detached frozen values. A strict source-oriented semantic policy may reject an
otherwise valid target; the whole-transaction hook offers final-state inspection,
not an override of granular vetoes. Policies must remain pure and synchronous.
Read-only, active gestures/connections/label drafts/camera fits and host busy reasons
block conversion. Hosts supply current session/metadata and external busy conditions;
no cached consent, plan or imported receipt grants permission.

`result.conversion` is an immutable, unsigned receipt with the complete original
source, effective mappings, loss-acceptance claim and converted document. Keep or
export the **entire receipt** to retain provenance. Saving only
`conversion.document` as model JSON omits conversion receipts. The package performs
no file/storage write. Hosts publish editor and receipt together, then persist them
through their own Command/adapter. Graph Undo does not erase the historical receipt.

`serializeEventStormingDddConversion` and `parseEventStormingDddConversion` use an
independent `foldkit-zloz-ddd-conversion` v1 envelope. Parsing validates both model
v1 documents, mappings and exact descriptor-only target consistency. It rejects
unknown versions/fields, missing acknowledgement, unresolved mappings and extra
changes such as renamed nodes or altered model metadata. It never applies edits or
proves a human/author identity. Existing graph/model/edition formats stay unchanged;
fork ancestry is never used to store conversion provenance. Receipt size and source
validation cost are unqualified for large models. The workbench Apply control remains
a separate slice.

### Previous/Next change traversal

`resolveHistoryChangeStep(comparison, current, direction, options)` composes the
public change navigator and focus resolver. `current` is a
`ZlozHistoryChangeCursor` (`{ entity, id }`) or `null`; `direction` is `'previous'`
or `'next'`. Next starts with the first visible entry when no change is focused.
First/last boundaries stop without wrapping. Filters, current membership and live
focus vetoes are rechecked, and unavailable candidates are never silently skipped.
The result is the existing `ZlozHistoryChangeFocusDecision`; hosts own the cursor
and apply ready targets to the appropriate detached review.

```ts
import { resolveHistoryChangeStep } from '@opsydyn/foldkit-zloz';

const step = resolveHistoryChangeStep(comparison, current, 'next', options);
if (step.type === 'ready') {
  // Store the identity after focusing step.target in the comparison's review.
  const cursor = { entity: step.entry.entity, id: step.entry.id };
}
```

For a Before/After UI, orient the comparison so the chosen side is its selected
edition, and retain that orientation when stepping. Hosts should also reject
stale receipt, side and cursor callbacks. The helper performs no graph edits,
persistence or DOM focus changes.

<a id="headless-modelling-patches-and-dry-runs-unreleased"></a>

## Headless modelling patches and dry runs

A modelling patch is a data-only graph proposal. It carries a patch ID, exact
expected source graph, model/session identity, monotonic revision, unsigned
provenance and six explicit operations:

| Operation                   | Payload         | Preconditions       |
| --------------------------- | --------------- | ------------------- |
| `node.add` / `node.replace` | complete `node` | ID absent / present |
| `node.remove`               | `nodeId`        | ID present          |
| `edge.add` / `edge.replace` | complete `edge` | ID absent / present |
| `edge.remove`               | `edgeId`        | ID present          |

Each operation also has its own unique `id`. One operation per entity kind/ID is
allowed; there is no upsert, recursive merge, rename or implicit cascade. Replacing
an entity keeps its existing index; additions append in operation order. The final
combined graph is validated, so additions may refer to other additions regardless
of operation order. Removing a group/node requires explicit child/edge changes to
leave a valid graph. No geometry, IDs, ports or architecture meaning are repaired.

```ts
import { captureModellingPatch, dryRunModellingPatch } from '@opsydyn/foldkit-zloz';

const proposal = captureModellingPatch({
  format: 'foldkit-zloz-patch',
  version: 1,
  id: 'clarify-orders',
  source: { modelId, sessionId, revision: editor.revision, graph: editor.graph },
  provenance: {
    actor: { kind: 'human', id: 'reviewer' },
    reason: 'Clarify the context name.',
    references: [{ kind: 'review-packet', id: 'review-1' }],
  },
  operations: [
    { id: 'rename', type: 'node.replace', node: { ...orders, label: 'Order management' } },
  ],
});
const preview = dryRunModellingPatch(
  { modelId, sessionId, revision: editor.revision, graph: editor.graph },
  proposal,
  { canChange: (change) => (lockedIds.has(change.id) ? 'Owner review required.' : null) },
);
if (preview.type !== 'rejected') {
  // Exact detached/frozen prospective graph, before/after changes and loss disclosure.
  console.log(preview.type, preview.graph, preview.changes, preview.losses, preview.findings);
}
// The original editor, graph, camera, Undo and editions are untouched.
```

`captureModellingPatch(input)` validates an object and returns a deeply frozen
owned proposal. Invalid input throws `ZlozError`. Dry run returns `rejected` with
structured findings and no candidate for malformed/stale/conflicting/invalid
proposals. Valid proposals return `reviewable` or `blocked` with the complete
candidate, provenance, changes, losses and findings. Protection does not hide the
proposal. Empty/equal proposals report `no-op`; additions-only fields cause no loss.
Removals disclose the entity; replacements disclose every overwritten/omitted
prior top-level field, including geometry, ports, metadata and semantics. These
conservative losses are disclosure, not conversion-loss acceptance.

The current source is supplied separately by the host. Model ID, session ID,
revision and complete graph must match. Object key order is insignificant; array
order remains meaningful. Use a unique session ID on editor/model replacement and
retain the editor's monotonic revision through Undo. Camera/selection/navigation,
editions and Undo are outside patch data. Provenance (`actor`, `reason`, data-only
`references`) is unsigned attribution, never permission, authentication or lineage.

Optional `blockedReason`, per-change `canChange` and whole-candidate `canPatch`
are live pure **review** policies with frozen arguments. Any string blocks,
including an empty string; null/undefined permits. Policy exceptions propagate.
These do not automatically evaluate `EditorPolicy` or run domain convention audits.
Architectural correctness remains a separate assessment. A preview never grants Apply
permission. The guarded Apply and composable controls below rebuild and recheck
live source, lifecycle, granular policies and exact-content acknowledgement before
one Undo commit with retained provenance. The Effect CLI exposes dry run only.

The object boundary permits only bounded plain JSON data: at most 1,000 operations,
depth 64, 100,000 JSON values and 2,000,000 total characters in strings/keys. It
rejects accessors, functions, undefined, non-finite values, cycles, symbols, custom
prototypes and sparse arrays. Envelope fields are exact; graph payload extensions
remain data-only under existing graph validation. Invalid current-host source is
a configuration error and throws. For raw text, use `parseModellingPatch` below to preserve duplicate-key and
framing checks before capture. File/stdin transports still own byte limits and
fatal UTF-8 decoding. There is no wall-clock, authenticity or hostile-JavaScript-
object isolation guarantee.

See [ADR 0060](../../docs/adr/0060-preview-bounded-modelling-patches-before-apply.md),
[literal proposal](test/fixtures/modelling-patch-v1.json),
[actual dry-run results](evidence/modelling-patch-example.json) and
[qualification](evidence/modelling-patch.md). PNG is implemented below; Alchemy remains separately scoped.

<a id="strict-versioned-patch-decoding-unreleased"></a>

## Strict versioned patch decoding

```ts
import { parseModellingPatch, dryRunModellingPatch } from '@opsydyn/foldkit-zloz';

const decoded = parseModellingPatch(fileText);
if (decoded.status === 'parsed') {
  // Detached, deeply frozen proposal data. No source freshness or editing permission implied.
  const preview = dryRunModellingPatch(currentSource, decoded.value, reviewPolicy);
  console.log(preview);
} else {
  console.log(decoded.code, decoded.reason, decoded.path);
}
```

`parseModellingPatch` accepts exactly one raw `foldkit-zloz-patch` v1 document.
It returns `ZlozModellingPatchParseResult`: `parsed` with `value`, or `rejected`
with a stable code, readable reason and JSON Pointer path (empty for root).
Codes are `invalid-json`, `limit-exceeded`, `unsupported-format`,
`unsupported-version` and `invalid-patch`. Core graph validation errors may point
to root; envelope/payload and scanner errors retain more specific paths.

A bounded grammar preflight runs before constructing the complete JSON value.
It rejects duplicate **decoded** property names at every depth, including metadata
and escaped names such as `version` / `\u0076ersion`. It checks strings/escapes,
JSON-only whitespace, number syntax, finite numeric values and a single-document
frame. Comments, BOM, trailing commas/documents and non-JSON whitespace reject.
Distinct Unicode keys retain their distinct values. No reviver or executable
content is used. Native JSON.parse constructs the value after preflight, then
`captureModellingPatch` owns exact schema/source/payload/provenance validation
and frozen detachment. Existing patch and model wire formats are unchanged.

`ZlozModellingPatchParseOptions` can tighten these limits:

| Option          | Default and maximum | Meaning                                           |
| --------------- | ------------------- | ------------------------------------------------- |
| `maxCharacters` | 2,000,000           | UTF-16 code units, including whitespace/escapes   |
| `maxDepth`      | 64                  | Value depth, root zero; includes primitive leaves |
| `maxValues`     | 100,000             | Containers and values, excluding property names   |

Configured limits must be positive safe integers within the v1 caps; invalid
configuration throws `ZlozError`. The fixed 1,000-operation cap also reports
`limit-exceeded` at `/operations`. Limits cannot relax the object validator's
budgets. They bound traversal, not input bytes, peak memory or wall-clock time.
File/stdin hosts must enforce UTF-8 byte limits, fatal decoding and cancellation.

This decoder does not unwrap CLI response envelopes or accept a model archive,
review packet or conversion receipt. It establishes proposal validity, not a
valid prospective graph or current source authority. Missing targets, conflicting
operations, final graph invariants, stale source, review policies and losses are
checked by the separate dry run. The guarded Apply API below and Effect CLI dry
run consume this decoder; decoding itself grants neither mutation nor consent.

See [ADR 0061](../../docs/adr/0061-decode-versioned-modelling-patch-text-strictly.md),
[literal fixture](test/fixtures/modelling-patch-v1.json) and
[decoder qualification](evidence/modelling-patch-parse.md).

<a id="reviewed-modelling-patch-apply-unreleased"></a>

## Reviewed modelling-patch Apply

`resolveModellingPatchReview` composes the live editor, host identity and proposal.
It returns the dry-run preview, an exact-content review key, protection reason,
acknowledgement and Apply availability. `resolveModellingPatchAcknowledgement`
accepts a matching `AcknowledgementChanged` request from the review controls.
`applyModellingPatch` rebuilds the current source and checks everything again.

```ts
import {
  resolveModellingPatchReview,
  resolveModellingPatchAcknowledgement,
  applyModellingPatch,
} from '@opsydyn/foldkit-zloz';

// Identity belongs to the current host model/session, not the imported proposal.
const identity = { modelId: model.id, sessionId: editorSessionId };
const review = resolveModellingPatchReview(editor, identity, proposal, {
  consent,
  policy: editingPolicy,
  blockedReason: busyReason,
});
// On the explicit acknowledgement fact emitted by the package controls:
const nextConsent = resolveModellingPatchAcknowledgement(review, request);
// On a separate Apply action, synchronously use the live editor/identity/policies:
const result = applyModellingPatch(editor, identity, proposal, {
  consent: nextConsent,
  policy: editingPolicy,
  blockedReason: busyReason,
});
if (result.type === 'applied') {
  // Publish these together in one parent Model update, without an intervening await.
  const next = { ...model, editor: result.editor, receipts: [...model.receipts, result.receipt] };
}
```

The review key binds the complete canonical patch, source/provenance and target;
patch ID alone cannot authorize a changed proposal. Acknowledgement explicitly
covers proposed changes and disclosed losses. Apply rejects stale or protected
source, read-only/busy editing, disabled Undo, exhausted revision or missing exact
acknowledgement, returning the original editor by reference. Existing mutation
policies cover meaning, outlines, waypoints, movement/membership, resize, port
edits, connection/reconnection and complete deletion. Review `canChange` / `canPatch`
hooks cover other authored fields. Callbacks receive frozen values; selection and
snapping preferences remain interaction-only. New connections are checked on the
validated target graph; target-only reconnections retain unchanged source policy
semantics. A denied later operation never partially applies earlier ones.

Success commits the whole graph once, adds one Undo and returns a frozen
`foldkit-zloz-patch-receipt` v1 with the exact proposal/source/provenance, target,
result revision and explicit review/loss acknowledgement. Undo/Redo restores the
whole source/target; receipt retention is host-owned and independent. Empty/equal
patches return `unchanged` without history or receipt. Imported previews, receipts
and unsigned actor claims are not permission. There is no CLI Apply.

The optional `/foldkit` entry exports `zlozModellingPatchReview`,
`zlozModellingPatchAcknowledgement`, `zlozModellingPatchApply` and view/parts types.
Native defaults show provenance, expandable source identity and before/after
values, findings, explicit acknowledgement, Apply and live reasons. Nullable
summary/finding/change slots, layout, attributes and action helpers support custom
controls. `showCounts` / `instructions` support minimal diagnostics independently
of functional loss/protection disclosure. The workbench demonstrates native and
custom controls in its left sidebar, bounded file reading, a live-source starter,
receipt retention/download and one Undo with the original canvas always visible.

See [ADR 0062](../../docs/adr/0062-complete-reviewed-patch-cli-and-atomic-apply.md)
and [completion evidence](../../apps/zloz-demo/evidence/p2-completion.md).

<a id="reviewed-png-export-unreleased"></a>

## Reviewed PNG export

The root entry exports pure `planPngExport`, `createPngReview`, `pngReviewForScope`,
`resolvePngReview` and `updatePngReview`. PNG reuses SVG bounds/model/viewport,
scale, light/dark tokens, backgrounds, typed renderer adapters and validated font
resources. All SVG findings remain visible; flattening vectors/text/model meaning
is an additional consent-controlled loss. Custom HTML is reported through SVG
renderer declarations, never silently captured from the DOM.

```ts
import { createPngReview, resolvePngReview, updatePngReview } from '@opsydyn/foldkit-zloz';
import { renderPngExport, downloadPngArtifact } from '@opsydyn/foldkit-zloz/browser';

const review = resolvePngReview(state, context);
// Handle an explicit acceptance fact first; request the render separately.
const step = updatePngReview(state, context, {
  ...review.identity,
  type: 'PngRenderRequested',
});
// In a host Command, when step.payload is present:
// const result = await renderPngExport(step.payload.input, { signal });
// Dispatch PngRenderSettled with payload identity, run and result to updatePngReview.
// A separate PngDownloadRequested returns step.download for a host Command:
// downloadPngArtifact(step.download.artifact, step.download.fileName);
```

`state` is created with `createPngReview(context.scope)`; the context supplies the
live snapshot, revision, scope, title, theme and renderer declarations, plus optional
choices, font resources, filename, pixel budgets and protection callback. The
`/foldkit` entry provides `zlozPngReview`, `zlozPngPreview`, `zlozPngAction` and
nullable settings/preview/findings/acceptance/render/download/status/readout/layout
slots. Minimal diagnostics hide measurements/instructions without hiding findings
or protection. Wire the pure lifecycle to your parent Model; browser work belongs
in Commands. Source/settings/model changes invalidate acceptance and results;
late/cancelled/previous-generation replies cannot publish. Live protection is
checked again at completion/download. Export never mutates the graph or Undo.

The optional `/browser` entry is safe to import under Node/SSR and has no required
Foldkit/Effect dependency; rendering there returns `unsupported`. It accepts only
canonical snapshots and safe SVG options/adapters, rebuilds the SVG and checks an
optional `expectedSvg`. Direct rendering requires `writing.allowLosses: true` after
reviewing findings (the review controller supplies this). It uses browser image,
canvas and PNG encoding, returns the actual encoded PNG data URL and checks MIME,
signature, IHDR dimensions and byte budget. Preview/download share identical bytes.
Native decode/context/encode/output failures, abort and timeout are explicit results.

Default/hard caps: dimension 8192/16384, pixels 8,388,608/16,777,216, PNG bytes
8,388,608/33,554,432. Dimensions round upward; device pixel ratio is not implicitly
applied. Default timeout is 10s, maximum 30s. Buffers, SVG URLs and handlers are
released on every outcome. Cancellation discards pending results; native browser
work may finish later. These bounds do not guarantee peak memory, exact glyph
shaping, identical browser pixels or server/CLI PNG rendering. System-font fidelity
remains reported uncertainty. See [ADR 0063](../../docs/adr/0063-rasterize-reviewed-model-artwork-as-png.md)
and [browser/download evidence](../../apps/zloz-demo/evidence/png-export.md).

<a id="read-models-and-declared-consumption-unreleased"></a>

## Read models and declared consumption

`{ family: 'ddd', role: 'read-model' }` is a native ordinary-node descriptor for an
explicitly authored query-oriented representation. `architectureNodePresets`,
`createArchitectureNode`, the optional `zlozDddNode` renderer and its existing
content/appearance slots support it. It is not a group or a prescribed database
shape. The role does not make the diagram node read-only; normal editor permissions
and host policies still govern authoring.

```ts
import {
  resolveDeclaredConsumption,
  dddRelationshipPolicy,
  type ZlozDeclaredConsumption,
} from '@opsydyn/foldkit-zloz';

// graph has explicit DDD aggregate/root, domain-event or read-model source
// and a DDD read-model consumer, with these authored IDs.
const declaration: ZlozDeclaredConsumption = {
  sourceNodeId: 'account',
  consumerNodeId: 'account-balance',
};
const decision = resolveDeclaredConsumption(graph, declaration);
if (decision.type === 'allowed') {
  // A detached frozen logical source → target relationship, with no ports.
  // decision.relationship.architecture is {family:'ddd',scope:'tactical',role:'feeds'}.
  // decision.sourceRole distinguishes aggregate, aggregate-root,
  // domain-event and read-model declarations. No event set is inferred.
}
const policy = dddRelationshipPolicy();
// Use policy with existing editor events and relationship controls to check the
// actual edge, live source and host protections. Resolution is not permission.
```

`isDeclaredConsumption` checks the strict two-ID logical descriptor. Missing nodes,
unsupported families or incompatible roles return explicit rejection codes.
`declaredConsumptionSourceRoles` and `declaredConsumptionArchitecture` expose the
frozen default contract. The `feeds` tactical role is directed **from declared
source to read model**. `resolveDddRelationship`, DDD pattern controls and the
optional DDD policy reuse this convention, including incident-node/reconnection
checks. Generic custom DDD conventions remain independently extensible.

These are modelling declarations, not executable subscriptions or evidence of a
live event. An aggregate/read-model source does not imply all events, a filter,
key routing, delivery order, replay, consistency or handler behaviour. Explicit
edges from domain-event nodes may identify particular event types without claiming
that such an event occurred. Self-consumption is a permitted authored dependency,
not inferred executable feedback. Streams, policies and sagas are not silently
coerced into read models. Non-DDD roles require an explicitly reviewed mapping.

The logical resolver can describe a portless aggregate boundary; it never creates
ports or a drawable edge. The editor separately checks actual ports, duplicates,
policy, revision and lifecycle, and preserves its existing one-Undo architecture
edits. Use snapshot/edition serialization for retained graph meaning: v1 accepts
`read-model` nodes and `feeds` edges in this reader, with no new framework-specific
wire format. Older readers may reject the new role strings. SVG retains canonical
artwork and reports semantic-edge fallback through its existing findings.

[ADR 0065](../../docs/adr/0065-declare-read-model-consumption-without-runtime-semantics.md) ·
[Contract qualification](evidence/declared-consumption.md).

<a id="read-only-preview-layout-unreleased"></a>

## Read-only preview layout

`applyPreviewLayout(preview, currentActiveRequest, result)` applies layout geometry
only to a detached **read-only** editor. It reuses the same complete-node, finite
geometry, group-size and route validation as `applyLayout`, with the same request,
revision and idle-gesture guards. Writable editors are ignored by this preview API.
`applyLayout` retains its normal editable/Undo contract.

```typescript
import { layoutRequest, applyPreviewLayout } from '@opsydyn/foldkit-zloz';

const request = layoutRequest(preview, 'descriptor:17:layout:1');
// Store request in the host Model, then run the chosen LayoutEngine in a Command.
// On completion, pass the CURRENT active request, not a captured old request:
const nextPreview = applyPreviewLayout(currentPreview, currentActiveRequest, result);
```

A valid application changes node positions, group bounds and routes; IDs, labels,
ports, parentage, architecture and data remain current-editor owned. Selection,
readOnly and past/future references are preserved. The preview revision advances
once so the same result cannot apply twice. Invalid current geometry throws before
publication; stale/busy results return the same editor. Route arrays/points and
positions are detached. Core does not import an engine, run effects, fit the camera,
check source authorship or manage cancellation. Hosts own the matching detached
editor, active request and source/review identity, and can compose a FitViewClicked
navigation event after publication.

The ZLOZ workbench's Domain review demonstrates explicit ELK Arrange/Cancel,
RIGHT/DOWN, Restore original, finding navigation and unchanged working history.
See [preview layout evidence](../../apps/zloz-demo/evidence/alchemy-layout.md).
This API is qualified against this branch's source/artifact; published 0.3.0 does
not contain it. No npm publication is implied.

<a id="explicit-layout-label-bounds-unreleased"></a>

### Explicit layout label bounds

Declare one world-unit envelope per composite edge label when the engine supports
it. Include the text, badges and editor chrome in that size:

```ts
const active = layoutRequest(editor, 'arrange-labels-1', {
  edgeLabels: editor.graph.edges.map((edge) => ({
    id: edge.id,
    size: { width: 176, height: 36 },
  })),
});
```

Store the request in your Model before running ELK in a Command. Its routes return
`label: { position, size }`, where `position` is the **world-coordinate center**.
`applyLayout` and `applyPreviewLayout` validate and retain these boxes atomically.
Missing requested boxes, unexpected boxes, duplicate IDs, nonpositive/nonfinite
sizes or mismatched result dimensions are errors. `validateLayoutRequest` validates
typed requests; it is not a decoder for unknown input. Existing requests without
`edgeLabels` retain their shape and behavior. Engines without label support cannot
satisfy a request that declares bounds.

The Foldkit view places `renderEdgeLabel` at the retained center while using the
engine route. Make its complete rendered envelope match the declared dimensions.
Authored waypoints/path style and collapsed group endpoints take precedence; your
`edgeGeometry` policy can override label placement. Headless consumers can forward
`route.label.position` as `resolveEdgeGeometry`'s `labelPosition` option. Fit/reveal
includes the retained envelope. Routes and label boxes are transient, absent from
serialized graphs and authored SVG/PNG projections. Export fidelity findings still
apply to engine routes. Label measurement and universal collision avoidance are
not implied.

<a id="opt-in-measured-label-bounds-unreleased"></a>

### Opt-in measured label bounds

Core owns the request and validation; the optional Foldkit adapter measures rendered
HTML labels. Start a fresh run and store its state in your Model:

```ts
import {
  startLabelMeasurement,
  updateLabelMeasurements,
  resolveLabelMeasurements,
} from '@opsydyn/foldkit-zloz';

const measurements = startLabelMeasurement(editor, 'labels:17', rendererKey);
// Optional fourth argument: the IDs of the rendered edges to measure.
```

Use `zlozView`'s `labelMeasurement` option only while the request is pending and
`resolveLabelMeasurements(editor, measurements, rendererKey).type === 'pending'`:

```ts
labelMeasurement: {
  request: measurements.request, // narrowed to pending
  timeoutMs: 3000,              // optional; positive, finite, at most 60000ms
  onMeasured: (result) => Message.ObservedLabels({ result }),
}
```

Handle the fact in your update function with
`updateLabelMeasurements(editor, currentMeasurements, currentRendererKey, result)`.
Publish the returned state with the rest of your Model. The union is `idle |
pending | ready | failed`. Cancel by replacing it with `{ type: 'idle' }`; always
use a new request ID for a new run. Invalid/current incomplete batches fail as a
whole; old completions are ignored before validation. Results and usable bounds
are detached copies. Measurement never edits the graph or adds Undo.

Before starting layout, resolve again and supply only a ready context's bounds:

```ts
const context = resolveLabelMeasurements(editor, measurements, rendererKey);
if (context.type === 'ready') {
  const active = layoutRequest(editor, 'arrange:17', {
    edgeLabels: context.edgeLabels,
  });
  // Publish active in your Model, then run ELK in a Command.
}
```

**Recheck the measurement context when the engine completes**, before applying its
result. Editor revision, exact graph content and the current renderer key must
still match. Successful layout changes revision; measure again for another run.
Include every size-affecting renderer/content/theme/font option in `rendererKey`.
Core cannot discover arbitrary CSS or renderer state. Same-revision source
replacement, cancellation, superseded requests and stale renderer results cannot
publish or supply usable bounds through the resolver.

The one-shot scoped Mount waits for `document.fonts.ready`, then reads fractional
HTML border boxes through ResizeObserver. Width/height are world/CSS units,
independent of camera zoom; vertical writing modes map to physical dimensions.
The deadline covers font readiness and observation. Missing, duplicated, zero-sized,
fragmented or unsupported targets fail visibly; cleanup releases the observer and
timer and ignores late callbacks. SSR adds inert hooks without measuring anything.
No automatic arrangement or continuous resize observation is installed.

For custom hosts, import `zlozLabelMeasurement` and its optional
`ZlozLabelMeasurementOptions` from `@opsydyn/foldkit-zloz/foldkit`. Put the keyed probe
directly inside an element marked `data-zloz-label-measurement-scope`; mark each
rendered HTML border-box target `data-zloz-measured-label="edge-id"`. Nested scopes
are isolated. The ordinary view handles these hooks for you. Render every requested
target; when using culling, request a rendered subset or disable culling for the
measurement. Content margins, shadows, overflow, local transforms, portals, SVG
labels and later image/font changes are outside this border-box contract. Ensure
other resources have settled and explicitly remeasure when they change.

<a id="explicit-group-header-bounds-unreleased"></a>

### Explicit group-header bounds

Use `groupHeaders` to reserve space for custom container or context headings:

```ts
import type { LayoutGroupHeader } from '@opsydyn/foldkit-zloz';

const headers: readonly LayoutGroupHeader[] = [
  {
    id: 'payments',
    size: { width: 640, height: 112 },
    padding: { top: 24, right: 24, bottom: 24, left: 24 },
    gap: 24,
  },
];
const active = layoutRequest(editor, 'arrange-groups:1', {
  groupHeaders: headers,
});
```

The header starts at the group's world position plus left/top padding. Children
start below `padding.top + size.height + gap`; left/right/bottom padding bounds the
rest of their area. Group minimum width includes the header plus horizontal
padding. Minimum height includes the header, gap and vertical padding, including
for empty groups. Each ID must name a unique existing group; header dimensions must
be positive and finite, while padding/gap may be zero but must be finite and
nonnegative. Nested records are copied; overflowing geometry is rejected.

`resolveLayoutGroupHeader(groupNode, header)` returns the world `position`, copied
`size`, `minimumSize` and child-area `contentPadding`. It is shared by core layout
validation and native renderers. Before applying a current result, core validates
requested minima and containment of all direct children (including nested groups)
below the header and inside the padding. A violation rejects the entire result.
Writable layout remains one Undo; detached read-only layout retains Undo history.
Requests without hints keep their previous shape. Other engines must satisfy these
bounds too; ELK is the qualified optional adapter.

Pass the same configuration to C4 or DDD group views:

```ts
zlozDddGroup(context, h, {
  groupHeader: headers.find((header) => header.id === context.node.id),
  renderBody: ({ node }, builder) => builder.div([], [node.label, ' · Architecture review']),
  renderControls: () => [],
});
```

`zlozC4Group` supports the same option. Existing content slots compose inside the
header area, with the declared width/height and clipping; collapsed groups keep
compact headings. If retaining separately positioned controls, reserve room with
padding or use `renderControls`. Custom shells can use the pure geometry helper.
Keep the configuration in your immutable Model and cancel/supersede in-flight
layout when it changes. A heading preference alone does not change editor revision.
Space is guaranteed after accepting layout against those hints; applying a larger
heading to old/original geometry does not rearrange children automatically.

Hints are transient layout/view configuration. They do not become graph fields,
change serialization, or supply custom SVG/PNG artwork. Custom content must fit its
declared rectangle. The reservation covers child rectangles, not arbitrary route,
shadow, overflow or separate control collisions. No automatic header measurement
or continuous layout is installed.

<a id="opt-in-measured-group-headings-unreleased"></a>

### Opt-in measured group headings

Intrinsic C4/DDD headings can size from their content. A `LayoutGroupHeaderSpec`
contains identity and spacing, with no manually supplied width or height:

```ts
import {
  startGroupHeaderMeasurement,
  updateGroupHeaderMeasurements,
  resolveGroupHeaderMeasurements,
  type LayoutGroupHeaderSpec,
} from '@opsydyn/foldkit-zloz';

const specs: readonly LayoutGroupHeaderSpec[] = [
  {
    id: 'payments',
    padding: { top: 24, right: 24, bottom: 24, left: 24 },
    gap: 24,
  },
];
const measurement = startGroupHeaderMeasurement(editor, 'headings:17', rendererKey, specs);
```

Store the returned `idle | pending | ready | failed` state in your Model. Render
headings with `groupHeader: { ...spec, sizing: 'intrinsic' }` in `zlozC4Group` or
`zlozDddGroup`. `ZlozGroupHeaderOptions` discriminates intrinsic specs from declared
sized envelopes; ordinary `LayoutGroupHeader` options remain compatible. Compose
content through existing slots, using natural/intrinsic CSS dimensions. Collapsed
groups keep compact heading geometry; choose compact content in your shell when an
expanded custom body cannot fit.

While the state and `resolveGroupHeaderMeasurements(editor, state, rendererKey)`
are both pending, enable the normal view's optional lifecycle hook:

```ts
groupHeaderMeasurement: {
  request: measurement.request, // narrowed to pending
  onMeasured: (result) => Message.ObservedGroupHeadings({ result }),
  timeoutMs: 3000,              // optional; positive, finite, up to 60000ms
}
```

Your update handler calls
`updateGroupHeaderMeasurements(editor, currentState, currentRendererKey, result)`
and publishes that state. Cancel by replacing it with `{ type: 'idle' }`; a new run
requires a fresh ID. Start rejects collapsed groups and groups hidden by collapsed
ancestors. Current incomplete, duplicate, nonpositive, nonfinite or overflowing
batches fail atomically. Old request/revision/source/renderer/visibility completions
are ignored. Specs, dimensions and returned layout declarations are copied.

A ready context supplies complete `groupHeaders`, with measured size and the
original padding/gap:

```ts
const context = resolveGroupHeaderMeasurements(editor, measurement, rendererKey);
if (context.type === 'ready') {
  const active = layoutRequest(editor, 'arrange:17', {
    groupHeaders: context.groupHeaders,
  });
  // Publish active, then execute ELK in a Command.
}
```

Resolve again when the engine completes before applying its result. Include all
size-affecting content/theme/font/spacing options in the render key and cancel or
supersede work when they change. Successful layout changes revision; measure again
before another arrangement. This process does not edit the graph or add Undo;
normal layout still adds one Undo and read-only preview layout retains history.
No automatic arrangement, continuous observation or graph serialization is added.

The shared one-shot Mount measures fractional HTML border boxes after used-font
readiness, independent of camera zoom. It isolates nested canvases and releases its
observer/timer on completion, failure or unmount. For custom hosts, compose
`zlozGroupHeaderMeasurement` from `/foldkit` directly inside a host marked
`data-zloz-group-header-measurement-scope` and tag each target
`data-zloz-group-header="group-id"`. C4/DDD group views supply targets automatically.
Every requested target must render; disable culling or request a rendered subset.
This is a typed lifecycle contract, not a decoder for unknown input. Overflow,
shadows, local transforms, portals, SVG content and later resources are outside the
border-box snapshot. Use explicit remeasurement for changes; reserve separate
controls through padding or custom control slots.

<a id="retained-layout-svg-planning-unreleased"></a>

### Retained layout SVG planning

`captureSvgLayout(editor, renderKey)` captures detached world-space routes and
label envelopes from an idle editor. Pass the current renderer key separately:

```typescript
import { captureSvgLayout, planSvgExport } from '@opsydyn/foldkit-zloz';

const retained = captureSvgLayout(editor, rendererKey);
const plan = planSvgExport(editor, {
  ...svgOptions,
  layout: { snapshot: retained, renderKey: rendererKey },
});
```

The exact graph and current key must match the capture. Changed source or key
produces blocking `layout-stale`; invalid current route/label batches reject.
Capture and planning copy nested geometry without changing graph or Undo. Partial
route coverage is allowed. Author-defined waypoints/pathStyle override retained
geometry, matching the canvas. Whole-model nominal bounds include effective route
points and labelled edge envelopes; explicit crops stay fixed. Custom SVG renderers
own their declared bounds. Measured envelopes never qualify custom badge/editor
content: declare a vector adapter, fallback or omission for the complete edge.
Custom headings remain covered by node renderer declarations.

Hosts own key correctness and live-route invalidation. Recompute stale layout
before capturing with a new key; relabelling old geometry with a new key does not
make it current. Include theme/font/label/renderer configuration in the key.
Font ink, strokes, collapsed presentation and unsupplied overlays remain outside
this contract. It is a typed in-process snapshot, not a wire decoder or attestation.

`writeSvgExport` now consumes opted-in routes and centre-anchored label envelopes,
using the same authored-geometry precedence as native views. A box positions plain
SVG text at its centre; multiline blocks use 1.25em spacing and middle baseline.
This does not reproduce HTML badges, editing controls, wrapping or font ink. Without
a box, the existing above-path plain-label placement is retained.

Edge `ZlozSvgAdapterContext` includes frozen `layoutRoute`, `labelBox` and resolved
`geometry` in addition to edge/endpoints/theme/font. The route/box are undefined
when authored geometry overrides layout. Custom safe vectors can use the retained
world points and centre box. Their declared bounds and fidelity remain host-owned.
Text primitives optionally accept `baseline: 'alphabetic' | 'middle'`; unsupported
values block. No raw markup or path primitive is added.

`ZlozSvgReviewContext.layout` opts the existing review into those exact options.
Source, renderer key, route data, findings and emitted bytes participate in the
review identity: old acceptance and download requests cannot authorize changed
layout. The workbench demonstrates an unchecked **Use retained layout in SVG**
control, with an Arrange reason when no routes exist. Source and Undo are unchanged.
Omit `layout` for existing canonical SVG behavior. The workbench now has a separate
unchecked retained-layout option for PNG, described below.

<a id="retained-layout-png-unreleased"></a>

### Retained layout PNG

The existing `ZlozPngReviewContext.layout` accepts the same validated capture:

```typescript
const context = {
  ...pngContext,
  layout: { snapshot: captureSvgLayout(editor, rendererKey), renderKey: rendererKey },
};
const review = resolvePngReview(state, context);
```

Review, acknowledge losses, request a render and execute its payload through the
optional `/browser` entry. The render payload uses the writer's detached, frozen
layout snapshot, so later caller mutation of route points or label boxes cannot
rewrite the queued job. Its PNG limits are copied too. The browser still rebuilds
the safe SVG and checks `expectedSvg` before allocating image/canvas resources.
Stale source/render keys block; changed route/box data, settings, source revision
or budgets invalidate consent and old artifacts. Cancellation and current download
policies suppress late results. Download uses the actual reviewed PNG bytes.

Whole-model retained routes and centre label envelopes may enlarge the output.
The same dimension/pixel/byte limits apply before allocation; explicit crop bounds
remain fixed. Font/custom-renderer findings and PNG flattening loss remain visible
and require acceptance. These checks do not promise arbitrary HTML equivalence.

The workbench demonstrates independent unchecked **Use retained layout in PNG**
and **Use retained layout in SVG** controls. Missing PNG routes show an Arrange
reason. Changing either setting preserves source/Undo; the other format keeps its
choice. Renderer keys and invalidation remain host-owned. No source wire format,
provider activation or publishing is implied.

<a id="read-only-ddd-relationship-audit-unreleased"></a>

### Read-only DDD relationship audit

```typescript
import { auditDddRelationships, parseGraph } from '@opsydyn/foldkit-zloz';

const graph = parseGraph(documentJson);
const report = auditDddRelationships(graph);
// Or pass { rules: yourDddCatalogue } to replace the default convention.
```

`auditDddRelationships` validates the typed graph, then uses the existing
`resolveDddRelationship` conventions for every authored DDD edge. It returns
`ZlozDddRelationshipAudit` with deterministic UTF-16 edge-ID order and an
`edges / typed / unrelated / blocked` summary. Entries include detached endpoint
IDs, label (null when absent), authored descriptor/convention key, code and message.
Nested upstream role lists are copied. Graph, editor state, Undo and policies are
unchanged; host data, endpoint extras and rule objects are not included.

A DDD edge is `typed`/`compatible` or `blocked` by the selected convention. Untyped
and other-family edges are `unrelated`; node roles and labels do not infer meaning.
A compatible report means zero blocked DDD edges, including on empty/unrelated
models. It does not mean all edges are typed or the architecture is universally
correct. Optional side roles stay optional; no aggregate ownership, topology,
cycles, mandatory annotations or executable consumption rules are invented.

Custom rules **replace** the default catalogue. Invalid rules throw `invalid-edit`
even when there are no DDD edges. Invalid graph/descriptor/endpoint structure throws
`invalid-graph`, rather than becoming a semantic finding. Decode untrusted text
with the existing codecs first; this is a typed in-process audit, not a decoder or
a report wire-format version. Reports use existing resolver codes and messages.

Core import remains safe in Node/Bun without UI peers. The causal audit,
`relationships audit/compare` CLI commands and review packets remain EventStorming-scoped. The optional Effect CLI now exposes `ddd audit` with
its own DDD convention-file schema and explicit exits. DDD review/comparison
now have public APIs below. Permission to Apply and new serialization formats
remain separate.
See [ADR 0078](../../docs/adr/0078-audit-declared-ddd-relationships.md)
and [qualification](evidence/ddd-relationship-audit.md).

<a id="ddd-review-and-edition-comparison-unreleased"></a>

### DDD review and edition comparison

```typescript
import {
  compareModelDddRelationships,
  resolveDddAuditControls,
  resolveDddAuditRequest,
  type ZlozDddAuditState,
} from '@opsydyn/foldkit-zloz';

const state: ZlozDddAuditState = {
  baselineId: 'before', // null selects standalone target review
  selectedId: null, // current graph; an ID selects an owned edition
  filters: { introduced: true, resolved: true, persisting: true },
};
const decision = compareModelDddRelationships(document, { baselineId: 'before' });
const context = resolveDddAuditControls(document, state, {
  // rules: yourCatalogue, // the same convention applies to both sides
  focusReason: (item) => null, // return a visible reason to protect navigation
});
// Compose controls, then recheck emitted requests against live document/state/options.
const entry = context.entries[0];
if (entry) {
  const navigation = resolveDddAuditRequest(document, state, entry.request);
  // Route focus decisions to navigation.source; keep authored data unchanged.
}
```

`compareModelDddRelationships` validates and detaches the model. A baseline is
required; omitted `selectedId` means current graph, never the visible history
camera. Unknown baseline/target IDs return blocked decisions and never fall back.
Only owned editions are selectable; an origin edition is provenance, not ownership.
One catalogue applies to both snapshots. Every audit retains typed/unrelated
coverage; no DDD meaning is inferred. Findings match by authored **edge ID and
code**. Changed codes resolve the old finding and introduce the new one; unchanged
codes persist, retaining detached before/after projections even when labels,
participants or presentation differ. Each category uses deterministic edge-ID
order. `no-new-findings` is absence of regression, not compatibility.

`resolveDddAuditControls` returns target audit, optional comparison, edition
selectors, filters, reasons and navigation entries. A null baseline means standalone
current/edition review with entries of kind `current`; that kind means single-target
review, and `source` still identifies the actual current graph or owned edition.
Comparison kinds are `introduced`, `resolved` and `persisting`. Resolved entries
reveal the baseline; others reveal the target. Changing the camera never changes
these selections. Optional labels, edition names, filter labels, host protection
and per-finding navigation reasons are configurable.

`resolveDddAuditRequest` returns state changes, ignored/blocked decisions, or a
navigation-only source and `EdgeRevealRequested`/`NodeRevealRequested` event.
Set a focus request's `subject` to `edge`, `source` or `target`. The exact finding
projection token, model ID, selectors, category, filters and live policies are
rechecked; stale controls cannot navigate changed findings. A token is freshness
data, not an authorization credential. The host owns state and routes reveal events
to the indicated current editor or immutable history review. These APIs never
restore snapshots, mutate graphs, select edit targets or add Undo entries.

The optional `@opsydyn/foldkit-zloz/foldkit` entry exports:

- `zlozDddAuditControls` and `ZlozDddAuditViewOptions` / `ZlozDddAuditParts`.
- `zlozDddAuditEditionSelect`, `zlozDddAuditFindingFilter`,
  `zlozDddAuditFindingButton`, `zlozDddAuditStatus`, `zlozDddAuditReason`.

Native selectors, checkboxes and edge/source/target buttons have accessible labels
and visible convention/protection reasons. All selectors, filters, entries, status,
reason and layout have replace/omit composition hooks (undefined keeps default;
null omits a part). `showCounts: false` hides numeric diagnostics without hiding
findings, reasons or navigation; a host can omit status entirely. Custom entry
renderers own list-item semantics and can reuse guarded button primitives.

The workbench History sidebar demonstrates custom cards, single-target review,
baseline comparison and immutable finding navigation in light/dark themes. See
[ADR 0080](../../docs/adr/0080-complete-ddd-audit-review-and-comparison.md) and
[local qualification](../../apps/zloz-demo/evidence/ddd-audit.md). DDD review packets,
new correctness rules, workshop-role expansion and EventStorming-to-C4 conversion
are outside this workflow. Nothing is published by these APIs.

<a id="external-systems-hotspots-and-lanes-headless-unreleased"></a>

### External systems, hotspots and lanes (headless)

The workshop vocabulary distinguishes causal participants from discussion annotations
and organizational frames. These are ZLOZ modelling conventions, not executable
business rules or a claim of universal EventStorming grammar.

| Descriptor (`family: 'event-storming'`)         | Core meaning                                        | Node contract                                                             |
| ----------------------------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------- |
| `role: 'external-system'`                       | Participant outside the workshop's modelled control | Ordinary node; existing strict output-to-input ports                      |
| `role: 'hotspot', status: 'open' \| 'resolved'` | Authored discussion annotation                      | Ordinary portless node; status is required                                |
| `role: 'lane'`                                  | Organizational frame                                | `kind: 'group'`, no ports; normal parent membership and world coordinates |

All accept an optional description. Status belongs only to hotspots. Unknown
fields, missing/unknown hotspot status, causal ports on hotspots and incompatible
node kinds reject through the existing codecs. External-system is distinct from
C4's software-system/external scope. Neither external systems nor lanes infer a
DDD bounded context, aggregate, runtime service or infrastructure resource.

```typescript
import {
  createArchitectureNode,
  resolveEventStormingNodeSemantics,
  eventStormingWorkshopRelationshipRules,
  eventStormingRelationshipPolicy,
  auditEventStormingRelationships,
  updateEditor,
} from '@opsydyn/foldkit-zloz';

const hotspot = createArchitectureNode({
  id: 'retry-question',
  label: 'Who owns retries after a timeout?',
  position: { x: 300, y: 280 },
  size: { width: 240, height: 140 },
  ports: [],
  architecture: { family: 'event-storming', role: 'hotspot', status: 'open' },
});
const meaning = resolveEventStormingNodeSemantics(hotspot);
// { kind: 'annotation', role: 'hotspot', status: 'open' }

const convention = { rules: eventStormingWorkshopRelationshipRules };
const report = auditEventStormingRelationships(graph, convention);
const policy = eventStormingRelationshipPolicy(convention, hostPolicy);
const next = updateEditor(
  editor,
  {
    type: 'NodeArchitectureChanged',
    id: hotspot.id,
    architecture: { family: 'event-storming', role: 'hotspot', status: 'resolved' },
  },
  policy,
);
```

`EventStormingNodeArchitecture` is a discriminated union of
`EventStormingParticipantArchitecture`, `EventStormingHotspotArchitecture` and
`EventStormingLaneArchitecture`. `resolveEventStormingNodeSemantics` returns a
`ZlozEventStormingNodeSemantics` projection with kind participant/annotation/frame,
role, and hotspot status. Other architecture families return null. It validates
reserved descriptor/kind/port constraints; it does not validate the enclosing graph,
look up membership or infer context. Decode untrusted text with normal codecs first.

The original `eventStormingRelationshipRules` catalogue stays unchanged so existing
builtin review packets remain reproducible. Opt into
`eventStormingWorkshopRelationshipRules` for external systems issuing commands,
handling commands and emitting events. Existing rule keys and every previous
participant pairing are preserved. Other relationships require a custom catalogue;
`rules` replaces defaults. CLI version-one causal rule files now accept
`external-system` participant roles. Hotspots/lanes are excluded from causal role
catalogues and cannot become causal participants through `roleOf` delegation.
Port direction, permissions and editing lifecycle remain independently enforced.

A lane uses existing `parentId`, optional parent extents, nesting, group movement,
resize, duplication, clipboard, collapse and deletion behavior. Children retain
world coordinates. Deleting a lane follows normal group cascade deletion; ungrouping
removes only the frame and preserves children/edges at their authored positions.
Membership does not establish aggregate ownership, causality, sequence or a runtime
boundary. No lane-specific layout engine or parallel membership store is introduced.

Hotspot status changes use `NodeArchitectureChanged`, existing live policy hooks and
one Undo. Editions classify the change as semantic, not layout. Resolution records
an authored workshop state; it establishes neither correctness nor who resolved it.
No implicit status default, arbitrary causal edges or new annotation attachment
references are introduced. Label/description describe the concern; host data remains
available for host metadata. Node IDs and descriptor fields survive graph, snapshot,
model, edition, clipboard and portable conversion provenance workflows.

DDD mapping previews leave all three roles **unmapped** by default with specific
reasons. Hosts can explicitly retain them or choose a kind-compatible DDD mapping.
Replacing a hotspot discloses loss of its authored status and requires exact-plan
loss acceptance; the existing receipt retains original meaning and one Undo.
New vocabulary does not authorize automatic DDD/C4 interpretation or Apply.

`architectureNodePresets` includes headless entries (hotspot status open, lane group
kind), not qualified artwork. `createArchitectureNode` validates supplied ports and
kind; it never silently drops ports or changes kind to satisfy a preset. The optional native node/lane renderers now support these roles, as documented
below. Their original headless-only artwork guard is superseded for FoldKit views. The portable workshop projection below now qualifies built-in SVG artwork.
Explicit host SVG adapters or loss-declared custom-shell fallback remain available.
Mermaid projection reports omitted semantics and preserves node/parent identity;
portable packets retain the complete authored descriptors and chosen catalogue.

The graph/snapshot wire version remains one with additive descriptors. Legacy
inputs and builtin review packets still work; older package versions can reject
new roles and are not forward-compatible readers. No version bump, publication or
new renderer is implied. See [ADR 0081](../../docs/adr/0081-define-eventstorming-workshop-semantics.md)
and [qualification](evidence/event-storming-workshop.md).

<a id="composable-workshop-renderers-and-controls-unreleased"></a>

### Composable workshop renderers and controls

```typescript
import {
  createEventStormingWorkshopPattern,
  createEditor,
  resolveEventStormingWorkshopControls,
  resolveEventStormingWorkshopRequest,
  updateEditor,
} from '@opsydyn/foldkit-zloz';
import {
  zlozEventStormingNode,
  zlozEventStormingGroup,
  zlozEventStormingWorkshopControls,
} from '@opsydyn/foldkit-zloz/foldkit';

const editor = createEditor(createEventStormingWorkshopPattern());
// In your zlozView options:
const renderNodeShell = (context, h) => zlozEventStormingNode(context, h);
const renderGroupShell = (context, h) => zlozEventStormingGroup(context, h);
// Resolve against your selected node and current host policy, not a cached permission.
const context = resolveEventStormingWorkshopControls(selectedEditor, selectedId, { policy });
const decision = resolveEventStormingWorkshopRequest(selectedEditor, selectedId, request, {
  policy,
});
if (decision.type === 'ready') {
  const next = updateEditor(selectedEditor, decision.event, policy);
}
```

The starter is a pure illustrative graph: one Payment discovery lane, command →
external provider → domain event, and open/resolved hotspots. It does not enable
policies itself. Opt into `eventStormingWorkshopRelationshipRules` when using its
causal edges. Its sample metadata can be used by host protection; core does not
interpret `workshopStatusLocked` as permission.

`zlozEventStormingNode` renders ordinary notes, external-system dashed outlines,
and hotspots with text status. `zlozEventStormingGroup` renders portless lanes with
native selection, drag, collapse, context and resize controls. Both use authored
core geometry. Hotspots never gain sockets. Existing group membership, world
positions, clipboard, history and Undo apply unchanged.

`ZlozEventStormingNodeOptions` adds `renderStatus`, `describeMeaning` and
`groupHeader` to the existing content/body/control/cache composition contract.
Status and all other content slots return undefined for defaults or null to omit;
`renderBody` replaces the complete inert content. `renderControls` owns interactive
content outside the drag handle/cache; an empty array omits chrome. Header geometry
uses the existing declared/intrinsic contract with matching group ID; collapsed
lanes use the compact header. Cache only inert artwork; policy-controlled controls
and sockets remain live. Keep options stable when retaining artwork.

New scoped theme tokens are `eventStormingExternalSystem`,
`eventStormingHotspotOpen`, `eventStormingHotspotResolved` and `eventStormingLane`.
Light/dark palettes provide defaults. Their CSS properties use the
`--zloz-event-storming-` prefix. Existing legacy token names remain compatible.
Hotspot status is text, not color alone, and is independent of numeric diagnostics.
Native handles associate their existing help plus a per-node semantic description;
`describeMeaning` may replace that description or return null to omit it.
Custom status artwork should communicate the canonical state clearly.

`resolveEventStormingWorkshopControls` returns `ZlozWorkshopControlsContext`:
compatible role choices, optional hotspot status choices, current meaning, scope
and visible restrictions. It requires the target to be selected and visible.
Choices never change node kind or drop ports implicitly. Descriptions survive
role/status changes. Role changes are explicit authored edits; these controls
neither infer C4/DDD meaning nor replace conversion consent tools.

Requests carry node ID, source revision and exact descriptor. Recompute and resolve
with live state/policy before applying a ready `NodeArchitectureChanged` event.
Stale/unrelated requests ignore; hidden, unselected, read-only, busy, kind/port or
policy restrictions block with a reason. No-op requests add no Undo. The host owns
model/session identity and must reject messages from a different session. Request
scope is freshness data, not an authorization credential. Apply immediately through
`updateEditor` with the same policy to keep one Undo and current policy enforcement.

The optional entry provides `zlozEventStormingWorkshopControls`,
`zlozWorkshopSelect`, `zlozWorkshopStatusButton`, `ZlozWorkshopParts` and
`ZlozWorkshopViewOptions`. Default hotspot status has explicit Open/Resolved native
pressed buttons for Tab/Enter/Space; the select helper is available for custom
compositions. Role, status, meaning, reasons and layout each support replacement or
omission. Selectors retain disabled option reasons and native labels. Reasons and
semantic status remain independent of diagnostics/Minimal mode. Custom controls
must resolve the public requests against live policies rather than mutating nodes.

Shared port-add capability checks now give portless annotations/groups a reason
and leave graph/Undo unchanged instead of constructing an invalid graph. The
workbench demonstrates custom status badges, editable/protected notes, explicit
convention/protection toggles, native lane controls, readonly historical review,
light/dark and diagnostics preferences in the left sidebar. Select **Open workshop
semantics example**, then **Inspect**.

This qualifies native FoldKit views and controls. The portable projection below
separately qualifies built-in SVG/PNG artwork; custom views still need explicit
SVG adapters/fidelity fallback.
Mermaid loss handling, causal default catalogues and wire formats are unchanged.
No publication or deployment. See [ADR 0082](../../docs/adr/0082-compose-workshop-renderers-and-controls.md)
and [visual/test qualification](../../apps/zloz-demo/evidence/workshop.md).

<a id="portable-workshop-artwork-unreleased"></a>

### Portable workshop artwork

`writeSvgExport` includes canonical external-system dashed outlines and ports,
labelled lane frames, and hotspot **Open question / Resolved** text and theme
accents. Authored status is preserved in both light/dark projections; it does not
follow diagnostics visibility or custom native badge text. Existing graph geometry,
export bounds, fonts, safe text escaping and primitive/resource budgets apply.

Custom workbench badges (Discuss · open / Agreed · resolved) remain declared
fallbacks to this canonical text. Semantic edge notation retains its explicit
loss finding. Review the findings and accept the exact artifact's losses before
download; system-font wrapping/ink bounds remain unverified. This is portable model
artwork, not arbitrary HTML capture or an equivalence claim for custom renderers.

The optional `renderPngExport` browser entry consumes the same safe SVG projection;
pass the reviewed `expectedSvg` to reject changed status/theme/artwork. PNG review
adds rasterization loss and retains the existing pixel/byte budgets and cancellation.
No separate workshop raster renderer is required. Canonical models and Undo remain
unchanged. See [ADR 0083](../../docs/adr/0083-qualify-workshop-portable-artwork.md) and
[local SVG/PNG evidence](../../apps/zloz-demo/evidence/workshop-export.md).

<a id="headless-eventstorming-to-c4-mapping-preview-unreleased"></a>

### Headless EventStorming-to-C4 mapping preview

`previewEventStormingC4Mapping` returns immutable advisory review data from a model
document plus host-owned session/revision. It preserves the complete source,
including camera, editions and fork ancestry. It returns no converted graph,
editor events, consent token or Apply operation.

```ts
import { previewEventStormingC4Mapping } from '@opsydyn/foldkit-zloz';

const preview = previewEventStormingC4Mapping(
  { document: workshopDocument, sessionId: 'workshop-tab:1', revision: editor.revision },
  {
    nodes: [
      {
        nodeId: 'provider',
        architecture: { family: 'c4', role: 'software-system', scope: 'external' },
      },
      {
        nodeId: 'request',
        label: 'Payments API',
        architecture: { family: 'c4', role: 'container', technology: 'HTTP' },
      },
      { nodeId: 'retry-question', architecture: null }, // Explicit retention.
    ],
    edges: [
      {
        edgeId: 'provider-handles',
        relationship: { label: 'Requests payment authorization' },
      },
      { edgeId: 'provider-emits', relationship: null },
    ],
  },
);
```

All mappings are explicit. Actors and external systems return non-exhaustive
ambiguous candidates; scope is never inferred from workshop externality. Commands,
events and policies do not identify a runtime structure. Hotspots and lanes remain
unmapped until explicitly reinterpreted or retained. Existing kind/portless group
contracts still apply: a lane can be explicitly considered as a software-system or
container frame, never silently turned into a person/component. Optional labels
name a structural interpretation; omitted descriptions preserve authored prose.

`nodes` and incident `edges` remain in source order. Unrelated C4/DDD nodes and
nonincident relationships are not remapped. Null explicitly retains source meaning
and claims no C4 compatibility. An explicit communication label requires both
endpoints to have explicit C4 proposals or existing authored C4 meaning; otherwise
its preview is blocked. A causal label or compatible endpoints never infer a
communication. Relationship choices are plain label projections, not a new reserved
C4 edge descriptor, inferred protocol or correctness check. Source direction and
endpoint/port IDs are retained in provenance.

`disclosures` identify prospective replacement of reserved workshop/relationship
meaning, hotspot open/resolved status, organizational lane meaning, grouping,
labels and descriptions. Source membership is not validated C4 containment. Read
all unresolved choices and losses; the function neither drops notes nor authorizes
conversion. Invalid, duplicate, unknown, nonincident or kind-incompatible choices
throw `ZlozError`. Source and choices are detached/frozen without freezing inputs.

Recompute after model/session/revision/choice changes. Provenance is review data,
not permission or evidence of a human actor. Future conversion planning must
separately resolve containment, exact-plan consent, live policies and atomic Undo.
The Astro workbench demonstrates this API in its **C4 mapping review** sidebar,
with native staged choices and visible provenance/losses. Core owns the preview;
the host owns ephemeral form state. No package-level controls or CLI conversion
are added here. See [ADR 0084](../../docs/adr/0084-preview-eventstorming-to-c4-mapping.md),
[headless qualification](evidence/event-storming-c4-preview.md) and
[workbench visual evidence](../../apps/zloz-demo/evidence/c4-mapping.md).

<a id="headless-c4-conversion-plans-and-exact-loss-consent-unreleased"></a>

### Headless C4 conversion plans and exact loss consent

`createEventStormingC4ConversionPlan(source, options)` builds a complete advisory
plan from the current model document and host session/revision. It reuses the C4
mapping preview, but adds explicit placement decisions and exact-plan loss consent
through `resolveEventStormingC4ConversionConsent`. Neither function edits a model,
returns a target graph or authorizes Apply.

```ts
import {
  createEventStormingWorkshopPattern,
  createEventStormingC4ConversionPlan,
  resolveEventStormingC4ConversionConsent,
  type ZlozEventStormingC4ConversionOptions,
} from '@opsydyn/foldkit-zloz';

const graph = createEventStormingWorkshopPattern();
const source = {
  document: {
    id: 'payment-workshop',
    name: 'Payment workshop',
    snapshot: { graph },
    editions: [],
    origin: null,
  },
  sessionId: 'workshop-tab:1',
  revision: 0,
};
const options: ZlozEventStormingC4ConversionOptions = {
  mappings: {
    nodes: graph.nodes.map((node) =>
      node.id === 'request'
        ? {
            nodeId: node.id,
            architecture: { family: 'c4' as const, role: 'container' as const },
            label: 'Payments API',
          }
        : { nodeId: node.id, architecture: null },
    ),
    edges: graph.edges.map((edge) => ({ edgeId: edge.id, relationship: null })),
  },
  memberships: [{ nodeId: 'request', placement: { type: 'organization' } }],
};
const plan = createEventStormingC4ConversionPlan(source, options);
const review = resolveEventStormingC4ConversionConsent(source, options, null);
// review is consent-required: the host has not recorded acknowledgement.
```

Every proposed C4 node requires placement. Reinterpreting a lane also requires
placement of **all direct members**, including retained notes and existing C4/DDD
nodes. Unrelated nodes cannot be rearranged through conversion options. Placement
choices are deliberately distinct:

- `{ type: 'root' }` explicitly detaches a diagram parent, preserving world
  coordinates and removing authored parent-dependent `extent`/`expandParent`
  fields. Root does not establish real-world ownership or invent an unseen owner.
- `{ type: 'organization' }` preserves exact existing membership under a retained
  non-C4 frame. It makes no C4 ownership claim and requires an existing parent.
- `{ type: 'contained', parentId }` explicitly declares a C4 container inside a
  software-system group, or a component inside a container group. Both elements
  need proposed/authored C4 meaning and the parent must already be a group.

These local role/kind rules follow the [C4 abstraction hierarchy](https://c4model.com/abstractions).
A newly interpreted C4 boundary cannot silently retain organizational members;
retained notes must be detached or explicitly given compatible C4 meaning.
Cycles are checked against the combined parent choices. No group promotion,
implicit reparenting, position translation, frame resizing or element merging occurs.
This validates declared local containment, not full architecture correctness,
ownership outside the diagram, protocols, visual enclosure or pixel layout.

Plans are `blocked`, `reviewable` or `unchanged`. Blocked plans include node,
relationship and membership findings, with **no partial `changes` list**.
Reviewable changes contain same-ID node/communication replacements and reviewed
membership edits/declarations. All-retained or empty plans are unchanged and need
no loss consent. Complete source camera, editions, ancestry, IDs, ports, direction,
geometry, appearance, host data and original descriptors remain in frozen provenance.
The private projection is validated against existing graph invariants before a
complete change list is returned.

Use `plan.disclosures` for the complete plan's losses. They retain workshop/status/
label/description and reserved relationship findings, and replace the raw preview's
generic membership warning with decision-specific parent, constraint and containment
findings. `plan.preview` remains the original advisory projection. Original absence
of a setting is represented by null in membership review data; authored false is
preserved distinctly. No new canonical node/edge descriptor or wire format is added.

Only after the host records affirmative acknowledgement of every listed loss may it
construct `{ planKey: plan.key, accepted: true }`. Pass that consent to the resolver
with the **current source and options**. The resolver rebuilds the plan; changes to
model/session/revision, graph/data, camera, editions, ancestry, mappings or placements
invalidate old consent. Null withdraws it. The exact-content key contains source
data; it is not a credential/hash, must not be logged or put in the DOM, and is not
proof of a human reviewer or permission to edit.

Consented still does not authorize Apply. A later transaction must independently
check live source/session/revision, lifecycle, policies, containment, exact loss
consent and atomic Undo, then retain provenance. No Apply, receipt, CLI operation,
publication or deployment is added here. The Astro workbench now composes placement
review, package blockers/provenance and exact loss acknowledgement in its C4 sidebar;
the host owns ephemeral forms and callback generations. Apply remains unavailable.
See [ADR 0086](../../docs/adr/0086-plan-explicit-c4-conversion-and-containment.md),
[package qualification](evidence/event-storming-c4-conversion-plan.md) and
[workbench visual evidence](../../apps/zloz-demo/evidence/c4-plan.md).

### Atomic EventStorming-to-C4 Apply

`applyEventStormingC4Conversion(editor, liveSource, { conversion, consent, policy,
blockedReason })` rebuilds the plan from current choices and checks the live graph,
camera and revision before applying. It also checks read-only/busy state, enabled
Undo, containment, exact loss consent and current policies. Missing or changed
consent returns `consent-required`; unresolved intent returns `unresolved-mapping`.
The remaining blocked codes are `source-changed`, `read-only`, `busy`,
`undo-disabled` and `policy`. Malformed source/options throw the existing core error.

```ts
const result = applyEventStormingC4Conversion(model.editor, liveSource, {
  conversion: reviewedChoices,
  consent: model.c4Consent,
  policy: currentPolicy,
});
if (result.type === 'applied') {
  // Publish both in the same synchronous model update.
  return {
    ...model,
    editor: result.editor,
    c4Conversions: [...model.c4Conversions, result.conversion],
  };
}
```

`applied` returns one graph Undo transaction and a detached frozen conversion record
with source provenance, exact reviewed choices, loss acceptance and target document.
`blocked` and `unchanged` return the original editor without a record. Graph Undo
leaves the host's retained record available for review. The host supplies the current
document/session, external busy conditions and durable storage; core does not prove
host identity or human review.

`ZlozEventStormingC4ApplyPolicy` reuses node/edge architecture vetoes and offers
`canChangeC4NodeLabel`, `canChangeC4EdgeLabel`, `canChangeC4Membership` and
`canApplyEventStormingC4Conversion`. Granular hooks receive current and full proposed
values plus the current graph. Membership policy also checks explicit containment
when the parent ID stays unchanged. All policy inputs are detached and frozen.
`serializeEventStormingC4Conversion(record)` validates and exports the complete
receipt. `parseEventStormingC4Conversion(json)` strictly decodes the independent
`foldkit-zloz-c4-conversion` v1 envelope. Both rebuild the recorded source/options
plan, require a source camera and reviewable changes, and require the complete target
document to equal the shared conversion projection. Unknown envelope/options fields,
unsupported versions, invalid choices, unresolved containment and target changes are
rejected. Existing graph/model/edition codecs are unchanged.

Decoded receipts are detached and frozen. They retain source session/revision, full
before/after documents, reviewed choices and historical loss acceptance. They validate
consistency, not authorship or human review. A self-consistent unsigned receipt is
not an authenticated record. Parsing never calls Apply or grants current consent.
Malformed input throws the core validation error; there is no I/O or host-size policy
inside these pure functions. File hosts should bound bytes before fatal UTF-8 decoding.
The workbench uses a single-file 5 MiB limit, validated download and detached read-only
before/after reopening. See [ADR 0090](../../docs/adr/0090-validate-portable-c4-conversion-receipts.md).
See [ADR 0088](../../docs/adr/0088-apply-c4-conversion-atomically.md).

### Explicit v2 connection documents (headless contract)

`resolveConnectionPortPair({ sourceKind, targetKind, mode? })` reports port-kind
compatibility. The default is `strict` (output→input). `loose` accepts any existing
input/output pair, preserving ordered source and target endpoints. Missing ports
or unsupported modes are incompatible. This result does not check IDs, duplicates,
lifecycle, per-port/edge policies or permission to edit. Loose is not a symmetric
relationship and does not change DDD or causal meaning.

Standalone v2 documents persist an explicit `connectionMode`, authored graph and
optional camera. Use the dedicated APIs:

```ts
const strict = captureConnectionDocument(parseSnapshot(legacyV1Json));
const loose = captureConnectionDocument({
  graph: authoredGraph,
  viewport: { x: 0, y: 0, zoom: 1 },
  connectionMode: 'loose',
});
const json = serializeConnectionDocument(loose); // Always version 2.
const reopened = parseConnectionDocument(json); // Detached and deeply frozen.
const downgrade = planConnectionDocumentDowngrade(reopened);
```

`captureConnectionDocument` defaults to strict when its input omits the mode and
preserves an existing explicit mode when recapturing a v2 document. Text decoding
requires version 2 and a known mode; it never infers one from endpoints. Supported
node/edge data, ordered identities, geometry, ports, parent constraints and camera
are retained. Existing portless-group/world-coordinate/uniqueness/finite-data rules
remain. The envelope, graph-level fields and camera fields reject unknown keys.
Typed records are revalidated before encoding so corrupt nonfinite data cannot
silently become JSON null. These pure codecs have no host byte/time limit.

Downgrade is **review planning**, not saving or Apply. A `blocked` plan lists
incompatible edge IDs and has no partial snapshot. A `reviewable` plan contains a
prospective strict v1 snapshot plus loss findings. Loose mode always discloses
`loose-mode-removed`, even when its current edges fit v1: future authoring semantics
would change. Review that loss before explicitly using `serializeSnapshot` on the
prospective snapshot. No ports are fabricated or retyped.

The standalone codec does **not** enable loose editing through legacy `createEditor`.
Use the explicit headless initializer below. Native interactions and canonical v2
model/edition workflows now have dedicated APIs, as do native v2 patches, receipts,
layout, Mermaid, audits and CLI paths described below. Existing
`parseGraph`/`parseSnapshot` readers and v1 adapter entries remain strict and reject
v2. Do not unwrap v2 data into legacy APIs expecting mode preservation. Broader
mounted adoption and acceptance remain separately tracked.
See [ADR 0092](../../docs/adr/0092-stage-explicit-v2-connection-documents.md) and
[headless compatibility evidence](evidence/connection-v2.md). C1 remains partial;
no npm publishing or deployment is part of this contract slice.

### Headless editor adoption of v2 mode

Initialize an editor from the document when preserving its connection mode matters:

```ts
import {
  createEditorFromConnectionDocument,
  captureConnectionDocument,
  parseConnectionDocument,
  serializeConnectionDocument,
  updateEditor,
} from '@opsydyn/foldkit-zloz';

const editor = createEditorFromConnectionDocument(parseConnectionDocument(savedText));
const edited = updateEditor(
  editor,
  {
    type: 'ConnectionCreated',
    edge: {
      id: 'uses',
      source: { node: 'orders', port: 'api' },
      target: { node: 'billing', port: 'api' },
    },
  },
  currentPolicy,
);
const undone = updateEditor(edited, { type: 'UndoPressed' });
const saved = serializeConnectionDocument(captureConnectionDocument(undone));
```

The document mode is fixed for this session. Input→input, input→output and
output→output are accepted only in loose mode; both endpoints must still exist.
Loose mode preserves ordered endpoint identity and authored kinds, and grants no
policy permission or semantic symmetry. The document camera initializes the editor
unless `options.viewport` overrides it. `createEditor(graph)` remains strict, as do
older host-constructed states without `connectionMode`.

Creation and reconnection recheck current ports, duplicate links and live policies
at commit, including after a chooser or pointer preview. Reconnection checks the
changed port plus the existing end lock; whole-edge policy receives the graph
without the replaced edge. Accepted edits retain metadata and add one Undo entry;
rejections and same-endpoint reconnections add none. Undo/Redo keep session mode
and advance revision. Fresh initialization starts fresh history; no mode-changing
event is provided. Retain complete reducer state rather than mixing session modes
and history arrays. `historyLimit: 0` keeps its existing no-Undo behavior.

Headless `resolveConnectionCreation` and `resolveEdgeReconnection` include both
port kinds in loose sessions and retain protection reasons and visible/all scope.
Creation choices carry explicit `PortActivated.end` intent in loose mode: source
choices restage and target choices connect. Direct activation without `end` stages
the first port and connects the next; strict mode keeps output/input behavior.
Reducer pointer intents also use this mode. The native/custom interaction follow-up below records bounded local browser
qualification; broader accessibility and device acceptance remain open.

Save with `captureConnectionDocument(editor)` to retain mode and camera. Public
v1 graph/snapshot codecs and legacy adapter entries remain strict. Canonical v2
models/editions and explicit native v2 audit, patch, receipt, layout and Mermaid/CLI
entries preserve modes. Extracting a raw graph can lose authoring mode even when
its edges fit strict rules; explicit downgrade review remains required when
choosing v1 output. Wider C1 qualification remains partial.

See [ADR 0093](../../docs/adr/0093-adopt-connection-mode-in-headless-editor.md) and
[qualification](evidence/connection-editor.md).

### Native and custom port interactions

`zlozView` follows `editor.connectionMode`. In loose sessions mouse/touch drags can
start at either kind, and exact/nearby targets include both kinds. Native port
activation offers a source before staging and a target afterward, including Enter,
Space and touch taps. Authored `kind` stays unchanged. Current policy, read-only,
duplicate and history checks still run in the reducer.

Custom port renderers receive `context.connectionEnd` (`source | target`) for
activation feedback, alongside `active`, accepted `target` and `disabledReason`.
Compose `zlozPort` to retain its native button semantics, anchoring, labels and
input data attributes:

```ts
renderPort: (context, h) =>
  zlozPort(
    h,
    context,
    context.port,
    [h.Class('my-port')],
    [context.disabledReason ?? `${context.port.kind} · ${context.connectionEnd}`],
  );
```

Use distinct `zlozView` IDs for independent sessions. The ID scopes native Mount
lifetime and message mapping, while each complete editor retains its own history.
View retention includes mode in its dependency tuple. Pointer release publishes a
wire intent once; the subsequent pointer click is consumed while keyboard
activation remains available. `connectionEnd` describes activation; the connection
preview's moving end describes reconnection. Existing straight/path-style geometry
is unchanged and does not imply obstacle routing.

The local workbench's `/connections/` route demonstrates both sessions with a
shared sidebar, native/custom controls, live protection and light/dark themes.
Local keyboard/mouse/Chromium touch-emulation checks and screenshots are in
[interaction evidence](evidence/connection-interactions.md). Native/custom browser
interaction is now locally qualified within those bounds; real-device, AT and
cross-browser acceptance remain open. Model/edition, patch/receipt, layout and
Mermaid/CLI v2 adoption are still separate. C1 remains partial.

### Canonical v2 models and editions

Use the named v2 contracts to retain mode in a canonical model, each edition and
its pinned immediate-parent edition. Every snapshot is an explicit
`ZlozConnectionDocument`; modes may differ across checkpoints and never inherit
from the model's current snapshot.

```ts
import {
  captureConnectionDocument,
  captureEditionV2,
  captureModelDocumentV2,
  parseModelDocumentV2,
  serializeModelDocumentV2,
} from '@opsydyn/foldkit-zloz';

const edition = captureEditionV2({
  id: 'before',
  name: 'Before',
  snapshot: captureConnectionDocument(editor),
});
const document = captureModelDocumentV2({
  id: 'model:orders',
  name: 'Orders',
  snapshot: edition.snapshot,
  editions: [edition],
  origin: null,
});
const encoded = serializeModelDocumentV2(document);
const reopened = parseModelDocumentV2(encoded);
```

`ZlozModelDocumentV2`, `ZlozModelOriginV2` and `ZlozEditionV2` retain the existing
identity/name/provenance structure. Model envelopes use `foldkit-zloz-model`,
edition envelopes use `foldkit-zloz-editions`, both with numeric version 2.
`parseEditionsV2`/`serializeEditionsV2` own the independent edition archive.
Capture and serialization validate typed data before JSON encoding, then validate
detached data and deeply freeze it. Missing/future mode or version, unknown
model/edition/origin fields, duplicate edition IDs, self-parent provenance and
invalid graph/camera/JSON data reject. The codecs impose no host byte/time limit.

V1 readers remain v1-only, v2 readers v2-only. Explicit
`upgradeModelDocumentToV2`/`upgradeEditionsToV2` mark validated v1 checkpoints strict
without inventing metadata. Passing existing v2 snapshots to those upgrades
rejects rather than resetting their modes. Use the v2 capture APIs to recapture
already-v2 data.

`planModelDocumentV2Downgrade` and `planEditionsV2Downgrade` validate every owned
snapshot, including pinned origin. A loose-only edge blocks the entire prospective
v1 result; no partial history, missing provenance, fabricated ports or dropped
edges are returned. Otherwise the reviewable plan exposes prospective v1 data and
`loose-mode-removed` findings for each loose checkpoint, even when its current
edges are strict-compatible. Findings include exact snapshot paths and blocked
edge IDs. They carry no present consent, file write or Apply permission: review
them before explicitly serializing a prospective v1 result.

Current v1 snapshot writers and model/edition constructors reject explicitly v2
or loose snapshots, including loose editors whose current graph happens to fit
strict rules. Ordinary strict-editor saves still produce the existing v1 wire
format. Extracting raw graph data can still discard mode; avoid unwrapping v2
records as a substitute for explicit downgrade review. Historical implementations
may not enforce this raw-record guard; old-reader evidence covers versioned wire
rejection, not universal raw-object safety.

This is a canonical data/compatibility contract. V2 canonical initialization, read-only review and forking are delivered below.
Append/compare/restore/playback, workbench imports, patches/receipts,
layouts and Mermaid/CLI are separate adoption boundaries. The standalone v2
initializer can consume an explicitly chosen v2 snapshot; do not pass canonical
v2 records into v1 workflow APIs. C1 and broader qualification remain partial.
See [ADR 0095](../../docs/adr/0095-stage-canonical-v2-model-and-edition-documents.md)
and [qualification](evidence/model-v2.md). No npm publication or deployment.

### V2 model initialization and read-only edition review

```ts
import {
  createModelEditorV2,
  createHistoryReviewV2,
  updateHistoryReviewV2,
  parseModelDocumentV2,
} from '@opsydyn/foldkit-zloz';

const document = parseModelDocumentV2(savedText);
const working = createModelEditorV2(document);
const review = createHistoryReviewV2(document.editions[0]!, working);
const navigated = updateHistoryReviewV2(review, {
  type: 'ViewportNudged',
  delta: { x: 40, y: 0 },
});
```

`createModelEditorV2` validates the complete v2 model, including archived editions
and pinned origin, before opening its current snapshot. Mode comes from that
snapshot. Each call detaches the graph and starts fresh Undo/Redo, revision and
transient state. `EditorOptions` can override camera, read-only and history
preferences; an undefined camera inherits the snapshot camera. Passing preferences
from another editor cannot override the source mode or inherit its history.

`createHistoryReviewV2` accepts an explicitly chosen v2 edition, including a pinned
origin edition. The returned `ZlozHistoryReviewV2` retains a deeply frozen detached
`edition` pin and a separate editor whose `readOnly` type is literal `true`.
Checkpoint mode wins even when the working editor uses the opposite mode. Authored
camera wins; a camera-less checkpoint uses a detached working-camera fallback
without adding a camera to its pin. Working zoom limits, fit padding and copied
surface size are the only inherited navigation context. Invalid camera/range
combinations reject rather than rewriting stored camera data. Undo capacity is
zero; selection, clipboard, gestures, routes and history are not inherited.

Route review events through `updateHistoryReviewV2`. It reuses the existing
fail-closed history-navigation whitelist and current selection policies. Focus,
selection, surface measurement and camera/fit navigation stay independent from the
working editor. Authored edits, node measurement, connections and Undo/Redo return
the unchanged review. Navigation retains the original pin and read-only state.
Use the complete returned review; do not decode/mutate EditorState or route
unfiltered input directly to its nested editor. Independent native views require
distinct IDs to scope their bindings.

V1 initializers/reviews and all wire formats retain their existing boundaries.
V2 forking is delivered below. Append, comparison/ghosts, restore/playback, CLI
and workbench adoption remain separate; a read-only review does not Apply a checkpoint or change the
working mode. C1 and broader qualification remain partial. See
[ADR 0096](../../docs/adr/0096-initialize-v2-models-and-review-editions.md) and
[qualification](evidence/model-workflow-v2.md).

### V2 edition forking

`forkEditionV2` creates a new canonical document from a source-owned edition.
Compose its allowed result with `createModelEditorV2` for a fresh target session:

```ts
import { forkEditionV2, createModelEditorV2 } from '@opsydyn/foldkit-zloz';

const result = forkEditionV2(
  sourceDocument,
  selectedEditionId,
  {
    id: 'alternative',
    name: 'Alternative',
  },
  currentForkPolicy,
);

if (result.type === 'forked') {
  const targetEditor = createModelEditorV2(result.document);
  // Retain targetEditor in the host model; it has its own Undo/Redo.
}
```

`ZlozEditionForkPolicyV2.canForkEdition` receives a freshly validated/detached frozen
source, its owned selected edition and a frozen copied target identity. Every call
reevaluates policy. Nonempty rejection strings are retained; blank rejection
strings remain vetoes with a readable fallback. Thrown policy failures propagate
without returning a target. The host owns workspace-wide ID availability and can
veto conflicts; the package invents no IDs/timestamps and performs no registry I/O.

`ZlozEditionForkResultV2` is `forked` with a document or `blocked` with a reason.
Targets need a nonempty ID/name and an ID distinct from the source. Missing edition
or invalid identity blocks before policy. The function searches only source-owned
editions, never current state, navigated review state, origin or a foreign edition.
The complete source must validate, including unselected and origin checkpoints.
V1 data requires explicit upgrade rather than implicit strict interpretation.

An allowed document retains the selected snapshot's mode, authored ports/endpoints,
metadata, geometry and camera. Its edition list is empty. Origin pins the immediate
source model ID/name plus the immutable selected edition; target snapshot and pin
are separate detached values. A fork-of-fork pins only its immediate parent. Graph
IDs remain local and unchanged, while source/current model and working history
remain untouched.

Forking returns data, not an editor or an external write. Default v2 initialization
creates an editable target in the checkpoint mode with fresh revision, Undo/Redo,
selection and transient state. It uses the checkpoint camera, or its own default
when none is authored; review/working navigation is not inherited. Normal target
edits have independent Undo. No restore, mode-changing event or source Undo entry
is introduced. V1 behavior/wire formats stay unchanged; append, v2 comparison/ghosts,
restore/playback and CLI/workbench adoption remain separate. C1 remains partial.
See [ADR 0097](../../docs/adr/0097-fork-v2-editions-with-pinned-provenance.md) and
[qualification](evidence/edition-fork-v2.md).

### V2 edition comparison

Use `compareEditionsV2` for two explicitly selected v2 checkpoints. It validates
both in their own modes and returns detached, deeply frozen pins and deltas.

```ts
import { compareEditionsV2 } from '@opsydyn/foldkit-zloz';

const comparison = compareEditionsV2(baselineEdition, selectedEdition);
if (comparison.modeChange.kind === 'changed') {
  console.log(comparison.modeChange.before, comparison.modeChange.after);
}
// True for mode-only changes, even with no node/edge deltas.
console.log(comparison.semanticChanged);
console.log(comparison.layoutChanged);
```

`ZlozHistoryModeChangeV2` distinguishes unchanged mode from strict→loose and
loose→strict. Node/edge changes reuse the existing stable-ID comparison and its
semantic/layout separation. Mode-only changes leave both arrays empty; authored
port kinds and endpoints are retained. Moving a connected node can still report
edge layout changes. Equal edition IDs are permitted; the caller selects both
checkpoints without an implicit current-document lookup.

Aggregate semantic change includes mode and graph meaning; aggregate layout
change includes graph presentation. Edition identity/name and camera remain in
the captured pins but are excluded from these flags. They do not assert whole
checkpoint equality. Comparison has no editor, policy, Undo or Apply side effects.
The v1 `compareEditions` entry point rejects explicit v2/loose snapshots; manually
unwrapping graphs can still discard mode. Use the named versioned API.

See [ADR 0098](../../docs/adr/0098-compare-v2-editions-with-explicit-mode-changes.md)
and [qualification](evidence/history-comparison-v2.md). V2 presentation/ghosts,
append, restore/playback and CLI/workbench adoption remain separate; C1 stays
partial. No npm publication or deployment.

### V2 comparison status and ghosts

Compose the headless presentation with optional FoldKit parts. The resolver
validates both chosen checkpoints; it owns no editor, selection or lifecycle.

```ts
import { resolveHistoryComparisonPresentationV2 } from '@opsydyn/foldkit-zloz';
import {
  zlozHistoryComparisonPresentationV2,
  zlozHistoryGhostsV2,
  zlozView,
} from '@opsydyn/foldkit-zloz/foldkit';

const context = resolveHistoryComparisonPresentationV2(baseline, selected, {
  ghosts: savedGhostPreferences, // existing comparison controls' visibility type
  minimalMode,
  formatMode: (_change, text) => text, // replace for host language
});

const status = zlozHistoryComparisonPresentationV2(h, context, {
  renderMode: (current, builder) => builder.strong([], [current.modeText]),
});
const canvas = zlozView(h, review.editor, {
  id: 'edition-preview',
  label: 'Edition preview',
  onEvent,
  renderWorldOverlay: (_overlay, builder) => zlozHistoryGhostsV2(builder, context),
});
```

Render `status` alongside `canvas`; use a read-only review of `selected` for its
current geometry. Ghost geometry is in world coordinates. Hosts own selection,
preferences, layout and session mode. The presentation resolver does not update
an editor or record Undo. A mode-only transition reports the mode change and
“No node or edge changes,” with no invented ghost marks. Camera and checkpoint
metadata remain excluded from graph meaning/layout flags.

`ZlozHistoryPresentationOptionsV2` supports independent `enabled`, `nodes`, `edges`
and `movements` preferences, defaulting to true when explicitly composed. Minimal
mode masks effective master visibility without rewriting those choices or hiding
mode text. Pass the existing comparison controls' `state.ghosts` to reuse their
requests and fresh restriction checks; no second preference reducer is needed.
`formatMode` and `formatSummary` customize language; blank results use defaults.

`ZlozHistoryPresentationViewOptionsV2` exposes attributes, an accessible label,
`renderSummary`, `renderMode` and `renderLayout`. Undefined uses the default part;
null omits it. The default is an unstyled polite live status. Custom hosts must
retain accessible comparison meaning. `ZlozHistoryGhostOptionsV2` provides inert
`renderNode`, `renderEdge` and `renderMovement` hooks, with the same undefined/null
convention. Its visibility comes from the context, not drawing overrides. Default
SVG is aria-hidden and pointer-inert; custom marks must also remain inert.

See [ADR 0099](../../docs/adr/0099-present-v2-comparisons-with-mode-feedback-and-ghosts.md),
[qualification](evidence/history-presentation-v2.md) and the
[static light/dark fixture](evidence/history-presentation-v2.png).
V2 change navigation, workbench/CLI adoption, append and restore/playback remain
separate; C1 stays partial. No npm publication or deployment.

### V2 change navigation and mode inspection

Keep the host's comparison side authoritative across direct focus and
Previous/Next. Mode changes have their own entry and never borrow a node ID.

```ts
import {
  resolveHistoryChangeNavigatorV2,
  resolveHistoryChangeFocusV2,
  resolveHistoryChangeStepV2,
} from '@opsydyn/foldkit-zloz';
import { zlozHistoryChangeNavigatorV2 } from '@opsydyn/foldkit-zloz/foldkit';

const navigation = resolveHistoryChangeNavigatorV2(comparison, chosenSide, options);
const controls = zlozHistoryChangeNavigatorV2(h, navigation, {
  onFilter: (kind) => Message.ClickedHistoryFilter({ kind }),
  onFocus: (request) => Message.ClickedHistoryChange({ request }),
});

// Inside the host update, re-resolve against current comparison, side and options.
const decision = resolveHistoryChangeFocusV2(comparison, chosenSide, request, options);
const next = resolveHistoryChangeStepV2(comparison, chosenSide, cursor, 'next', options);
```

Consume comparisons from `compareEditionsV2` or the presentation context. The host
owns side, cursor and filter state. A ready decision includes an entry and target:

- `target.type === 'mode'`: inspect its checkpoint ID/side/connection mode. There
  is no editor event, geometry or mode-changing operation.
- `target.type === 'graph'`: dispatch its reveal event only to the corresponding
  checkpoint's read-only review through `updateHistoryReviewV2`. Reveal preserves
  selection and authored graph data; working history stays independent.

Save `decision.entry.request` as the cursor only for a ready result. Requests and
cursors contain both edition IDs and a discriminated identity: mode has no `id`,
node/edge have their own namespaces. Next starts at the first visible change when
there is no cursor; Previous needs a current change. Neither wraps or skips an
unavailable candidate. The current chosen side is always used, including after a
host side switch; stale scopes or hidden/missing cursors are ignored.

Mode transitions are first and counted under the `changed` filter. A mode-only
comparison has one entry, with semantic change and no layout change. Unchanged
mode creates no entry. An added/removed entity absent from the chosen side remains
visible with a reason and blocks focus. It does not silently navigate elsewhere.
Global `blockedReason`, per-entry `focusReason(item, side)`, filters and membership
are checked on every focus/step request; blank vetoes receive a readable fallback.
Exceptions propagate without returning a target. `labelChange` and `filterLabels`
customize language while retaining identity. Context, entries, requests and filters
are frozen; caller-owned preferences and comparator pins are untouched.

`ZlozHistoryChangeNavigatorViewOptionsV2` supports attributes, accessible names,
ordered filter controls, `renderFilter`, `renderEntry`, `renderStatus`,
`renderReason` and `renderLayout`. Undefined keeps defaults; null omits a part.
Compose `zlozHistoryChangeButtonV2` inside custom entries to keep native availability
and request behavior. Custom entries own list semantics. Status/counts can be
replaced or omitted without changing filters, live reasons or core navigation.

These functions consume typed validated projections rather than decode wire data.
Edition IDs scope requests; hosts own immutable identity and correct review binding.
No restore/Apply authority, working editor change, automatic side switch, timer or
Undo entry is produced. V1 navigation retains its existing behavior.
See [ADR 0100](../../docs/adr/0100-navigate-v2-changes-with-explicit-mode-inspection.md),
[qualification](evidence/history-navigation-v2.md) and
[static light/dark evidence](evidence/history-navigation-v2.png).
V2 append/merge, restore/playback and CLI/workbench adoption remain separate;
C1 stays partial. No npm publishing or deployment.

### V2 edition append and identity conflicts

Append a caller-supplied checkpoint without borrowing mode from the current model.
The complete archive and candidate are validated, detached and deeply frozen.

```ts
import { appendEditionV2, captureModelDocumentV2, compareEditionsV2 } from '@opsydyn/foldkit-zloz';

const result = appendEditionV2(model.editions, proposedEdition);
if (result.type === 'appended') {
  const updated = captureModelDocumentV2({ ...model, editions: result.editions });
  // The host decides when/how to store updated; current snapshot and origin retain their modes.
} else if (result.code === 'edition-conflict') {
  const review = compareEditionsV2(result.existing, result.proposed);
  // Review only: no existing edition is replaced and no editor mode changes.
} else {
  // duplicate-edition: the ID already names the same checkpoint; append remains blocked.
}
```

`ZlozEditionAppendResultV2` returns either the appended archive or a blocked result
with a readable reason and immutable existing/proposed pins. A blocked result has
no `editions` field. Reused IDs always block, including identical duplicates,
matching the existing append rule. `duplicate-edition` means the whole checkpoint
value matches; `edition-conflict` means the same ID names different data. Nothing
is silently renamed, overwritten or treated as an import merge.

Object-key order does not affect equality. Name, explicit mode, camera, payloads,
geometry and authored array order do. Consequently a mode-only change is a
conflict even if both graphs satisfy strict rules. Name/camera-only conflicts may
have no graph/mode deltas in `compareEditionsV2`; inspect the returned pins for those
fields. Node/edge ordering remains authored data and is not sorted for append.

Every existing entry and the proposed checkpoint must be valid v2 data; malformed
input or duplicate IDs already present in the archive throw the existing validation
error before returning a result. V1-shaped records require explicit upgrade.
Success preserves archive order and appends exactly one checkpoint. IDs/names stay
verbatim; clocks, timestamps and replacement identities are host-owned. Original
arrays and nested data remain unfrozen and untouched.

The helper owns an archive list, not a containing model or editor. Hosts own model
binding, wider identity allocation, application permissions and persistence. Use
`captureModelDocumentV2` to validate a containing model when composing success.
Current/origin snapshots, working Undo and independent read-only review history
are unaffected. No restore/Apply or external write authority is implied.

See [ADR 0101](../../docs/adr/0101-append-v2-editions-with-explicit-identity-conflicts.md)
and [qualification](evidence/edition-append-v2.md). V2 merge, restore/playback and
CLI/workbench adoption remain separate; C1 stays partial. No npm publishing or
deployment.

### Complete v2 history workflow

Use v2 archive merge, model initialization, restore and playback together. The
core owns the transactions; hosts own preview binding, persistence and UI state.

```ts
import {
  mergeEditionsV2,
  createModelEditorV2,
  resolveEditionRestoreV2,
  restoreEditionV2,
  createEditionPlaybackV2,
  updateEditionPlaybackV2,
  reviewEditionPlaybackV2,
} from '@opsydyn/foldkit-zloz';

const merged = mergeEditionsV2(model.editions, importedEditions);
const working = createModelEditorV2(model);
const options = {
  expectedRevision: working.revision,
  policy: {
    canRestoreEdition: (edition, current) =>
      mayRestore(current.connectionMode, edition.snapshot.connectionMode) ? null : 'Protected',
  },
};
const preview = resolveEditionRestoreV2(working, checkpoint, options);
// On confirmation, use the pinned checkpoint and re-resolve against current state/policies.
const result = restoreEditionV2(working, checkpoint, options);

const playback = createEditionPlaybackV2(model.editions); // paused; reduced motion defaults true
const next = updateEditionPlaybackV2(playback, { type: 'NextClicked' });
const historical = reviewEditionPlaybackV2(next, working); // read-only, checkpoint-owned mode
```

`mergeEditionsV2` validates both whole collections, preserves mixed modes and is
idempotent for identical IDs/data. Conflicts return `blocked` with immutable pins
and no archive; no partial additions or overwrite. Success returns `merged` or
`unchanged` with a detached frozen archive. Malformed collections throw through
the existing core error contract, including duplicates within either collection.

`createModelEditorV2` now initializes full graph+mode `connectionHistory` frames.
These frames own Undo/Redo; `past`/`future` remain synchronized graph projections
for native controls. Do not independently patch the projections. Commits, native
gestures, measurement, limits and redo invalidation preserve checkpoint modes.
Legacy editors and standalone connection-document initialization retain fixed-mode
graph history. This runtime history is never serialized into canonical documents.

Restore requires a mode-aware v2 model session, matching `expectedRevision`, idle
editable state, no active label draft/host `busyReason`, and enabled Undo for a real
change. Whole-transaction and granular policies run fresh against detached data.
Callbacks can veto mode changes through the whole `canRestoreEdition` hook; blank
reasons receive a readable fallback. A thrown policy failure returns no target.
Mode-only restores record one step; exact graph+mode repeats do not. Undo/Redo
restore graph and mode together. Working camera, archive and origin stay unchanged.
An incompatible cross-mode clipboard paste reports a reason and preserves the
clipboard/Redo instead of coercing port kinds or throwing.

`createEditionPlaybackV2` pins validated editions and reuses the existing timing
controller. Apply events through `updateEditionPlaybackV2`, then materialize an
independent review with `reviewEditionPlaybackV2`. Empty collections return no
review. Keep timer lifetime, stale run tokens, page visibility and user inspection
in host subscriptions; playback never edits the working session. Reduced-motion
changes pause automatic play while manual stepping and rewind remain available.

For baseline rendering, pass `displaySide: 'baseline'` to
`resolveHistoryComparisonPresentationV2`. Ghosts use the other checkpoint's geometry
and point toward the displayed side without reversing chronological change meaning.
Semantic mode/status remains baseline→selected. Default selected-side rendering is
unchanged; custom mark hooks retain chronological change records.

The mounted `/history/` workbench composes capture/merge/model/archive I/O,
comparison/ghosts/navigation, guarded restore and mixed-mode playback in the shared
sidebar shell. File I/O is bounded to 5 MiB/fatal UTF-8; queued callbacks are scoped
and downloads release their URLs. Opening a model starts fresh history and retains
one previous working session for explicit return. Existing architecture/connection
workspaces remain independent.

[ADR 0102](../../docs/adr/0102-complete-v2-history-workflows.md) and
[qualification](evidence/history-workflow-v2.md) define the complete boundary.
Existing v1 codecs reject v2 envelopes/explicit snapshots. Mermaid, patches,
receipts, review packets and CLI have separate versioned adoption gates; this batch
does not silently upgrade or unwrap their documents. No npm publishing/deployment
or full C1/C2–C4/Q/R completion is implied.

### V2 portable adapter capabilities

`assessPortableCompatibilityV2(model)` validates every current, edition and origin
checkpoint and reports adapter capabilities, strict-incompatible edge IDs and
whole-model downgrade findings. It returns review data only: no converted model,
consent or Apply permission. `format-capability-only` does not imply that a chosen
layout engine supports every graph.

```ts
const report = assessPortableCompatibilityV2(model);
// layout: supported; mermaid: explicit v2 projection
// native v2 patches, conversion receipts, review packets and audits: supported
```

`layoutRequest` carries the current mode; manually authored requests default to
strict when mode is absent. ELK/force preserve endpoint identity and Apply checks
mode alongside request identity/revision. Geometry changes retain graph-and-mode
Undo in v2 model sessions. No layout operation changes mode.

The optional Mermaid package exposes `exportConnectionMermaid(document, options)`;
keep its v2 protocol and mode with its identity map. V1 graph export stays strict.
Explicit v2 patches, receipts, packets and audits preserve native modes. Their v1
entries retain strict contracts. Never unwrap a loose graph or silently downgrade
a model to reach a legacy API. See
[ADR 0104](../../docs/adr/0104-adopt-native-v2-authoring-and-review.md).

### Native v2 authoring and evidence

Use `auditConnectionDddRelationships` / `auditConnectionEventStormingRelationships`
for explicit v2 snapshots, and `compareModelDddRelationshipsV2` /
`compareModelEventStormingRelationshipsV2` for owned edition comparisons. Each
comparison side includes its checkpoint mode. Domain findings still concern DDD
or causal meaning; a mode-only change does not invent a relationship finding.

`foldkit-zloz-patch` v2 pins required `source.connectionMode` alongside model ID,
session, revision and graph. `parseModellingPatchV2` checks bounded raw text,
duplicate keys, exact fields and graph validity. The six graph operations preserve
mode and ordered port identity; they do not change connection mode.

```ts
const decoded = parseModellingPatchV2(proposalText);
if (decoded.status === 'parsed') {
  const review = resolveModellingPatchReviewV2(editor, identity, decoded.value);
  // Present review.preview and its losses; bind affirmative host consent to review.key.
}
```

`applyModellingPatchV2` rebuilds live source/policies and requires exact affirmative
review/loss consent, an idle editable v2 model session and enabled Undo. Publish
returned editor and receipt together. `serializeModellingPatchReceiptV2` /
`parseModellingPatchReceiptV2` validate the v2 result snapshot, unchanged mode,
next revision and recorded flags by recomputing the patch. This receipt covers the
graph patch, not model archives or camera history. Reopening never grants consent.

C4 and DDD have explicit `previewEventStorming*MappingV2`,
`createEventStorming*ConversionPlanV2`, `resolveEventStorming*ConversionConsentV2`
and `applyEventStorming*ConversionV2` entries. Their named v2 source/plan/policy/
result aliases preserve complete canonical source and target models, including
camera, archive and origin checkpoint modes. One Undo reverses the conversion.
`serializeEventStormingC4ConversionV2` / `parseEventStormingC4ConversionV2` and the
corresponding DDD functions use version-2 receipt envelopes and recompute complete
targets before reopening. V1 readers reject v2; no port rewriting or silent model
downgrade occurs.

Native receipt text has 2,000,000-character, depth-64 and 100,000-value limits;
object ownership also rejects accessors and non-JSON values. Creation/serialization
check reopening budgets before returning portable success. Recorded actor IDs,
acceptance and review keys prove neither authorship nor current authority.

The optional Mermaid package provides `createReviewPacketV2`,
`parseReviewPacketV2` and `openReviewPacketV2` for selected-snapshot evidence and
independent read-only review. Its v1 entries remain fixed at v1. Mounted workbench
file/control adoption is a separate slice; these APIs are package-owned.

### Standalone v3 group documents

The v3 wire envelope makes world coordinates, connection mode and the group-port
capability explicit. It is a standalone data contract, not an editor/model/archive
version or an npm package version. Existing v1/v2 readers and editors keep their
portless-group rules; no editor option silently widens them.

```ts
import {
  captureGroupDocumentV3,
  parseGroupDocumentV3,
  serializeGroupDocumentV3,
  upgradeGroupDocumentV3,
  planGroupDocumentDowngradeV3,
} from '@opsydyn/foldkit-zloz';

const document = captureGroupDocumentV3({
  version: 3,
  coordinateSpace: 'world',
  connectionMode: 'strict',
  capabilities: { groupPorts: true },
  graph: {
    nodes: [
      {
        id: 'orders',
        label: 'Orders boundary',
        kind: 'group',
        position: { x: 100, y: 80 },
        size: { width: 400, height: 300 },
        ports: [{ id: 'events', kind: 'output', side: 'right', offset: 0.5 }],
      },
    ],
    edges: [],
  },
});
const decoded = parseGroupDocumentV3(serializeGroupDocumentV3(document));
const downgrade = planGroupDocumentDowngradeV3(document); // blocked, including unconnected ports
const upgraded = upgradeGroupDocumentV3({ graph: { nodes: [], edges: [] } });
// upgraded has strict mode and groupPorts: false; no source data is mutated.
```

`captureGroupDocumentV3` owns and freezes plain data without executing getters or
`toJSON`; malformed construction throws `ZlozError`. `validateGroupDocumentV3`
revalidates the full envelope. `parseGroupDocumentV3` returns `parsed` with a frozen
value or `rejected` with `code`, `reason` and JSON Pointer `path`, never a partial
value. Syntax/limits/malformed data are distinguished from unsupported versions,
coordinates or capabilities. Invalid limit options throw rather than weakening
validation. Limits can only tighten the defaults: 2,000,000 UTF-16 characters,
depth 64 and 100,000 values. Hosts separately bound bytes and decode UTF-8.
Serialization also checks the canonical output against reopening limits. Capture
publishes native JSON number canonicalization (including negative zero to zero);
nonfinite values are rejected before encoding.

Only groups can parent children, with positions retained in world coordinates at
every depth. Group ports require `capabilities.groupPorts: true`; lanes and
hotspots remain portless. C4/DDD descriptors and ordered connection meaning are
not inferred from ports. Unknown structural fields are rejected; use `data` for
owned JSON extensions.

`upgradeGroupDocumentV3` accepts only standalone v1 graph/snapshot envelopes,
unversioned snapshots or v2 connection documents. It preserves coordinates,
identity, camera and mode (strict for v1), enabling no group ports. It rejects
model/archive envelopes and unknown structural fields instead of guessing or
silently dropping them. A portless downgrade produces a detached reviewed v2
`document`; removing an enabled future group-port capability is disclosed in
`losses`. Ported groups produce findings and **no target**, without dropping ports
or retargeting edges. Neither operation grants Apply authority.

The structurally shared `ZlozGroupGraphV3` is meaningful under its full v3
envelope; extracting just `graph` does not carry its capability into an old API.
Explicit v3 editor initialization and document Undo are described below. Canonical
model/edition history, patches/receipts, layouts, image export, Mermaid, CLI and
native controls remain separate version-required adoption gates.
See [qualification](evidence/group-document-v3.md) before assuming adapter support.

### Explicit v3 editor sessions and document Undo

`createGroupEditorV3` initializes a distinct headless session from the **complete**
validated v3 document. It owns/freezes the input, preserves mode/capability/camera
and starts at revision zero. The host supplies a unique `sessionId` for each new
incarnation. Sessions are trusted runtime state, not a serialized archive. They
have a single authored `document` and deliberately have no legacy `graph` root.

```ts
import {
  createGroupEditorV3,
  captureGroupEditorSourceV3,
  applyGroupEditorTransactionV3,
  updateGroupEditorV3,
  resolveGroupEditorBoundaryV3,
} from '@opsydyn/foldkit-zloz';

// document is the v3 envelope from the preceding example.
const editor = createGroupEditorV3(document, {
  sessionId: 'host-allocated-incarnation',
  historyLimit: 100,
});
const applied = applyGroupEditorTransactionV3(editor, {
  source: captureGroupEditorSourceV3(editor),
  document: { ...editor.document, viewport: { x: 40, y: 20, zoom: 1.25 } },
});
const undone = updateGroupEditorV3(applied.editor, {
  type: 'UndoPressed',
  source: captureGroupEditorSourceV3(applied.editor),
});
const clipboard = resolveGroupEditorBoundaryV3(undone.editor, 'clipboard');
// unchanged: use the distinct native clipboard APIs below; never use legacy graph paste.
```

Apply takes an exact source token and a complete proposed document. It returns
`applied`, `unchanged` or `blocked` with a `code` and visible `reason`; all outcomes
carry `editor`. Publish only that returned session. A stale session/revision/full
document, invalid target, active `activity`, read-only state, disabled history,
exhausted revision or policy veto leaves the original session/history unchanged.
No-op retains references and Redo. New changes clear Redo; history defaults to 100
frames and may be bounded to 0–1000. Zero disables authored changes in this API.
Constructor misuse throws `ZlozError`; unexpected host/policy exceptions propagate.

Undo/Redo require fresh tokens and rerun live policies in the travel direction.
Each frame retains its own full v3 document, including strict/loose mode,
coordinate convention, group-port capability and optional viewport. Revision
always increases, including travel. Permissions and lifecycle never rewind.
Hosts update `readOnly` and the tagged `activity` (`idle` or `busy` with a reason)
in their immutable model; documents and history remain package-owned values.

The optional third argument is `ZlozGroupEditorPolicyV3`: existing granular
`EditorPolicy` hooks plus `canCommitGroupDocumentV3(candidate)`. The latter receives
frozen `source`, `target`, operation (`apply`/`undo`/`redo`), session and revision,
and covers combined changes, labels/data, mode, capability and camera. Return a
reason to veto, including during Undo. Port removal/deletion/reconnection checks
cover the complete changed entities. A protected incident edge prevents removal;
changing group/ordinary node kind cannot reuse shared port identities. The guard
is symmetric so an accepted promotion has a reversible inverse. Explicit
port/connection removal or replacement may be part of the same complete
transaction, so Undo can reverse the introduction of a group boundary.

This transaction does **not** infer a drag, group expansion, deletion or reparent
plan: include every intended affected child/ancestor in the target, retaining
world coordinates. The v3 connection/group/workbench APIs below supply those plans. Legacy
`createEditor`/`updateEditor` and v1/v2 serializers remain closed to v3 sessions.
`resolveGroupEditorBoundaryV3` reports availability for the distinct native-controls,
model, edition, clipboard, layout, SVG, PNG and optional Mermaid entries documented
below. Patch and review-packet entries remain blocked pending native adoption.
It is a compatibility decision, never adapter authority. Standalone document
serialization works; no other adapter is qualified by extracting its bare graph.
See [the editor qualification receipt](evidence/group-editor-v3.md) and
[ADR 0106](../../docs/adr/0106-initialize-v3-editor-sessions-with-document-history.md).

### Headless v3 group-port editing

`planGroupPortEditV3` previews one group-port edit against the exact live v3 source.
It returns `ready`, `unchanged` or `blocked` with a visible `code` and `reason`.
Ready plans contain an owned `request`, a complete `transaction`, `before`/`after`
port values and all `removedEdges`. Preview leaves editor, revision and Undo/Redo
history untouched. These APIs are in the peer-free core entry.

```ts
import {
  planGroupPortEditV3,
  applyGroupPortEditV3,
  captureGroupEditorSourceV3,
  updateGroupEditorV3,
  type ZlozGroupPortEditRequestV3,
  type ZlozGroupEditorPolicyV3,
} from '@opsydyn/foldkit-zloz';

// editor is the explicitly initialized v3 session above.
const policy: ZlozGroupEditorPolicyV3 = {
  canEditPort: ({ port }) => (port.id === 'audit' ? 'This audit socket is protected.' : null),
};
const request: ZlozGroupPortEditRequestV3 = {
  source: captureGroupEditorSourceV3(editor),
  edit: { operation: 'remove', endpoint: { node: 'orders', port: 'events' } },
};
const preview = planGroupPortEditV3(editor, request, policy);
if (preview.type === 'ready') {
  // Show preview.before/after and every preview.removedEdges before user action.
  // Apply takes intent, recomputing current protections; the target is not authority.
  const result = applyGroupPortEditV3(editor, preview.request, policy);
  const undone = updateGroupEditorV3(
    result.editor,
    {
      type: 'UndoPressed',
      source: captureGroupEditorSourceV3(result.editor),
    },
    policy,
  );
}
```

| Edit `operation` | Payload                              | Authored effect                                                                    |
| ---------------- | ------------------------------------ | ---------------------------------------------------------------------------------- |
| `add`            | `nodeId`, full identified `port`     | Appends the port; existing order is retained.                                      |
| `label`          | `endpoint`, `label: string \| null`  | Sets the exact string, including empty; `null` removes the optional field.         |
| `position`       | `endpoint`, `position: PortPosition` | Switches exclusive offset/anchor representation; keeps identity, kind and label.   |
| `remove`         | `endpoint`                           | Removes the port and every attached source/target edge, including self-loops once. |

An eligible existing group and explicit `capabilities.groupPorts: true` are
required. Ordinary nodes, EventStorming lanes/hotspots, missing nodes/ports,
duplicate port IDs and malformed edits report reasons without promoting nodes,
enabling capability or dropping unrelated content. Edit objects are bounded,
owned plain data: getters are rejected without evaluation, unknown fields are
rejected and position geometry uses the existing finite `[0,1]` port contract.
No snapping, direction/kind change or inferred endpoint creation is performed.

Preview and Apply reuse the v3 kernel's exact source/session/revision/lifecycle,
read-only, history and capacity checks. Existing granular port/edge policies and
`canCommitGroupDocumentV3` receive frozen complete data. Protected incident edges
veto the whole removal. Apply rebuilds from the request and reruns live checks;
passing a cached document transaction as edit intent is rejected. It invokes the
proposed-change policy once, with no hidden prospective editor/history allocation.
Unexpected policy defects propagate without publishing state.

A successful edit, including all attached-edge deletions, is one Undo unit.
Undo/Redo rerun the current policies and retain full mode, capability, world
coordinates, metadata and camera. No-op retains editor identity and Redo; a new
actual edit clears Redo. Use the returned `editor` for every outcome.

These are headless runtime plans, not a new wire artifact, native control,
connection/reconnection planner or canonical model/adapter upgrade. Those adoption
gates stay explicit. See [qualification](evidence/group-port-edit-v3.md) and
[ADR 0107](../../docs/adr/0107-plan-v3-group-port-edits-through-live-transactions.md).

### V3 connections, group operations and native workbench

Use `planGroupConnectionV3` / `applyGroupConnectionV3` for explicit creation sets
and reconnection. Every request pins `captureGroupEditorSourceV3(editor)` and
preserves ordered endpoint identity. A protected or invalid member rejects a
whole explicit connection set. Reconnection retains edge identity/metadata.
`planGroupOperationV3` / `applyGroupOperationV3` implement move, resize, reparent,
group, ungroup and delete with complete descendant/ancestor effects. Extents,
resize limits and live policies are checked before one Undo publication. A ported
group cannot be ungrouped implicitly: first handle its ports/connections explicitly.

```ts
import {
  captureGroupEditorSourceV3,
  planGroupConnectionV3,
  applyGroupConnectionV3,
} from '@opsydyn/foldkit-zloz';

const request = {
  source: captureGroupEditorSourceV3(editor),
  edit: {
    operation: 'create',
    edges: [
      {
        id: 'orders-api',
        source: { node: 'orders', port: 'api' },
        target: { node: 'warehouse', port: 'input' },
      },
    ],
  },
} as const;
const preview = planGroupConnectionV3(editor, request, livePolicy);
// On explicit confirmation, rebuild against the current editor and policy.
const result = applyGroupConnectionV3(editor, request, livePolicy);
```

`createGroupWorkbenchV3(document, { sessionId })` and
`updateGroupWorkbenchV3(model, event, policy, { grid: 20 })` compose native/custom
controls without creating a legacy editor. Keep the returned model in the host
Foldkit Model. `zlozGroupWorkbenchV3`, `zlozGroupInspectorV3`,
`zlozGroupActionV3` and `zlozGroupDragHandleV3` are optional `/foldkit` views.
Use unique view IDs. Custom node content remains beside live ports; compose the
drag-handle primitive and place custom interactive controls outside its button.
Theme tokens and existing diagnostics/minimal settings apply. Policy reasons stay
with protected controls; announcements remain accessible in minimal mode.
Pointer/touch capture and cleanup use the existing scoped input resource.

The v3 surface qualifies pointer node movement/connections, keyboard
selection/nudging/connections, inspector resizing/group-port edits/reconnection,
collapse and custom content/actions. Direct pointer resize/reconnection,
port-anchor dragging, box selection, pinch and minimap remain outside this v3
surface's qualified subset. `captureGroupWorkbenchDocumentV3` captures the live
camera for save/checkpoint DTOs without mutating the editor. A host can publish
that camera through the ordinary v3 transaction before capturing an edition.

### Canonical v3 models and editions

`captureModelDocumentV3`, `serializeModelDocumentV3` and `parseModelDocumentV3`
validate a canonical `{id,name,snapshot,editions,origin}` body. The wire format is
`foldkit-zloz-model`, version 3. Each current/edition/origin snapshot retains its
own full v3 capability, mode and camera. `captureEditionV3`, `serializeEditionsV3`
and `parseEditionsV3` own/freeze archive entries. Limits: 16,000,000 UTF-16 text
characters, depth 80, 1,000,000 JSON values and 1,000 editions; each checkpoint
also keeps the tighter standalone 2,000,000/depth-64/100,000-value limits.
Unknown/duplicate fields, duplicate edition IDs, prototypes/accessors and invalid
numbers reject. V1/v2 readers reject v3; `upgradeModelDocumentV3` is explicit.

`createModelEditorV3` requires a fresh host session identity. `captureWorkingModelV3`
builds a canonical DTO from the live editor. `createHistoryReviewV3` creates an
independent read-only, history-disabled session. `compareEditionsV3` reports graph,
mode-only and capability-only changes. `mergeEditionsV3` is additive/idempotent;
conflicting IDs return no prospective archive. `forkModelDocumentV3` requires a
new model ID and pins the exact immediate-parent edition. `restoreModelEditionV3`
pins model identity, exact catalogue entry and source session/revision/document,
reruns live policies and publishes one complete-document Undo unit.

`planModelDocumentDowngradeV3` inspects every checkpoint; any authored group port
blocks the entire downgrade and returns no target. Removing an unused enabled
group-port capability is an explicit finding. Never extract a bare graph to
bypass a version or capability boundary.

`assessPortableCompatibilityV3` inventories checkpoints and independently reports
entry availability. Private Effect CLI `zloz compatibility inspect-v3 -i model.json`
prints that read-only inventory with the existing 1 MiB UTF-8 input budget.
V3 patches, conversion receipts, review
packets and relationship audits remain version-required. Their v1/v2 APIs are
unchanged. Rotation, whiteboard tools, dedicated multi-connect UI, production
Mermaid import, server PNG, broad performance and human device/screen-reader
acceptance remain explicit release limits. See [batch qualification](evidence/v3-core-batch.md).

<a id="native-v3-layout-unreleased"></a>

### Native v3 layout

`groupLayoutRequestV3(editor, requestId, options?)` captures the full source
session/revision/document plus optional edge-label and group-header bounds.
Store it as the host Model's active request. The optional ELK package exposes
`createElkGroupLayoutV3({ direction: 'RIGHT' | 'DOWN', spacing?, elk? })`.
`applyGroupLayoutV3(currentEditor, currentActive, result, livePolicy?)` validates
complete world geometry and preserved anchors before one atomic kernel commit.
Group ports/endpoints, mode, capability, data and camera remain intact. All node
moves and group resizes are checked against current policy; stale/partial results
publish nothing. Authored resize and parent-extent constraints also apply.

`applyGroupWorkbenchLayoutV3` rejects an active gesture, updates the native
controller and retains accepted routes transiently. `groupWorkbenchRoutesV3`
returns routes only for its exact current document, idle gesture and uncollapsed
projection. The `/foldkit` native view uses them with authored-waypoint precedence.
Undo restores the complete pre-layout document and invalidates routes. Layout of
identical geometry is a no-op in history. Use a new request ID for every run and
clear the active request on cancellation/replacement/read-only review. A source
token is freshness data, never cached permission. Engine errors remain rejected
Promises; known invalid geometry becomes a blocked decision; policy defects
propagate. Core has no ELK dependency.

See [native ELK qualification](evidence/v3-elk-layout.md) for coverage and limits.

<a id="native-v3-svg-projection-and-review-unreleased"></a>

### Native v3 SVG projection and review

Use `planGroupSvgExportV3(document, options)` and
`writeGroupSvgExportV3(document, options, writing?)` for complete native v3
sources. They validate/own the document before sharing SVG projection internals;
legacy `planSvgExport` / `writeSvgExport` remain version-fixed and reject authored
group ports. Native plans retain `version: 3` and the immutable `document`;
`plan.graph` aliases that document's graph. Export changes no editor state or Undo.

```ts
import { writeGroupSvgExportV3, type ZlozGroupSvgExportOptionsV3 } from '@opsydyn/foldkit-zloz';

const options: ZlozGroupSvgExportOptionsV3 = {
  title: 'Orders model',
  region: { type: 'model', padding: 48 },
  theme: { colorScheme: 'dark' },
  background: { type: 'theme' },
  font: { family: 'sans-serif', size: 14, weight: 400 },
  renderers: { nodes: 'built-in', edges: 'built-in' },
};
const result = writeGroupSvgExportV3(documentV3, options);
// Inspect result.findings. Only a written result contains SVG bytes.
```

Nested rectangular groups, group-port artwork and authored endpoint anchors are
preserved. Group sockets paint above crossing edges. Root data attributes declare
v3, strict/loose mode and group-port capability. SVG is a static vector projection,
not a model codec: arbitrary data, history and interactive tools are not embedded.
Use canonical model JSON to move editable models. Model, viewport crop and explicit
bounds, scale, themes, backgrounds, safe custom primitives and embedded TrueType
validation use the same existing SVG contracts. `ZlozGroupSvgAdapterV3` callbacks
add a frozen full native document to the node/edge geometry context. A custom node
adapter owns its socket artwork; declarations are host assertions, not fidelity
certification. Raw markup, scripts, remote resources and foreignObject are excluded.

For retained native ELK geometry, call
`captureGroupSvgLayoutV3(documentV3, routes, renderKey)` and pass
`layout: { snapshot, renderKey }`. Routes are owned, bounded and anchored to the
source ports. Source identity covers the entire v3 document, including camera,
mode and capability. Mismatched source/key blocks; forged snapshot metadata or
invalid routes rejects. Authored waypoints/path style retain geometry precedence.
Custom label content, fonts, ink/stroke bounds and renderer fidelity remain
explicit findings rather than a universal collision/fit promise.

```ts
import {
  createSvgReview,
  resolveGroupSvgReviewV3,
  updateGroupSvgReviewV3,
  type ZlozGroupSvgReviewContextV3,
} from '@opsydyn/foldkit-zloz';

const review = createSvgReview(sessionId);
const context: ZlozGroupSvgReviewContextV3 = {
  scope: sessionId,
  sourceRevision: editorV3.revision,
  document: editorV3.document,
  title: 'Orders export',
  theme: { colorScheme: 'light' },
  renderers: { nodes: 'built-in', edges: 'built-in' },
};
const controls = resolveGroupSvgReviewV3(review, context);
// Render controls with /foldkit's composable zlozSvgReview primitives.
// On a view request, recompute the context from the current Model:
const next = updateGroupSvgReviewV3(review, context, request);
// next.payload, when present, is a detached file payload for a host Command.
```

Fallback, approximation and omission require explicit acceptance for the exact
source/settings/produced bytes. Unsupported content cannot be accepted away.
Native consent is stricter than legacy whole-model consent: camera changes also
invalidate it. Current `canDownload(document, options)` protection is rechecked
at handoff; consent never caches permission. Pending job identities prevent stale
completion messages from settling newer jobs. Review state/presentation primitives
are shared, while native context/writer/result types stay explicit. Read-only
edition export is allowed when the host policy permits it. The workbench captures
its live camera and exports authored content, not collapse/selection/diagnostics.

See [native SVG qualification](evidence/v3-svg-export.md) and the distinct native
PNG entry below. SVG support alone does not authorize rasterization.

<a id="native-v3-png-export-unreleased"></a>

### Native v3 PNG export

`planGroupPngExportV3(input)` invokes the same native SVG writer and preserves its
full document and findings before adding `rasterization-loss`. Planning is pure:
`ready` means supported geometry/budgets, not permission to encode. The optional
`/browser` entry exposes `renderGroupPngExportV3(input, { signal?, timeoutMs? })`.
It rebuilds `writeGroupSvgExportV3`, checks reviewed `expectedSvg` bytes and only
then allocates image/canvas/encoder resources. No legacy snapshot or graph-only
conversion is used. The core and browser entry remain safe to import under SSR;
calling the rasterizer without a browser returns `unsupported`.

```ts
import {
  createPngReview,
  resolveGroupPngReviewV3,
  updateGroupPngReviewV3,
  type ZlozGroupPngReviewContextV3,
} from '@opsydyn/foldkit-zloz';

const state = createPngReview(sessionId);
const context: ZlozGroupPngReviewContextV3 = {
  scope: sessionId,
  sourceRevision: editorV3.revision,
  document: editorV3.document,
  title: 'Orders PNG',
  theme: { colorScheme: 'light' },
  renderers: { nodes: 'built-in', edges: 'built-in' },
};
const controls = resolveGroupPngReviewV3(state, context);
// Compose /foldkit's zlozPngReview, zlozPngAction and zlozPngPreview.
const next = updateGroupPngReviewV3(state, currentContext, request);
// When next.payload exists, a Command calls:
// renderGroupPngExportV3(next.payload.input, { signal }) from /browser.
// Feed its result back as PngRenderSettled with the payload identity/run.
```

PNG consent is separate from SVG consent and always includes raster flattening.
The review key covers full v3 source, current revision/session, SVG bytes,
settings and PNG budgets. Native render jobs detach the document, data-only
options, validated retained routes, adapter records and font bytes. Callback
closures remain host code: a changed callback output fails the reviewed-SVG byte
comparison. Source/mode/capability/camera, settings, policy and consent are
rechecked before render, on completion and before download. Cancelled/superseded
or stale replies cannot publish a preview. Current `canDownload` also protects
rendering; consent never caches permission. Read-only edition export is allowed
when the host permits it, without changing the working editor or Undo.

Whole model, explicit crop, measured viewport, 1×/2×/3× (or configured) scale,
light/dark backgrounds and transparency use the SVG contract. Dimension ceilings
are integers: default maximum 8192 per side, 8,388,608 pixels and 8,388,608 encoded
bytes; configurable maxima are 16384, 16,777,216 pixels and 33,554,432 bytes.
Invalid dimension/pixel budgets block before allocation; the encoded byte budget
is checked after encoding. Timeout is 1–30000 ms (default 10000). Abort/deadline
paths release URLs, readers, handlers and canvas storage. Synchronous draw/encode
cannot always be physically interrupted; logical cancellation rejects results.

Only an actual rendered PNG appears in preview. Download reuses that exact data
URL without rerendering. Native settlement additionally checks bounded base64
byte length and IHDR dimensions against the plan. This is a trusted renderer
artifact contract, not a decoder/importer for untrusted PNG files. Native group
ports become pixels; editable semantics/history are not embedded. Keep canonical
JSON and SVG separately. Browser/font/antialiasing and custom-renderer findings
remain explicit; native server-side PNG is not implemented.

See [native PNG qualification](evidence/v3-png-export.md) for actual browser
pixel/download evidence, resource cleanup and source/policy/cancellation tests.

<a id="native-v3-session-clipboard-unreleased"></a>

### Native v3 session clipboard

`copyGroupSelectionV3` validates the complete native source, includes selected
nodes plus every descendant once, and captures internal edges with authored ports.
Selecting a child alone detaches its external parent/extent/expansion; crossing
edges are omitted. Both effects produce visible findings. The returned frozen
`ZlozGroupClipboardV3` keeps the fragment's connection mode and group-port
capability, excludes the camera and changes neither editor nor Undo. Copying a
read-only edition is allowed; `canCopyGroupFragmentV3` can veto the full fragment.

```ts
import {
  copyGroupSelectionV3,
  groupPasteRequestV3,
  planGroupPasteV3,
  applyGroupPasteV3,
} from '@opsydyn/foldkit-zloz';

const copied = copyGroupSelectionV3(editor, ['orders']);
if (copied.type === 'copied') {
  const request = groupPasteRequestV3(editor, copied.clipboard, {
    offset: { x: 40, y: 40 },
  });
  const plan = planGroupPasteV3(editor, request, livePolicy);
  if (plan.type === 'ready') {
    const result = applyGroupPasteV3(editor, plan.request, currentPolicy);
    // Publish result.editor only. An applied paste is one full-document Undo.
  }
}
```

Requests contain explicit complete node/edge/scoped-port identity maps. The factory
allocates collision-free defaults; pass `identities` for designer/host-owned IDs.
Node/edge IDs must be fresh across original fragment and target namespaces; port
IDs are scoped to each original owner and may retain local spelling when the
owner changes. Every mapping must be exact, with distinct output port IDs per
owner. Parents and endpoints follow the maps. World positions and authored bends
receive exactly one offset; waypoint IDs remain scoped to their new edge. Opaque
`data` and semantic metadata are preserved unchanged: application references
inside them are not inferred or rewritten.

Plan and Apply validate the full target, scoped identities and parent geometry.
Apply rebuilds from immutable intent and rechecks session, revision, full document,
current port/connection/complete-transaction policies, lifecycle and Undo settings.
An old plan grants no authority. Mismatched mode or group-port capability is
blocked; no automatic enablement, conversion or port-kind coercion occurs. Camera,
existing nodes/edges and clipboard stay unchanged on rejection. A successful paste
keeps the target mode/capability/camera and publishes everything in one transaction.

`createGroupWorkbenchV3` owns transient `clipboard` / `clipboardFindings`.
`updateGroupWorkbenchV3` handles **CopyPressed**, **PastePressed** and custom
**GroupPasteRequested** facts; the existing native input adapter supplies keyboard
shortcuts. Gesture/busy/read-only/protection reasons remain visible. Clipboard is
not captured by model/editions/Undo and is reset by a new session.
`groupWorkbenchPasteRequestV3(model, step)` advances repeated offsets to avoid
occupied node anchors; exact custom placement remains available through the core
factory. Set `pasteOffset` in controller options for keyboard placement.

Optional `/foldkit` **`zlozGroupClipboardV3(h, model, options, pasteOffset?)`**
composes Copy/Paste controls anywhere in a host's sidebar or custom shell.
It emits source-bound requests, exposes current denial reasons and retains
omission/detachment findings in minimal mode. Replace it entirely with headless
APIs when desired. Pass the same offset to controls and controller for consistent
button/keyboard placement. It does not implement OS clipboard permissions,
cross-tab transport, paste-into-parent, cut, external text decoding or arbitrary
metadata-reference rewriting. No dependencies or canonical wire formats changed.

<a id="native-v3-mermaid-projection-unreleased"></a>

### Native v3 Mermaid projection

The optional `@opsydyn/foldkit-zloz-mermaid` package exports
`exportGroupMermaidV3` and composable exact-output review controls. Complete native
documents keep world convention, mode/capability and socket identity in a distinct
v3 bundle. Group links project to boundaries; missing socket artwork/attachment,
geometry, camera and omitted semantics/data are explicit findings. Losses reject
by default, errors always block, and review/download never edit source or Undo.
See the [adapter API and limits](../foldkit-zloz-mermaid/README.md#native-v3-groups-and-loss-review-unreleased).
Legacy exporters/CLI entries/readers stay version-fixed. Native packets, receipts,
modelling patches and audits are separate adoption slices. The optional core
Foldkit entry also exports `zlozThemeStyle` for shared token styling in adapters.

<a id="native-v3-authoring-auditing-and-portable-evidence-unreleased"></a>

### Native v3 authoring, auditing and portable evidence

Use the explicit v3 entries for a document with authored group ports. V1/v2
readers and writers retain their original version contracts.

| Workflow                  | Public native v3 entries                                                                                          |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Modelling proposal        | `captureModellingPatchSourceV3`, `captureModellingPatchV3`, `parseModellingPatchV3`, `dryRunModellingPatchV3`     |
| Reviewed atomic Apply     | `resolveModellingPatchReviewV3`, `applyModellingPatchV3`                                                          |
| Portable patch receipt    | `serializeModellingPatchReceiptV3`, `parseModellingPatchReceiptV3`                                                |
| DDD conversion            | `previewEventStormingDddMappingV3`, `createEventStormingDddConversionPlanV3`, `applyEventStormingDddConversionV3` |
| C4 conversion             | `previewEventStormingC4MappingV3`, `createEventStormingC4ConversionPlanV3`, `applyEventStormingC4ConversionV3`    |
| Conversion evidence       | `serializeEventStormingDddConversionV3` / `parseEventStormingDddConversionV3`, and the corresponding C4 entries   |
| Full-document auditing    | `auditGroupDddRelationshipsV3`, `auditGroupEventStormingRelationshipsV3`                                          |
| Chosen-baseline audits    | `compareModelDddRelationshipsV3`, `compareModelEventStormingRelationshipsV3`                                      |
| Ordinary or group sockets | `planPortEditV3`, `applyPortEditV3`; group-only wrappers remain available                                         |

Patch source identity includes model, session, revision, mode, capabilities,
graph and optional camera. Apply binds consent to the exact reviewed source and
output, rechecks current protections, retains provenance, and adds one complete
Undo frame. Conversion receipts retain the canonical source/target models and
all archived checkpoint modes/capabilities. Strict receipt decoders recompute the
recorded target. Imported evidence grants no current edit permission or consent.

The optional `/foldkit` `zlozGroupWorkbenchV3` view now offers `resize`,
`portAnchors`, `reconnect`, `boxSelection` and `pinchZoom` options. Controls remain
opt-in; custom `renderResize` and `renderPortAnchor` slots can replace or omit
handles. Compose `zlozNativeResizeHandleV3` for eight-direction custom handles.
Keyboard arrows resize or move anchors, the inspector offers keyboard
reconnection, Shift-background dragging selects visible roots, and Escape
cancels. Preview geometry never becomes authority; release rechecks live policy.
Required protection reasons remain visible in minimal mode. Geometry input uses
a stable pointer origin across surface reflow.

`publishGroupWorkbenchResultV3` composes an already validated native Apply/Undo
result into transient workbench presentation. It grants no transaction authority.

See the [release qualification and human checklist](../../docs/releases/zloz-0.6.0-candidate.md)
for the measured automated matrix and the remaining acceptance gates. This is not
an unrestricted React Flow parity or accessibility-conformance claim.
