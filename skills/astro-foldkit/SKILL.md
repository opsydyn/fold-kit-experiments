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
`0.8.1`, FoldKit `0.167.0`, Effect `4.0.0` and Astro `7.2.8`. This is a tested
baseline, not a claim about the latest release or every supported Astro version.
For a different version, check its declarations and release notes first.

Use package imports, including the default integration import from
`@opsydyn/astro-foldkit`. Do not substitute monorepo source paths. A local
upstream checkout is useful only after checking its version against the consumer.

## Choose ownership

| Need                                       | Entry point                      | Server behaviour                   |
| ------------------------------------------ | -------------------------------- | ---------------------------------- |
| Interactive widget in an Astro-owned page  | `lazyApp` from `/define-app`     | Mount shell only                   |
| FoldKit owns the page content and metadata | `definePage` from `/define-page` | SSG or request SSR, then hydration |

Both use `client:load` for interactivity. `defineApp` is the compatible alias of
`lazyApp`. Keep a literal loader at this intentional lazy entry boundary:
`() => import('./main')` for the example island, `() => import('./page-main')`
for its page owner. Use static imports elsewhere. The loaded module exports real
`Model` and `Message` schemas plus `init`, `update` and `view`; server pages also
export `Flags`. Do not use `null` or `{}` as runtime schema placeholders merely
because the public config type accepts them.
Keep `Flags` out of the module loaded by `lazyApp`: its props-based runtime does
not supply a Flags Effect. To reuse an app, add a separate page module that
re-exports the application and adds `Flags`, as the example does.

Start with the [standalone counter](assets/counter/package.json). Its `/` route
is a client island; `/page/` prerenders the same application. It has no sibling
skill, workspace or Viz dependency. See [integration details](references/integration.md)
for request SSR, navigation, troubleshooting and verification.

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
