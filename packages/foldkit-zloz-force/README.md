# @opsydyn/foldkit-zloz-force

Force layout and automatic orthogonal routing for Foldkit Zloz.
The adapter uses the FoldKit Viz simulation and requires Node.js 22 or newer
for headless use.

## Usage

Install `@opsydyn/foldkit-zloz-force` with its peer `@opsydyn/foldkit-zloz`.
FoldKit Viz is a runtime dependency.

```typescript
import { applyLayout, createEditor, layoutRequest } from '@opsydyn/foldkit-zloz';
import { createForceLayout } from '@opsydyn/foldkit-zloz-force';
import { supportsForceLayout } from '@opsydyn/foldkit-zloz-force/eligibility';

const editor = createEditor({
  nodes: [
    {
      id: 'start',
      label: 'Start',
      position: { x: 0, y: 0 },
      size: { width: 180, height: 100 },
      ports: [],
    },
  ],
  edges: [],
});

if (supportsForceLayout(editor.graph)) {
  const request = layoutRequest(editor, 'force-1');
  const result = await createForceLayout()(request);
  const arranged = applyLayout(editor, request, result);
}
```

The eligibility subpath lets a host enable its layout action without loading the
simulation. In a FoldKit app, run the adapter in a Command, keep the active
request in the Model, and pass that current request to `applyLayout` on completion.
That core operation rejects stale results and commits one undo step.

## Behavior and limits

The initial adapter supports flat graphs of 1–100 nodes. It rejects invalid
graphs and graphs containing groups. Use the ELK adapter for compound layouts.

The simulation runs a bounded set of ticks. Card spacing uses a circle around
the largest measured node, and the adapter rejects results with overlapping
cards. Input graph records are preserved.

Automatic edges receive candidate right-angle routes that avoid cards and
penalize occupied corridors and crossings. Explicit edge path styles remain
host-authored. A blocked route falls back to the editor's normal automatic
edge path. Crossings and shared paths can still occur.

The adapter returns layout results and leaves application state ownership with
the caller. The Astro workbench consumes this package as an example.

## Package checks

```sh
bun run --filter @opsydyn/foldkit-zloz-force typecheck
bun run --filter @opsydyn/foldkit-zloz-force test
bun run --filter @opsydyn/foldkit-zloz-force pack:check
```

The package ships ESM, TypeScript declarations, an MIT licence, and third-party
notices. Publish compatible Zloz core and Viz versions before releasing this
adapter through the repository's manual publish workflow.

Custom normalized port anchors use the core's canonical points. Routing leads
extend beyond the declared side of the node box before avoiding other cards;
returned routes start/end at the authored anchors. This does not infer custom
shape obstacles or arbitrary outward normals. With the core's built-in curved
outlines, endpoints stay on the outline and leads still clear the conservative
rectangular envelope before corridor search.
