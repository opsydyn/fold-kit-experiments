# FoldKit 0.167 compatibility

This migration covers both 0.166 and 0.167 because the previous workspace pin
was 0.165.0. Both apps and both package development environments use FoldKit
0.167.0, Effect 4.0.0, and the Vite plugin 0.27 line. The FoldKit Oxlint plugin
is upgraded to 0.15.3. Astro remains 7.1.1.

## Application changes

| Previous API                          | Current API                        |
| ------------------------------------- | ---------------------------------- |
| `Subscription.animationFrame`         | `Subscription.animationFrameEntry` |
| `Subscription.persistent`             | `Subscription.persistentEntry`     |
| `Port.subscription`                   | `Port.subscriptionEntry`           |
| `Subscription.fromMediaQuery`         | `Dom.streamFromMediaQuery`         |
| `Subscription.fromEvent`              | `Dom.streamFromEvent`              |
| `Subscription.keyBindings`            | `Dom.streamFromKeyBindings`        |
| `Subscription.lift({ toChildModel })` | `Subscription.lift({ read })`      |

The lift reader returns `Option.some(child)` for an always-present child or
the existing `Option` for an optional child. `ManagedResource.lift` also uses
the `read` field. Entry factories still belong inside `Subscription.make`.
The `toMessage` and `toParentMessage` callbacks retain their names.

## Astro ownership and build identity

Use `integrations: [foldkit()]`. The plugin generates the build identity and
bundles FoldKit dependencies across Astro's named environments. The promo
app no longer needs its custom prerender bundling plugin.

The integration permits an absent legacy `import.meta.env.FOLDKIT_BUILD_ID`
override so FoldKit can use its compiled identity. Existing explicit
`server.buildId` and `FOLDKIT_BUILD_ID` overrides remain supported. Blank
`server.buildId` options fail, and an unconfigured renderer outside a coordinated Vite build
still fails with `MissingBuildId`. Independently built client and server
artifacts require the same unique public deployment ID.

The upstream plugin still supplies a legacy `development` override while serving
locally. Production build tests reject that stamp and check the shared generated
identity in the prerendered HTML, client bundle, and server bundle.

Astro retains document and asset ownership. `definePage`, `resolvePageDocument`,
`lazyApp`, and the navigation bridge retain their public contracts. FoldKit's
standalone `Server.renderDocument`, `ssr.build`, and `@foldkit/node` are not
required by the Astro integration.

## Viz and downloadable examples

The package peer range is `>=0.167.0 <0.168.0`. FoldKit and Effect remain
optional for pure geometry consumers; `foldkit/cartesian` uses the host's
render-scoped builder. No fetching or lifecycle runtime is introduced into Viz.

Promo ZIP and StackBlitz projects use the same FoldKit and Vite-plugin versions.
Their client-only Vite builds retain `index.html`; the new template-free build
contract applies to FoldKit's standalone SSR/SSG pipeline.

## Qualification

- Run `bun run check`, `bun typecheck`, and `bun run test` for all four workspaces.
- Build both apps, Storybook, and TypeDoc.
- Check packed imports in Node and Bun, optional Viz peers, and standalone
  line, histogram, and scatter downloads.
- Verify automatic and explicit IDs in SSG HTML, browser and server artifacts,
  request SSR, and existing island lifecycle tests.
- Exercise hydrated pages in a browser before claiming browser acceptance.

### Local results

The compatibility slice passed lint/format checking, all four workspace
typechecks, and 388 tests: Astro 77, Viz 168, promo 37, and web 106.
Automatic and explicit build IDs passed the integration checks; all three
downloadable projects installed, typechecked, and built outside the workspace.

Both production apps, Storybook, and TypeDoc built successfully. TypeDoc reports
11 missing-reference warnings, and Storybook reports its large-chunk warning;
these builds are not warning-free.

Firefox production-preview checks verified language and title updates on both
request-rendered and prerendered greeting pages, Stateflow step/play through
eight transitions with outbound emissions, and promo line controls updating the
generated settings. This is focused browser smoke coverage, not a full
accessibility or cross-browser qualification. Publication remains separate.

Upstream: [0.166 release](https://github.com/foldkit/foldkit/releases/tag/foldkit%400.166.0),
[0.167 release](https://github.com/foldkit/foldkit/releases/tag/foldkit%400.167.0),
[Vite plugin changelog](https://github.com/foldkit/foldkit/blob/foldkit%400.167.0/packages/vite-plugin-foldkit/CHANGELOG.md).
