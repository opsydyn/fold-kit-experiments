# fold-kit-experiments docs

What this monorepo decided, tried and shipped, and why. Everything here is markdown in
the repository's `docs/` folder; the docs site (`apps/docs`) shows the same files with
search and navigation.

## Where things are

- **Effect UI cutover:** [package migration and qualification](assessments/2026-11-26-effect-ui-1.0-migration.md).
- **Decisions:** [repository decisions](adr/0001-require-verified-main-pull-requests.md)
  in `adr/`, and the effect-three packages' own in
  [`effect-three/adr/`](effect-three/adr/001-greenfield-vs-three-effect.md). A decision
  record says what was decided, the options weighed and why; it is not edited later,
  only superseded by a newer one.
- **Spikes:** short experiments and what they found, in `spikes/`: start with
  [radar proposals on `@alchemy.run/domain`](spikes/radar-proposals.md). Earlier ones are
  [effect-three's spike results](effect-three/spike-results.md) and the
  [AG-UI spike](examples/ag-ui-spike.md).
- **Releases:** current release procedures and historical FoldKit upgrades are in `releases/`.
  See the [ZLOZ release procedure](releases/foldkit-zloz.md) and
  [FoldKit 0.171 notes](releases/foldkit-0.171.md).
- **Assessments, postmortems and migrations:** reviews of a dependency or a capability,
  what went wrong and what changed because of it, and upgrade guides.
- **effect-three:** its [plan](effect-three/PLAN.md), [roadmap](effect-three/ROADMAP.md)
  and [references](effect-three/references.md).
- **Working notes:** the plans and specs in `superpowers/`, written while the work was
  under way. They record intent at the time, so later decisions may have overtaken them.
- **The [roadmap](roadmap.md).**

## Mutant field guide

A mutation test changes a small piece of code and runs the tests to see whether they catch it.
[Browse the live field guide by workspace](https://opsydyn-web.opsydyn.workers.dev/mutant-field-guide#inventory-title),
then open a specimen to follow its verdict across runs. **Caught** means a test detected the change.
**Survived** means the tests still passed. Each archived observation links to its GitHub Actions run.
The [archive notes](spikes/mutant-cafe.md#field-guide-history) explain how results reach the guide.

## Adding to it

Write markdown in the folder that fits, starting with a `#` heading: the site takes the
page title from it. A new folder needs a sidebar entry in `apps/docs/astro.config.ts`.
Relative links between files work on GitHub and on the site alike.
