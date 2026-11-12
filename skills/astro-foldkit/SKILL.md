---
name: astro-foldkit
description: Use when installing or using @opsydyn/astro-foldkit in Astro, choosing FoldKit islands versus server-rendered pages, passing typed props or Flags, or troubleshooting hydration, metadata, navigation lifecycle, and package resolution.
---

# Astro FoldKit

Integrate a FoldKit application into Astro. Astro owns the document, deployment
adapter and hydration boundary; the application owns its Model, Messages,
Commands and remote-data policy. No chart package is required.

## Establish the consumer contract

Read the consumer's manifest, lockfile and installed package exports before
choosing APIs. This skill's runnable example targets `@opsydyn/astro-foldkit`
`0.12.0`, FoldKit `0.170.0`, Effect `4.1.0` and Astro `7.4.11`. `0.12.0` peers on FoldKit
`>=0.170.0 <0.171.0` and Effect `~4.1.0`: an app on an older FoldKit needs an older
release of the integration, not this one. This is a tested
baseline, not a claim about the latest release or every supported Astro version.
For a different version, check its declarations and release notes first.
With FoldKit, pin `@effect/platform-browser` to the same version as `effect` (`4.1.0`
here). FoldKit 0.170 accepts `~4.1.0`, so npm otherwise picks the newest `4.1.x`, which
requires an equal or newer `effect` and fails to resolve against an exact `4.1.0`.

Use package imports, including the default integration import from
`@opsydyn/astro-foldkit`. Do not substitute monorepo source paths. A local
upstream checkout is useful only after checking its version against the consumer.

## Choose ownership

| Need                                       | Entry point                      | Server behaviour                                         |
| ------------------------------------------ | -------------------------------- | -------------------------------------------------------- |
| A component in an Astro-owned page         | `lazyApp` from `/define-app`     | Empty mount; with `{ prerender: true }`, the island's markup |
| FoldKit owns the page content and metadata | `definePage` from `/define-page` | SSG or request SSR, then hydration                       |

For an island, choose when its JavaScript runs separately, as below.
`defineApp` is the compatible alias of `lazyApp`. Keep a literal loader at this intentional lazy entry boundary:
`() => import('./main')` for the example island, `() => import('./page-main')`
for its page owner. Use static imports elsewhere. The loaded module exports real
`Model` and `Message` schemas plus `init`, `update` and `view`; server pages also
export `Flags`. Do not use `null` or `{}` as runtime schema placeholders merely
because the public config type accepts them.
Keep `Flags` out of the module loaded by `lazyApp`: its props-based runtime does
not supply a Flags Effect. To reuse an app, add a separate page module that
re-exports the application and adds `Flags`, as the example does.

Start with the [standalone counter](assets/counter/package.json). Its `/` route
is a pre-rendered client island; `/page/` prerenders the same application as a
page owner. It has no sibling skill, workspace or Viz dependency. See
[integration details](references/integration.md) for request SSR, navigation,
troubleshooting and verification.

## Choose when JavaScript runs

Default an island to `lazyApp(load, { prerender: true })` when its `init` and
`view` are pure. Its markup is then in the HTML, it has size, and every client
directive works. Leave it off only when `init` touches a browser-only resource:
the server render would throw, and a failed pre-render fails the build on
purpose.

Then pick the directive per island:

- **Read, never touched** (most charts): no directive. Astro emits no island and
  no script, so the pre-rendered markup is the whole component. Keep what a hover
  readout showed as an SVG `<title>` on each mark — a native tooltip that needs
  no runtime.
- **Interactive, below the fold**: `client:visible`. It needs `prerender: true`:
  Astro observes an island's children, and an empty mount is 0x0, so it never
  intersects and never hydrates.
- **Interactive, but used by few readers**: `client:interaction` (0.12.0+). It
  loads nothing until a pointer press, focus or key press inside the island,
  then replays those clicks, edits and focus onto the booted app;
  `{ hover: true }` also starts on mouse hover. It needs `prerender: true` too.
  Every first interaction waits for the download, so prefer `client:visible`
  unless most readers never touch the island, and never for an island whose
  controls stay disabled until data arrives: there the first tap only starts
  the download.
- **Interactive at once**: `client:load` or `client:idle`.

The FoldKit runtime is shared, so a single island hydrating at load pays for all
of it, and making the other islands static then saves only their own chunks.
Aim for no island hydrating at load: pre-render everything, leave readable
islands without a directive, and put the interactive one on `client:visible`.
On a measured report page with three charts and a data grid, that took
JavaScript at load from 377 KB to none, with the grid's 351 KB arriving only
when it was scrolled to.

The renderer warns once per component about the arrangements that fail
silently: no directive without `prerender`, which never displays anything;
`client:visible` without `prerender`, which never hydrates; and
`client:interaction` without `prerender`, which has nothing to interact with and
hydrates at once. Treat any of these warnings as a bug, not noise.

## Keep the boundaries intact

- Use real Effect Schemas at serialized input boundaries. Return records from
  `init` and `update`: `{ model, commands? }`. Use past-tense Message facts and
  the union's exhaustive `.match`.
- Islands receive props. Page owners receive validated public JSON Flags from
  a synchronous factory. Keep credentials and runtime handles out of both.
- One `definePage` owner per document. Resolve its metadata with
  `resolvePageDocument` from `/server` in Astro frontmatter, never browser code.
- `noMeta` is island-only and pins the title, not all document metadata.
- Commands and scoped subscriptions own effects. Provision dependencies at the
  owning service/exported Effect boundary, not inside local helper bodies.
- Navigation observation is not cancellation policy. Keep request identity,
  interruption and replacement decisions in the application. Do not infer page
  lifecycle guarantees from the client-island bridge.

## Finish with evidence

Run the consumer's typecheck, production build and tests. Verify initial HTML
separately from browser hydration and interaction. For navigation changes, test
exit during loading, exit after completion, and retained-island `stayed` events.
Report what was checked; a successful build alone does not prove hydration.

For charts, use the independently installable `foldkit-viz` skill only when the
consumer actually uses that package. AG-UI and agent orchestration are outside
this skill's scope.
