# Connection-preview composition qualification

Local Chromium qualification on 2026-11-05, using the built Astro sample. Both
node presentations use the same core preview resolver and input lifecycle.

- [Cards with ribbon preview](connection-preview-cards.png)
- [SVG nodes with ribbon preview](connection-preview-orbits.png)
- [Rejected duplicate port](connection-preview-rejected.png)

Browser journeys passed for both cards and SVG nodes:

- Free-space geometry, wrong-direction rejection and valid-port feedback.
- Preview path equality with the committed custom curve after a successful drop.
- Duplicate rejection with a visible reason and red preview; no graph edit.
- Dashed defaults and hidden visuals, with valid hidden drops still enabled.
- Source and target reconnection, logical output-to-input direction, and Undo.
- Escape cancellation of new connections and both reconnection ends.
- Matching preview/committed paths after zoom; no page runtime errors.

The baseline path assertion waits for the chosen geometry to render before
comparing reconnection Undo results. Screenshots capture live pointer gestures,
not mockups or reconstructed diagrams.

Reproduce from the repository root:

```sh
bun run --filter @opsydyn/flow-sample build
cd apps/web
node --input-type=module <../flow-sample/evidence/connection-preview-browser.mjs
```

The harness uses the existing web Playwright dependency and a temporary loopback
server. It closes browser/server resources and writes screenshots under
`/tmp/foldkit-flow-connection-preview-*.png`.

Pure and rendered package tests additionally qualify host-policy reasons, unknown
candidate IDs, world-space cursor conversion, canonical snapping, collapsed-group
projection, authored path styles, read-only suppression, invalid geometry
rejection and omission of decorative SVG without disabling a valid drop. The
packed consumer compiles the geometry/render hooks with the host builder under
Bundler and NodeNext, and executes the preview resolver and renderer externally.
TypeDoc includes the new public contracts and builds with warnings treated as
errors. Dedicated accessibility qualification remains separate; native keyboard
connections and the existing live status continue to use the core editing path.
