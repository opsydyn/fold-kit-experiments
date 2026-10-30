# fold-kit-experiments docs

What this monorepo decided, tried and shipped, and why. Everything here is markdown in
the repository's `docs/` folder; the docs site (`apps/docs`) shows the same files with
search and navigation.

## Where things are

- **Decisions:** [repository decisions](adr/0001-require-verified-main-pull-requests.md)
  in `adr/`, and the effect-three packages' own in
  [`effect-three/adr/`](effect-three/adr/001-greenfield-vs-three-effect.md). A decision
  record says what was decided, the options weighed and why; it is not edited later,
  only superseded by a newer one.
- **Spikes:** short experiments and what they found, in `spikes/`: start with
  [radar proposals on `@alchemy.run/domain`](spikes/radar-proposals.md). Earlier ones are
  [effect-three's spike results](effect-three/spike-results.md) and the
  [AG-UI spike](examples/ag-ui-spike.md).
- **Releases:** what each FoldKit upgrade changed here, in `releases/`, such as
  [FoldKit 0.170](releases/foldkit-0.170.md).
- **Assessments, postmortems and migrations:** reviews of a dependency or a capability,
  what went wrong and what changed because of it, and upgrade guides.
- **effect-three:** its [plan](effect-three/PLAN.md), [roadmap](effect-three/ROADMAP.md)
  and [references](effect-three/references.md).
- **Working notes:** the plans and specs in `superpowers/`, written while the work was
  under way. They record intent at the time, so later decisions may have overtaken them.
- **The [roadmap](roadmap.md).**

## Adding to it

Write markdown in the folder that fits, starting with a `#` heading: the site takes the
page title from it. A new folder needs a sidebar entry in `apps/docs/astro.config.ts`.
Relative links between files work on GitHub and on the site alike.
