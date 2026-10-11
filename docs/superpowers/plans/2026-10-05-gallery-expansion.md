# Gallery Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make Viz's chart breadth visible and add reusable bars, word cloud, paint and text layout.

**Architecture:** Pure accessor-driven geometry is separate from optional Foldkit SVG adapters. Astro precomputes gallery illustrations; native Foldkit examples keep controls and measured text in their Model, with measurement in Commands.

**Tech Stack:** Bun, TypeScript, Foldkit 0.166.0, Effect 4.0.0, Astro 7.1.1.

**Spec:** `docs/superpowers/specs/2026-10-05-gallery-expansion-design.md`

## Global Constraints

- No new D3 runtime dependency; reference `d3-main/d3-scale/src/band.js` and `d3-main/d3-shape/src/stack.js` for bars.
- d3-cloud is not vendored in d3-main: consult upstream source for spiral placement and document rectangular collision differences explicitly.
- Pure geometry must not import Foldkit, Effect or browser APIs.
- Named imports and union `.match`; side effects in Commands only.
- Configurable data, colours, fonts and accessors; no application-specific values in package algorithms.
- Preserve existing six homepage cards and all current live examples.

## Review Focus

- Signed/sparse/duplicate bar data: signed stack endpoints, zero baseline and unique keys.
- Dense or rotated cloud data: no overlap or clipping; report omissions and bounded work.
- Font loading and concurrent requests: stale completions cannot replace current measurements.
- Text overflow/Unicode/newlines: line budgets and explicit breaks have predictable output.
- Multiple SVGs on a page: caller-owned definition IDs and theme colours remain independent.

### Task 1: Pure bar geometry

**Files:** Create `packages/foldkit-viz/src/chart/bars.ts`, `packages/foldkit-viz/test/bars.test.ts`; update package exports, entrypoints, README.

**Interfaces:** `barGeometry<T>(data, {key, category, series, value}, {frame, mode, orientation, padding?, valueDomain?})` returns bars retaining datum/key/category/series/value, SVG rectangle coordinates, category labels, numeric ticks and domain. Consumes existing `band`, `linear`, `axisTicks` and frame validation.

- [x] Write failing tests for grouped/stacked both orientations, signed stacks, sparse series, singleton/empty data, duplicate keys, invalid dimensions and non-finite values.
- [x] Run `bun test packages/foldkit-viz/test/bars.test.ts`; expected missing module failure.
- [x] Implement geometry from existing D3-parity primitives, including separate positive/negative stack accumulation.
- [x] Run focused tests; expected all pass.

### Task 2: Cloud, text and SVG paint

**Files:** Create `src/layout/{wordcloud,text}.ts`, `src/foldkit/paint.ts` and corresponding package tests. Update package metadata/build entrypoints, README.

**Interfaces:** `wordCloud<T>(data, {key,text,width,height,rotation?}, {width,height,padding?,spiral?,maxSteps?})` returns placed records and omitted input data. `wrapText(text, measure, {width,maxLines?})` returns lines, widths and overflow. `dotPattern`, `hatchPattern`, `linearGradient`, `radialGradient` return Foldkit Html definitions for caller-supplied IDs and colours.

- [x] Write failing tests for deterministic non-overlap/containment, rotations, omissions, duplicate IDs and invalid dimensions; wrapping Unicode/newlines/long words/overflow; paint ID/colour rendering.
- [x] Run focused tests; expected missing modules.
- [x] Implement bounded measured-rectangle placement, greedy measured wrapping and optional paint adapters.
- [x] Run focused tests and build; expected all pass.

### Task 3: Gallery and native interactive examples

**Files:** Extend promo `lib/examples.ts`, new `lib/gallery-charts.ts`, new `components/GalleryChart.astro`; add `examples/bars/`, `examples/wordcloud/` and routes; update example index, site CSS and docs.

**Interfaces:** The existing six-entry `examples` list remains the homepage selection; `galleryExamples` adds representative families and optional live routes. Native bars model uses `barGeometry`. Native cloud model stores discriminated measurement state and revisions, with fonts/measurement in a Command and no DOM mutation from views/updates. Both expose current settings/source and accessible tables.

- [x] Add failing model tests for grouping/orientation updates, cloud controls launching measurement and stale completions; verify failures.
- [x] Implement curated gallery additions using existing primitives; implement native examples with responsive SVG, focus interaction, data tables and source display.
- [x] Add documentation and public import consumer coverage.
- [x] Run `bun run check`, `bun typecheck`, `bun run test`, `bun run --filter @opsydyn/promo build`; expected exit 0.
- [x] Native browser QA in light/dark and narrow layouts; verify controls, source, tables and cloud measured bounds.
- [x] Fresh whole-change review; resolve material findings and commit verified changes.

## Verification

- `bun run check` and `bun typecheck`: exit 0.
- `bun run test`: 443 passed; one Pages-build test intentionally skipped outside its build environment.
- Pages build: nine routes built with `/fold-kit-experiments/viz/`; the separate artifact check passed all 263 assertions.
- Native review: desktop and 390px layouts, light/dark themes, controls, keyboard inspection, source and full data tables checked. The cloud reports omissions when constrained and places all 25 demo words at 24px on mobile.
- Independent review: corrected inconsistent stack series order and extended packed-consumer coverage for every new public API.
- Package APIs are documented as unreleased; this change does not publish npm packages or deploy Pages.
