# Astro Effect UI renderer

`@opsydyn/astro-effect-ui` is the standalone integration used by the Astro
apps in this monorepo. The workspace and its staged archive are private.

Register `effectUi()` in Astro and export each Effect UI `Html.component`
through `astroComponent` from `@opsydyn/astro-effect-ui/component`. Astro owns
the page markup and hydration schedule. Pass serializable component props,
and choose a hydration directive only when the component needs a browser runtime.
`client:interaction` defers hydration until interaction, and
`client:only="astro-effect-ui"` skips server rendering.

The [Astro migration guide](../astro-foldkit/README.md) has the configuration
and component examples. See the [Web greeting route](../../apps/web/src/pages/greeting.astro)
for request-time rendering and the [static route](../../apps/web/src/pages/greeting-static.astro)
for prerendering.

```sh
bun run --filter @opsydyn/astro-effect-ui build
bun run ci:astro-compat
```

The build stages the distribution in `dist/`. The compatibility check packs the
standalone renderer and forwarding package and builds isolated Astro 5, 6 and 7
consumers. The [migration record](../../docs/assessments/2026-11-26-effect-ui-1.0-migration.md)
covers the candidate archives and browser verification.
