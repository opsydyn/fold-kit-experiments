# Public node/group composition qualification

Local qualification on 2026-11-05. The Astro sample switches between the bundled
cards and complete SVG orbit shells through the public package API. Screenshots
come from the built sample in Chromium; they are not mockups.

| Presentation                                   | Screenshot                                     |
| ---------------------------------------------- | ---------------------------------------------- |
| Bundled cards                                  | [Cards](composition-cards.png)                 |
| Custom node shell, ports and resize affordance | [Orbits](composition-orbits.png)               |
| Custom group chrome with nested membership     | [Nested orbits](composition-groups-orbits.png) |

Both designs passed these browser journeys with no page runtime errors:

- Keyboard selection and movement; pointer drag with membership retained; Undo.
- Escape cancellation of a live drag without changing the document coordinates.
- Keyboard connection creation through native port buttons; Undo.
- Keyboard node width resizing; circular content remeasurement; Undo.
- Group keyboard resizing, collapse/expand, descendant movement and Undo.

The grouped screenshot uses the public fit-to-contents action after the larger
circular nodes have been measured, followed by Fit view. Fixed group bounds do
not automatically adapt to a presentation change. The cards and orbit screenshots
show the same release graph with each shell's content-driven height.

Reproduce from the repository root:

```sh
bun run --filter @opsydyn/flow-sample build
cd apps/web
node --input-type=module <../flow-sample/evidence/composition-browser.mjs
```

The harness uses the existing web workspace Playwright dependency, serves the
built sample on a temporary loopback port, closes browser/server resources and
writes screenshots under `/tmp/foldkit-flow-composition-*.png`.

The package regression suite additionally exercises actual rendered public shells
through the input adapter, geometry/port placement, limits, read-only policy and
history. Its packed-consumer test installs npm tarballs outside the workspace,
compiles custom shells with the host builder under Bundler and NodeNext, and
executes the compiled renderer. Pure-core imports continue to require no FoldKit,
Effect, React or layout-engine installation.

This proves the bounded node/group shell composition slice. Arbitrary anchor
geometry, replaceable edge paths/hit areas/labels, complete overlay composition
and a dedicated accessibility audit remain separate work.
