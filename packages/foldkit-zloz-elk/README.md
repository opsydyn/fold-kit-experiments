# Foldkit Zloz ELK

Optional automatic layout for `@opsydyn/foldkit-zloz`. The adapter maps flat and nested graphs with fixed ports to ELK Layered. It returns node
positions, fitted group bounds, and orthogonal edge routes. It owns no UI, persistence, graph state or workflow execution.

The public package family is released together. The native v3 entry below is an unreleased addition to 0.5.0.

## Install and use

```sh
npm install @opsydyn/foldkit-zloz @opsydyn/foldkit-zloz-elk
```

```ts
import { createEditor, layoutRequest, applyLayout } from '@opsydyn/foldkit-zloz';
import { createElkLayout } from '@opsydyn/foldkit-zloz-elk';

const editor = createEditor({ nodes: [], edges: [] });
const active = layoutRequest(editor, 'arrange-1');
const layout = createElkLayout({ direction: 'RIGHT', spacing: 64 });
const result = await layout(active); // Run this work in a FoldKit Command.
const arranged = applyLayout(editor, active, result);
```

In an asynchronous application, the completion handler must use the **current**
editor and active request from the Model. Never capture those old values and write
them back on completion. Clear active requests on document replacement.

The default direction is RIGHT; DOWN is also supported. Node sizes and authored
port anchors remain authoritative. Legacy side/offset ports keep their
positions. Custom anchors are projected onto their declared side for ELK, then
route leads join back to the exact authored points. User IDs are mapped to independent internal IDs.
Input snapshots are not mutated. Engine failures reject the Promise; missing node
positions or invalid routes reject with `ZlozError` rather than inventing geometry.

## Worker ownership

