# Storybook GitHub Pages Blank Stories Postmortem

Date: 2026-06-12

## Summary

Storybook deployed to GitHub Pages loaded its manager UI correctly, but selected stories rendered a blank preview canvas. The sidebar, controls panel, and story selection worked, which initially suggested a Storybook routing or static asset issue. The underlying failure was in the Storybook-to-FoldKit mount lifecycle: FoldKit runtimes were started before Storybook attached the returned story element to the iframe DOM.

## Impact

- Public Storybook pages at `https://opsydyn.github.io/fold-kit-experiments/` appeared empty for chart stories.
- The Storybook shell still loaded, so the failure mode looked like a chart rendering issue rather than a deployment failure.
- Local Storybook development appeared fine, which made the static GitHub Pages path harder to diagnose.

## Detection

The issue was reported from the deployed Storybook URL:

```text
https://opsydyn.github.io/fold-kit-experiments/?path=/story/charts-primitives--bar
```

The deployed page showed Storybook chrome and the selected `Charts / Primitives / Bar chart` story, but the preview iframe contained no chart DOM.

## Root Cause

Storybook calls each story's `render()` function before inserting the returned `HTMLElement` into the preview iframe DOM. The existing FoldKit story helpers created a container and immediately started the FoldKit runtime against that detached container:

- App stories used `embed(makeApplication(...))` immediately in `mountFoldkit()`.
- Primitive stories used `run(makeElement(...))` immediately in `mountChart()`.

FoldKit's initial render patches the container node. Because the container was detached at that point, the rendered node replacement happened off-DOM. Storybook then attached the original empty element returned by `render()`, leaving the iframe with an empty container.

## Contributing Factors

- Local development did not make the lifecycle ordering obvious.
- The first visible symptom resembled a GitHub Pages base-path problem.
- The static output had previously produced absolute preview asset paths, so the deployment path was a plausible initial suspect.
- There was no automated static Storybook smoke test that asserted rendered story DOM exists.

## Resolution

The Storybook FoldKit mount layer was changed to return a stable host element immediately, then defer FoldKit startup until that host is connected to the document:

- Added `mountFoldkitProgram()` in `apps/web/src/stories/mount.ts`.
- It creates a host and child container, schedules startup with `setTimeout`, waits for `host.isConnected`, then starts the runtime with `embed()`.
- It observes DOM removal and disposes the FoldKit runtime when Storybook tears down or swaps stories.
- Updated primitive chart stories to use `makeElement()` with `mountFoldkitProgram()` instead of `run()`.

## Verification

Static production Storybook was rebuilt with the GitHub Pages base path:

```sh
GITHUB_ACTIONS=true ./node_modules/.bin/storybook build
```

The generated `storybook-static` output was served locally under `/fold-kit-experiments/`, then checked with Playwright against representative iframe URLs:

```text
charts-basic--bar             svg 1, rect 7
charts-primitives--bar        svg 1, rect 9
charts-advanced--animated-bar svg 1, rect 6
```

Focused formatting/lint check passed:

```sh
../../node_modules/.bin/biome check src/stories/mount.ts src/stories/charts-primitives.stories.ts
```

## Follow-Ups

- Add a CI smoke test for built Storybook that serves `storybook-static` and asserts selected iframe stories contain expected SVG output.
- Consider excluding `storybook-static` from `apps/web/tsconfig.json` so generated bundles do not interfere with local typechecking.
- Track existing chart primitive TypeScript errors separately:
  - `src/ui/area-chart/index.ts`
  - `src/ui/bar-chart/index.ts`
  - `src/ui/line-chart/index.ts`
  - `src/ui/scatter-chart/index.ts`
- Consider aligning FoldKit and Effect peer versions in a dedicated upgrade task rather than coupling that to the Storybook lifecycle fix.

## Lessons Learned

- For Storybook HTML stories, do not start DOM-patching runtimes inside `render()` unless the runtime can safely render into a detached node.
- Static Storybook behavior should be validated from built output, not only from the local dev server.
- A loaded Storybook manager does not prove the preview iframe runtime successfully rendered story content.
