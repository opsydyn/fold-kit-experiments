# Astro Effect UI renderer preview

This private package tests direct Effect UI component imports in Astro 7.4.11.
Its dependencies live outside the root Bun workspace. The fixture pins Effect
UI to commit `77dcd92` and uses Effect 4.1.6.

Install the root workspace, then run these commands from this directory.

```sh
bun run prepare:viz
bun install
bun run typecheck
bun run test
```

The setup packs the local Viz build so the preview installs it using the
same package boundary as an external consumer.
The tests build an Astro site, inspect its static HTML and exercise the client
renderer against the built markup in Happy DOM. To test Astro's real
`ClientRouter` and `client:visible` behavior, install Chromium with
`bunx playwright install chromium` and run `bun run test:browser`.

The fixture's `/chart/` route uses the published Viz bar geometry export with
the local package build. A single component accepts typed chart labels and
rows. The fixture renders static and interactive reports from the same data
and a separate interactive deployment chart with signed values. Each chart
uses native table buttons for selection when interactive and announces its
selected value. Effect UI builds the SVG
through `h.el`, and the SVG uses ARIA attributes for its name and description.

The `/plot/` route exercises Viz's `./effect/plot` package export. It
renders a composed dot plot and displays the compiler's missing-field
diagnostic for a second spec on the same page.

The `/request/` route is rendered on demand by the built Astro fetch
entrypoint. Tests call it with concurrent Request objects and hydrate one
response against its original markup. The renderer marks prerendered
island state so Effect UI can handle its query freshness separately from
request-time state.

The server renders components with Astro's props. A static component emits
HTML alone. A hydrating component carries Effect UI's serialized state beside
its mount container. Keep secrets out of component models and query results
that can be serialized. Each mounted island owns an Effect scope, which closes
when Astro removes the island. Astro owns the document title and other head
metadata. The retained-island fixture uses `transition:persist-props` to keep
the existing instance and its original props.

The `/interaction/` fixture activates on the first interaction. The Astro
renderer waits for Effect UI to adopt the island before the directive
replays clicks on retained controls. Deferred removal cancels replay. Native
links and form edits retain their browser behavior during activation. The
Effect UI integration owns this directive on an Astro site. Use one
integration that registers `client:interaction` per Astro configuration.

The Effect Three fixture mounts a shared browser scene host through Effect
UI mount arguments. A scene update keeps the same canvas and renderer. The
test uses a recording renderer and checks canvas, renderer, geometry and
material cleanup after Astro unmounts the island.

See [ADR 0128](../../docs/adr/0128-evaluate-a-standalone-astro-effect-ui-renderer.md)
for the preview scope.
