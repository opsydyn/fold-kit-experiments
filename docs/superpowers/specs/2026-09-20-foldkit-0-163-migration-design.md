# FoldKit 0.163 Migration Design

**Status:** Draft for review
**Date:** 2026-09-20

## Goal

Move the monorepo from FoldKit 0.161 to FoldKit 0.163 while preserving the
ownership boundaries between the Astro integration, the pure visualization
package, and the reference application.

The migration should consume the useful 0.162 and 0.163 platform changes,
strengthen the Astro SSR contract, and avoid adding artificial examples for
APIs that the repository does not use.

Relevant upstream references:

- [FoldKit 0.163.0 release notes](https://github.com/foldkit/foldkit/releases/tag/foldkit%400.163.0)
- [FoldKit 0.162/0.163 release article](https://foldkit.dev/blog/foldkit-0-163-0)
- [`@foldkit/vite-plugin` package](https://www.npmjs.com/package/%40foldkit/vite-plugin)

## Context

The current checkout targets:

- FoldKit `0.161.0`.
- Effect and `@effect/platform-browser` `4.0.0-rc.115`.
- `@foldkit/vite-plugin` `0.22.x`.
- Astro `7.1.1`.
- `@foldkit/oxlint-plugin` `0.14.0`.

The repository audit found no current use of the renamed `evo`,
`makeConstrainedEvo`, `Subscription.keyboardShortcuts`, old event mapper
names, or `Stream.mapBoth` callback names. Existing uses of
`Subscription.animationFrame({ toMessage })` and
`Subscription.lift({ toParentMessage })` remain valid in 0.163.

## Decisions

### Dependency contract

The workspace will target:

- FoldKit `0.163.0`.
- Effect `4.0.0-rc.116` and the matching
  `@effect/platform-browser` release.
- `@foldkit/vite-plugin` `0.24.0`, subject to confirming its peer metadata
  during installation.
- The latest Oxlint plugin release whose peer and rule metadata supports the
  selected FoldKit version. The migration must verify this rather than
  inventing a version or weakening lint rules.

`@opsydyn/astro-foldkit` and `@opsydyn/foldkit-viz` will raise their tested
FoldKit and Effect compatibility floors together. Exact package release
versions remain a release-management decision and are not encoded in this
design.

The lockfile and package metadata are part of the migration. Unsupported
dependency combinations must fail at installation or typecheck rather than be
hidden behind compatibility shims.

### Package ownership

`@opsydyn/astro-foldkit` owns:

- Astro lifecycle and client-island mounting;
- server rendering and hydration adapters;
- public `AppConfig` and page-document typing;
- tests for canonical metadata and SSR output.

`@opsydyn/foldkit-viz` remains framework-free pure geometry and interaction
math. It must not gain a runtime dependency on FoldKit, Effect, Astro, HTTP,
Machine, or Port APIs as part of this upgrade.

`apps/web` owns:

- application-level canonical URL policy;
- lifecycle and boot regression fixtures;
- any future use of pointer identity or event targets;
- visual demonstrations of FoldKit APIs.

### API migration policy

The implementation will migrate actual usages of the 0.162/0.163 renamed
APIs if the dependency audit finds any. Because the current source audit found
none, it will not add synthetic usages solely to advertise the release.

The following remain unchanged unless a real usage requires a targeted edit:

- `animationFrame` uses `toMessage`;
- `Subscription.lift` uses `toParentMessage`;
- no new `keyBindings` example;
- no new `EntryGates` abstraction;
- no `Stream.mapBoth` migration;
- no `modifyFields` compatibility wrapper.

The new `pointerId` and event-target arguments are source-compatible. They are
reserved for a later, app-owned interaction improvement where pointer identity
solves a demonstrated chart or carousel issue.

### Astro canonical URL contract

FoldKit 0.163 makes canonical URL selection an application decision. The
integration will pass through `Document.canonical` and `Document.ogUrl` but
will not infer a canonical URL from `Astro.url`, route parameters, or the
current browser location.

The current greeting page remains the positive fixture because it explicitly
sets both canonical and `ogUrl`. Stateflow and other pages that omit canonical
metadata remain intentionally without canonical metadata until their app-owned
route policy declares one.

The package documentation will state that consumers must return an explicit
canonical value when a page has a stable canonical identity, especially when
query parameters or alternate representations are involved.

### SSR output contract

The Astro integration build smoke test will verify both sides of the 0.163 SSR
change:

- no unrendered root `index.html` is emitted for the server build;
- explicitly prerendered/static output such as `greeting-static/index.html`
  remains present and contains the expected FoldKit-rendered metadata.

This is a build-output assertion, not a new renderer abstraction.

### Boot timing contract

The existing client/integration test surface will cover the 0.163 fix that
keeps `Subscriptions` and `ManagedResources` aligned with Model changes that
are buffered during boot. The test should use an existing app fixture rather
than introduce a new runtime abstraction. Production source changes are only
permitted if the regression test demonstrates a repository-specific failure.

## Scope

The implementation covers:

- dependency, peer-range, and lockfile updates;
- compatibility verification for the Vite and Oxlint FoldKit tooling;
- the canonical metadata contract tests and package documentation;
- the SSR build-output assertion;
- boot-time subscription/resource regression coverage;
- migration of any real renamed API usages discovered during the final audit;
- updates to current compatibility text in READMEs, `AGENTS.md`, `CLAUDE.md`,
  and the roadmap;
- workspace typecheck, lint, test, package, and integration verification.

## Out of Scope

- FoldKit UI Toast or swipe-to-dismiss adoption;
- adding a new HTTP, Machine, Port, or server-rendering feature;
- changing `foldkit-viz` to depend on FoldKit or Effect;
- introducing a synthetic `keyBindings`, `EntryGates`, or `Stream.mapBoth`
  example;
- changing canonical URL policy for pages that do not explicitly opt in;
- a pointer interaction redesign; this is a follow-up visual slice;
- an Astro major/minor upgrade;
- unrelated lint or formatting cleanup.

## Migration Order

1. Capture the baseline with `bun typecheck`, `bun run check`, and `bun test`.
2. Update package dependencies, peer floors, tooling metadata, and lockfile.
3. Run the static API audit and migrate only actual renamed API usages.
4. Add canonical pass-through and omission tests plus the SSR output assertion.
5. Add the boot buffering regression test using the existing application
   integration surface.
6. Update package and repository documentation.
7. Run the focused package/integration checks, then the full workspace gates.

## Acceptance Criteria

- FoldKit 0.163 and Effect rc.116 resolve consistently in all three active
  workspaces.
- `@opsydyn/astro-foldkit` and `@opsydyn/foldkit-viz` expose compatibility
  metadata matching the tested dependency floor.
- Explicit canonical and `ogUrl` values survive server rendering.
- Omitted canonical values are not silently generated by the Astro bridge.
- The server build does not emit the unrendered root template, while the
  existing static greeting output remains valid.
- The boot buffering regression test passes.
- No obsolete renamed API usage remains after the final audit.
- `bun run check`, `bun typecheck`, and `bun test` pass.
- Existing packed-consumer and Astro integration smoke tests remain green.

## Risks and Mitigations

- **Peer mismatch:** resolve and inspect package peer metadata before accepting
  the lockfile; do not override incompatible peers.
- **SSR output path drift:** assert the actual build artifact layout in the
  existing integration test rather than assuming a new path.
- **Canonical regressions:** test both explicit and omitted metadata so the
  integration cannot silently reintroduce URL inference.
- **False feature adoption:** keep release demonstrations in `apps/web` and
  only add one when it improves a real user workflow.
