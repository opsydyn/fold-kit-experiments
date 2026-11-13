# Explicit layout label bounds qualification

- **result:** complete
- **claim:** core layout requests can declare one composite label envelope per
  edge. ELK reserves space and returns centered world-coordinate boxes; core
  validates and retains them for views, controls, fit/reveal and culling. The
  detached descriptor workbench demonstrates fixed text-plus-tag badges.
- **evidence:** focused core contract/atomicity/geometry/Undo/culling regressions,
  real ELK compound RIGHT/DOWN tests and malformed caller-engine output tests,
  workbench lifecycle/source preservation and installed-consumer runtime/type
  qualification. Root typecheck, check and all tests; affected package checks and
  production build. Local Chromium checks with inspected light/dark captures.
  Architecture, boundary and test-quality reviews: **self-review**.
- **remaining uncertainty:** declared sizes must match rendered content; automatic
  measurement and arbitrary collision avoidance remain unimplemented. Other
  engines, group headers, overridden paths and transient SVG/PNG export fidelity
  are outside this slice. Browser/device/AT/hosted acceptance and large-graph
  performance remain unobserved. Alchemy SDK/publication gates remain unchanged.
  Nothing was published or deployed.
- **next:** opt-in measured label envelopes through Foldkit lifecycle commands,
  with stale-result protection before re-layout. Recommendation: **needs review**.

## Contract and boundaries

See [ADR 0071](../../../docs/adr/0071-reserve-explicit-layout-label-envelopes.md).
`layoutRequest` copies optional hints; legacy calls omit the field exactly as before.
IDs must name existing edges once, and dimensions must be positive and finite.
`validateLayoutRequest` is a typed contract check, not an unknown-input decoder.
Current results fail atomically if requested label routes/boxes are missing, boxes
are unexpected, centers are nonfinite or dimensions differ. Stale results are
ignored before geometry validation. `applyLayout` remains one Undo;
`applyPreviewLayout` retains the read-only editor's past/future references. Graph
edge text, semantics, provenance and serialization are unchanged.

ELK receives CENTER labels and ROOT coordinates for routes and boxes. Its empty
text handling initially left a custom badge unpositioned; a failing real-engine
case led to a private nonempty sizing token for unlabeled content. This does not
alter authored labels or badge text. Engine labels return only position/size,
never content. Core's shared resolver uses retained centers only while using the
engine route; authored waypoints/path style, projected endpoints and custom
geometry policies retain precedence. Culling includes envelopes for unlabeled
custom badges; fit/reveal includes retained bounds. Export continues to report
layout-route fidelity limits, without persisting transient boxes.

The workbench requests and renders the same 176 by 36 world-unit box. Text can
ellipsize and exposes its full value in a title. Source/DDD tags demonstrate a
composite renderer. Pure sizing/rendering lives in `alchemy-labels.ts`; geometry
runs in a lazy Command and publishes through existing scoped review state. Restore
removes routes/bounds and restores original geometry. Working model, Undo,
projection, source identity, 23 source facts and all nine findings are preserved.

## Local acceptance

Run from the isolated checkout:

```sh
bun typecheck
bun run check
bun run test
bun run --filter @opsydyn/zloz-demo build
node apps/zloz-demo/evidence/alchemy-label-bounds-browser.mjs
```

The full suite includes pack checks and installs actual core/ELK tarballs into a
fresh npm consumer, checking runtime behavior and strict Bundler/NodeNext types.
Browser checks compare eight rendered badge rectangles with leaf-node rectangles
in RIGHT and DOWN, allowing one screen pixel of rounding tolerance. This is a
fixture-specific check, not a general collision proof. Existing lazy-load, delayed
module Cancel, keyboard focus, Restore, finding navigation, Minimal mode, rejected
uploads, working model equality and no external requests/page errors are retained.

Artifacts: [browser receipt](alchemy-label-bounds-browser.json),
[light](alchemy-label-bounds-light.png), [dark](alchemy-label-bounds-dark.png) and
[finding detail](alchemy-label-bounds-detail.png).
The captures show the complete diagram at fit zoom; labels remain world-sized and
scale with the graph. No synthetic screenshot or DOM-injected model state is used.
