# FoldKit Flow API and type contracts

The Flow API reference is generated with TypeDoc from public package entry points,
using the same tool as FoldKit Viz. It describes the source revision used for the
build; the packages remain local release candidates until separately published.

[Open the Flow API reference](/fold-kit-experiments/flow/api/).
The route is populated by the updated Pages workflow after merge/deployment.

The reference includes:

- `@opsydyn/foldkit-flow`: graph/port types, editor state/events, serialization,
  history, layout publication, shared edge geometry, custom port anchors and connection-preview policies.
  The root also exports C4/DDD node descriptors, architecture presets/factory,
  shape geometry and undoable architecture/appearance events. These are headless
  contracts; default architecture artwork and pattern builders are subsequent slices.
- `@opsydyn/foldkit-flow/foldkit`: view options, node/group shells, public
  interaction primitives, diagnostics and background contracts.
- `@opsydyn/foldkit-flow-elk`: ELK layout options and adapter factory.
- `@opsydyn/foldkit-flow-force`: force layout factory and support checks.
- `@opsydyn/foldkit-flow-force/eligibility`: the lightweight eligibility entry.

## Generate locally

```sh
bun run --filter @opsydyn/foldkit-flow docs
```

Serve `packages/foldkit-flow/docs/` with a static server. Generated HTML is ignored
by Git and built afresh for Pages. It is not included in the npm tarball. The
landing guide is maintained at `packages/foldkit-flow/typedoc-readme.md`; the type
and API pages come directly from source exports and their TSDoc comments.

The core stays independent of FoldKit, browser globals and layout engines. The
application owns Model, commands and persistence; optional adapters remain
separate dependencies. See [the composition decision](adr/0004-composable-flow-presentation.md)
for the current extensibility boundaries.
