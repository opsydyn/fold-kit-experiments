# FoldKit Flow ELK

Optional automatic layout for `@opsydyn/foldkit-flow`. The adapter maps flat and nested graphs with fixed ports to ELK Layered. It returns node
positions, fitted group bounds, and orthogonal edge routes. It owns no UI, persistence, graph state or workflow execution.

Version 0.1.0 is a local release candidate; npm publication has not been performed.

## Install and use

After publication:

```sh
npm install @opsydyn/foldkit-flow @opsydyn/foldkit-flow-elk
```

```ts
import { createEditor, layoutRequest, applyLayout } from '@opsydyn/foldkit-flow';
import { createElkLayout } from '@opsydyn/foldkit-flow-elk';

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
positions or invalid routes reject with `FlowError` rather than inventing geometry.

## Worker ownership

The default bundled ELK runs **in process** and creates a fresh instance for each
call. Its Promise does not move computation off the UI thread. For larger graphs,
construct a worker-backed ELK instance using your bundler's worker configuration
and pass it as `createElkLayout({ elk })`. The caller owns and terminates that worker.
The adapter never terminates caller-owned resources. Command interruption alone
does not cancel ELK computation; request/revision checks prevent late publication.
See [ELK's worker documentation](https://github.com/kieler/elkjs#web-worker).

ELK is an external dependency, not bundled into this package. The core package
installs and works without it. Node 22+, ESM only. Initial compatibility is Flow
0.1.0 and the pinned elkjs 0.12.1. Both Flow packages release at the same version.
The adapter has no FoldKit or Effect peer.

The default adapter is qualified in Node and Chromium. Bun can compute layouts,
but elkjs 0.12.1's bundled fallback installs a global `self.onmessage` handler in
Bun 1.4.4, keeping a standalone process alive after completion. Use Node for CLI
layout jobs. The dependency-free core is separately tested in both Node and Bun.

## Scope and verification

Compound layout preserves group membership and routes directed edges across
boundaries. Flow edges connect one source to one target. Compare representative
diagrams before upgrading ELK, since layout may vary by version.

Run `bun run --filter @opsydyn/foldkit-flow-elk test`, `typecheck` and `pack:check`.
The core's packed consumer test installs both tarballs through npm and exercises
real layout plus the optional FoldKit renderer.

See [publication standards](https://github.com/opsydyn/fold-kit-experiments/blob/main/docs/releases/foldkit-flow.md) and
[dependency notices](THIRD-PARTY-NOTICES.md).
