# Package C4 renderers and themed workbench

- **result:** complete
- **claim:** optional package C4 node/boundary presets and separate system-context
  and container workbench examples are implemented and locally qualified.
- **evidence:** four new typed renderer/SSR tests, two sample tests, expanded
  strict external tarball consumer, workspace gates, production build, browser
  interactions and four inspected light/dark screenshots.
- **remaining uncertainty:** long content needs suitable authored dimensions;
  formal screen-reader/device qualification, DDD artwork and pattern insertion
  remain follow-ups. Artwork cache speedups are not measured or claimed.
- **next:** assess Mermaid conversion/agent packaging and durable editions versus
  runtime time travel, as requested; implement neither in this slice.

## Package ownership

`flowC4Node` and `flowC4Group` are public exports of
`@opsydyn/foldkit-flow/foldkit`. All four C4 roles use core outline/content
geometry, public frames/handles and existing native port resolution. Other
families fall back to normal rendering. The root gains only pure
`decorationPaths` geometry for the cylinder cap. No new dependency or persisted
field is introduced; see [ADR 0006](../../../docs/adr/0006-composable-c4-preset-renderers.md).

`FlowC4NodeOptions` provides omittable/replaceable semantic parts, frame paint,
custom content and live controls. Inert artwork is inside the drag button;
interactive editors and controls belong outside. Authored dimensions remain
authoritative. External scope uses both text and dashes. Minimal mode preserves
semantic text, while slots can omit optional content independently.

Optional body caching composes the existing public cache with a stable options
object. Its inputs omit full EditorState, source and authorization. Native/custom
sockets, context/collapse controls and resize handles evaluate current context.
The tests compare cache inputs and live outputs; they do not count cache hits or
claim a performance improvement.

The sample uses package imports exclusively. It supplies graph fixtures, a C4
design choice and explanatory captions. Existing theme preference handling
selects scoped Flow tokens without editing graph/history. System context uses
people/systems; container detail is a separate graph with a portless boundary,
application and data-store containers. Component presentation is covered by SSR
and the external consumer. The fixtures are not advertised as pattern builders.

## Browser and visual evidence

The [production browser result](c4-renderers-browser.json) records Chromium
151.0.7922.34 at a 1600×1100 viewport with reduced motion. It checks:

- Native handle focus/identity while enabling retained artwork.
- Keyboard movement, width resizing, connection creation and pointer dragging,
  each followed by Undo and exported graph comparisons.
- Light/dark changes preserving document contents, with distinct computed SVG
  fill colours; minimal mode retains C4 meaning.
- A cylinder cap from pure geometry and a non-midpoint port on its curved outline.
- Pointer-operated group collapse/expand, group resizing/Undo and graph fidelity.
- Artwork containing no interactive controls; no page errors.

All four screenshots were inspected:

- System context: [light](c4-context-light.png) · [dark](c4-context-dark.png).
- Container detail: [light](c4-containers-light.png) · [dark](c4-containers-dark.png).

The browser initially found a real group-header bug: the drag title intercepted
Collapse because default group controls were unpositioned. The preset now places
its native header controls in a separate positioned region; normal pointer input
passes without forcing clicks. Authored spacing and a dedicated data-store
output keep relationship labels readable.

The driver also required two corrections: exports scroll the page, so it scrolls
the canvas back into view before pointer dragging; clean-mode transitions need
DOM acknowledgement before using the hidden graph-action panel. It temporarily
opens that panel through UI controls for exports, then returns to minimal mode.
Collapse is view state; a separate group resize supplies the Undo check.

## Verification

- Baseline workspace typecheck/check: exit 0.
- The first test failed on missing C4 exports, then all four renderer tests pass.
  They cover all roles, fallback, shared geometry/cap, slots, theme tokens,
  permission reasons, read-only/source feedback, authored bounds and cache inputs.
- Two new sample tests pass; the typed sample suite now has nine tests.
- Full `bun run test`: exit 0, including 254 Flow tests, seven ELK tests, six force
  tests and the expanded packed consumer. The optional entry compiles in strict
  Bundler/NodeNext modes and runs with the host's real FoldKit builder. The pure
  tarball still installs/runs without FoldKit, Effect, ELK or React.
- Production sample build and browser driver: exit 0.
- Final workspace `bun typecheck`: exit 0 after the tests completed.
- Workspace lint/format/catalog check: exit 0, with advisory warnings.
- Flow TypeDoc generation, treating warnings as errors: exit 0.

Final self-review also checks boundary drop-target feedback through the public
context. The four focused renderer tests pass with 42 assertions; the final full
suite and production browser run include the completed implementation.

Scoped lint comments explain literal geometric uses of “shape”; mandatory rules
otherwise remain active. Self-review checks package ownership, immutable Model
data, live policy evaluation, canonical anchors and public control composition.
This is local qualification; no publication, PR, hosted activation or independent
accessibility audit is claimed.

## Reproduce

At the repo root, build with:

```sh
FLOW_BENCHMARK_SOURCEMAPS=1 bun run --filter @opsydyn/flow-sample build
```

Then from `apps/web`:

```sh
bun - < ../flow-sample/evidence/c4-renderers-browser.mjs > /tmp/c4-renderers-browser.json
```

The driver writes PNGs alongside the script and closes its local server/browser.
[Source manifest](c4-renderers-sources.json) records the parent commit and hashes
of runtime, tests and driver files used before commit.

Final recommendation: **needs follow-up** for the planned interchange/edition
product decisions and subsequent DDD/pattern authoring work.
