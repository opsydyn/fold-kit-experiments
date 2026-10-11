# Package Skill Qualification

Two independent skills are maintained in this repository:

- [astro-foldkit](../../skills/astro-foldkit/SKILL.md)
- [foldkit-viz](../../skills/foldkit-viz/SKILL.md)

Each folder is self-contained: its entrypoint, agent UI metadata, references and
assets travel together. Neither is globally installed by this change, bundled
in an npm package, or dependent on the other skill. Root agent instructions and
package READMEs provide discovery links.

## Standalone Examples

Copy the chosen example into a temporary project outside the monorepo before
installing. This avoids workspace links masking missing dependencies. Each
manifest pins direct dependencies; generate a lockfile in the consumer and
retain it there. These starter assets intentionally carry no monorepo lockfile.

| Example                                     | Commands in copied directory                                                                                  | Qualification                                                                                              |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `skills/astro-foldkit/assets/counter`       | `bun install`, `bun run check`, `bun run test`, `bun run build`                                               | Published integration 0.8.1, Astro 7.2.8, FoldKit 0.167.0, Effect 4.0.0; three tests and two static routes |
| `skills/foldkit-viz/assets/scatter`         | `bun install`, `bun run check`, `bun run test`                                                                | Published Viz 0.11.0; four geometry tests; no Astro, FoldKit or Effect installed                           |
| `skills/foldkit-viz/assets/foldkit-view.ts` | Typecheck in a separate Viz 0.11.0 / FoldKit 0.167.0 / Effect 4.0.0 consumer; render using the parent builder | Compiled and rendered via FoldKit server rendering; SVG title/path present and no non-finite geometry      |

These checks were executed when authoring the skills. They are not part of the
root workspace test script: skill assets are outside the workspace globs, and
the repository's normal lint/format configuration excludes `skills/**`.
Re-run them when changing assets or supported package versions; explicitly
format/validate these skill folders as well.

## Browser Acceptance

The built Astro consumer was served locally and checked in headless Chrome:

- `/` delivered a mount shell without counter content; hydration mounted the
  counter and two increments worked while preserving the Astro-owned title.
- `/page/` delivered count zero and serialized Flags before JavaScript;
  hydration and two increments worked while retaining page metadata.
- Neither route produced a page exception.

Browser testing caught a runtime-only boundary error: exporting `Flags` from
the island module makes FoldKit require a Flags Effect that the integration's
props-based island path does not supply. The final starter separates `main.ts`
from the page-only `page-main.ts`; its tests protect that export distinction.

To repeat acceptance, build and serve the copied example, inspect each response
before JavaScript, then increment twice on each route and check its title and
console. Build success is not hydration proof.

## Agent Application Checks

A read-only baseline agent used package README/source guidance before these
skills existed. It correctly separated pure Viz from optional adapters and
noticed the unreleased bars/paint caveat, but proposed `Model = null` for a
counter without a runtime Message schema. The Astro skill supplies complete
schema-backed modules instead.

Independent agents then applied each skill to standalone consumer scenarios.
The Astro follow-up selected distinct island/page module exports and loader
targets. The Viz follow-up retained pure imports, stable record identity and
the version gate on bars/paint. Review also led to explicitly scoping Model,
Command and OutMessage guidance to FoldKit hosts rather than plain TypeScript.
This is focused synthetic evidence, not a general measurement of agent uplift.

## Standalone Dogfood Follow-up

After committing the skills in `2152264`, two fresh-context agents built new
consumers using one skill each, its supporting resources and installed published
package declarations. Neither read monorepo source, root agent instructions or
the sibling skill. Both also read their harness-required global process skill;
this was isolated package guidance, not a completely instruction-free trial.

| Consumer                               | New behaviour                                                                                                                                         | Verification                                                                                                                                     |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Astro quantity selector                | Validated product/initial quantity, immutable increment/decrement, zero floor; island and prerendered page ownership                                  | 25 application tests, 5 production-HTML tests, Astro diagnostics with zero errors/warnings/hints, two-route build                                |
| Plain TypeScript service-latency chart | Six services in two series, original-record identity, host-owned filtering and multi-selection, reorder/resize reconciliation, SVG and raw-data table | 13 tests, strict TypeScript including dependency declarations, generated populated/narrow/filtered/empty SVGs; only Viz and TypeScript installed |

The parent independently reran consumer tests and typechecks and checked the
built output in headless Chrome at 1365px and 390px widths. Both Astro routes
hydrated, supported Enter/Space activation, disabled decrement at zero, and
recovered on increment. The island retained `Order form`; the page updated its
quantity-dependent title. Raw HTML and a JavaScript-disabled browser confirmed
the page's initial quantity of two. Neither route caused a browser exception or
console error in this local static-server check.

Viz rendered six labelled marks, two selection rings, the raw-data table and
an empty chart. Screenshots and SVG text bounds were inspected. Narrow screens
use intentional horizontal chart/table scrolling; geometry resize tests do not
establish automatic DOM resize handling or a fully responsive chart layout.
This remains static output, not pointer/keyboard chart interaction qualification.

Parent review corrected one unnecessary dynamic import in the Astro consumer's
test to a static import. The skill already specifies that boundary, so no new
rule was added. Neither consumer exposed a blocking package-guidance gap.
Selection eligibility and minimum dimensions remained explicit host policies,
not new universal skill requirements. The Astro example's `check` script means
typechecking, not lint; these consumer results do not claim lint coverage.

Local artifacts are in `/tmp/foldkit-dogfood-astro` and
`/tmp/foldkit-dogfood-viz`, with browser evidence in
`/tmp/foldkit-dogfood-evidence`. They are temporary, not repository fixtures or
globally installed skills. This follow-up does not qualify request SSR,
retained-navigation behaviour, screen-reader use, native host skill discovery,
or AG-UI compatibility.

## Limits

- Request-SSR deployment adapters and navigation retention are documented but
  were not newly browser-qualified by these starter examples. Existing repo
  integration tests are separate evidence.
- The optional Viz sample is a static line view, not a complete keyboard chart.
  Its server-render check does not prove interactive accessibility.
- The skill validators check structure, not API correctness or host discovery.
  No claim is made that an agent host has automatically installed either skill.
- No AG-UI implementation or compatibility claim is included.
- Workspace bars/paint APIs remain separate from the pinned published baseline;
  check the consumer's installed package before enabling them.