The default bundled ELK runs **in process** and creates a fresh instance for each
call. Its Promise does not move computation off the UI thread. For larger graphs,
construct a worker-backed ELK instance using your bundler's worker configuration
and pass it as `createElkLayout({ elk })`. The caller owns and terminates that worker.
The adapter never terminates caller-owned resources. Command interruption alone
does not cancel ELK computation; request/revision checks prevent late publication.
See [ELK's worker documentation](https://github.com/kieler/elkjs#web-worker).

ELK is an external dependency, not bundled into this package. The core package
installs and works without it. Node 22+, ESM only. Compatibility uses the matching Zloz version and the pinned elkjs 0.12.1. Both Zloz packages release at the same version.
The adapter has no FoldKit or Effect peer.

The default adapter is qualified in Node and Chromium. Bun can compute layouts,
but elkjs 0.12.1's bundled fallback installs a global `self.onmessage` handler in
Bun 1.4.4, keeping a standalone process alive after completion. Use Node for CLI
layout jobs. The dependency-free core is separately tested in both Node and Bun.

## Scope and verification

Compound layout preserves group membership and routes directed edges across
boundaries. Zloz edges connect one source to one target. Compare representative
diagrams before upgrading ELK, since layout may vary by version.

Run `bun run --filter @opsydyn/foldkit-zloz-elk test`, `typecheck` and `pack:check`.
The core's packed consumer test installs both tarballs through npm and exercises
real layout plus the optional FoldKit renderer.

See [publication standards](https://github.com/opsydyn/fold-kit-experiments/blob/main/docs/releases/foldkit-zloz.md) and
[dependency notices](THIRD-PARTY-NOTICES.md).

### Compound preview layouts (unreleased)

Configured `direction` and `spacing` now apply to root **and group parent**
containers. A real-engine regression retains at least the requested inter-layer
gap for RIGHT and DOWN inside a boundary; nested-boundary routes and custom anchors
remain tested. This corrects grouped children silently using ELK defaults.

For a detached read-only editor, compose `layoutRequest`, `createElkLayout` and
core's `applyPreviewLayout`; use `applyLayout` for normal undoable editing. The
workbench opts into ELK on explicit request, with direction controls, logical
cancellation, geometry-only restoration and preserved source/findings. See
[qualification](../../apps/zloz-demo/evidence/alchemy-layout.md). Label dimensions
are not yet supplied to ELK, so this is not a universal label-collision guarantee.

### Custom label envelopes (unreleased)

Pass `layoutRequest(editor, id, { edgeLabels: [{ id: edgeId, size: { width: 176,
height: 36 } }] })` to reserve space for a composite label, including badges.
One envelope per existing edge is supported. ELK returns centered world-coordinate
boxes in `result.routes[*].label`; core validates and retains them on application.
Nested layouts use ROOT coordinates for both route points and labels. Unlabeled
custom content uses a private sizing token inside ELK, without changing graph text.
Omitting hints preserves the previous geometry-only behavior. Caller-supplied
engines must return the requested label IDs, dimensions and finite positions.
Supply sizes matching the actual renderer; arbitrary custom geometry, inaccurate
bounds and group headers are outside this space-reservation guarantee.

For intrinsic custom badges, core's `startLabelMeasurement`,
`updateLabelMeasurements` and `resolveLabelMeasurements` can supply the explicit
`edgeLabels` hints. The optional Foldkit view measures HTML border boxes only on
request. Recheck freshness before both starting ELK and applying its result; ELK
does not load fonts, inspect DOM or start measurement itself. See the
[core measured-label guide](../foldkit-zloz/README.md#opt-in-measured-label-bounds-unreleased).

### Group heading envelopes (unreleased)

Core requests may declare `groupHeaders` with an existing group ID, header `size`,
`padding: { top, right, bottom, left }` and a `gap` before children. ELK maps these
to parent padding and a minimum group size, including empty groups and headings
wider than their content. Core rejects results that violate the reserved area.
Share the same declaration with C4/DDD `groupHeader` renderer options. Omitted
hints keep the existing 52/24/24/24 parent padding.

The pinned elkjs 0.12.1 adapter corrects transposed minima for nonempty DOWN groups;
empty groups use physical axes. Wide/tall nested/empty and cross-boundary-edge
regressions qualify both directions. Requalify the correction when upgrading ELK
or supplying a worker from another version. No post-layout stretching is used.
These hints reserve child-node space; they do not guarantee arbitrary route or
custom-artwork collision avoidance.

## Native v3 group-port layout (unreleased)

Use the distinct full-document entry for authored group ports:

```ts
import { groupLayoutRequestV3, applyGroupLayoutV3 } from '@opsydyn/foldkit-zloz';
import { createElkGroupLayoutV3 } from '@opsydyn/foldkit-zloz-elk';

const active = groupLayoutRequestV3(editorV3, 'arrange-v3-1');
// Store active in Model before executing this Promise in a Command.
const result = await createElkGroupLayoutV3({ direction: 'RIGHT' })(active);
// At completion, read the current editor, active request and live policy from Model.
const decision = applyGroupLayoutV3(currentEditor, currentActive, result, livePolicy);
```

Both RIGHT and DOWN support nested rectangular groups, unused/authored group
ports, ancestor-to-descendant edges and crossing boundaries. Group port definitions,
custom anchors, identities, membership, metadata, modes, capabilities and camera
remain authored data. ELK changes world positions and group bounds; core validates
all nodes/routes, declared header/label envelopes and resize/extent constraints.
A stale source, lifecycle veto or protected move/resize blocks the entire result.
A changed layout appends one Undo frame; identical geometry appends none.

`applyGroupWorkbenchLayoutV3` integrates accepted routes into the native controller.
Its optional Foldkit view renders them only while the complete document matches,
no move/connection gesture is active and no collapsed projection is present.
Undo/editing invalidates routes; camera/selection do not author layout geometry.
Routes are transient, not serialized into authored edges. Authored waypoints keep
precedence. Engine interiors are orthogonal; connector leads join ELK's fixed
boundary points to the exact final authored anchors after group resizing, and
may be oblique. This is not an obstacle/collision guarantee for arbitrary custom
content. Fixed-position compound ports are qualified with elkjs 0.12.1; its
FIXED_RATIO path failed on the nested regression and is not used.

Logical cancellation and supersession ignore late results; they do not terminate
ELK computation. Worker ownership and the Node/Bun qualification limits above
also apply to the native entry. V1/v2 `createElkLayout` still rejects group ports.
