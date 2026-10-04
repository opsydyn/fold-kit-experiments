# Foldkit Viz Promo Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this
> plan in the current session. Steps use checkbox syntax for tracking.

**Goal:** Deliver the approved landing-page design as a dedicated Astro app.

**Architecture:** Static Astro pages render SVG from Foldkit Viz module imports.
Page chrome owns a minimal theme controller. Promo content is independent of
the existing demo application.

**Tech Stack:** Astro 7.1.1, TypeScript, Bun, Foldkit Viz, oxlint, oxfmt.

**Spec:** `docs/superpowers/specs/2026-10-04-foldkit-viz-promo-design.md`

## Global Constraints

- Private workspace `@opsydyn/promo` under `apps/promo`.
- No D3 dependency, demo-internal imports, hosting adapter or deployment.
- Local routes `/`, `/examples/`, `/docs/`; default port 4322.
- Both approved themes, responsive layout, labelled illustrative data.
- Use existing primitive functions, not newly invented chart algorithms.

## Review Focus

- Invalid or inaccessible saved preferences: fall back to system theme.
- Keyboard-only visits: all actions and month values remain accessible.
- Narrow viewports: navigation, code and charts fit without page overflow.
- Static production output: every local page/anchor link resolves.
- Chart fixtures: SVG geometry and displayed totals agree and remain finite.

### Task 1: Workspace and rendering contracts

**Files:** `apps/promo/package.json`, `astro.config.ts`, `tsconfig.json`,
`src/lib/{theme,charts}.ts`, `test/contracts.test.ts`.

**Interfaces:** Produce theme preference resolution and typed chart geometry
consumed by Astro components. Use named Foldkit Viz scale/shape functions.

- [x] Write focused failing tests for saved/system theme precedence, hero
      totals and finite chart paths.
- [x] Run `bun test apps/promo/test`; confirm missing implementation fails.
- [x] Add the workspace, static config, chart fixtures and pure helpers.
- [x] Install dependencies and rerun focused tests; expect exit 0.

### Task 2: Approved design and supporting pages

**Files:** `apps/promo/src/{layouts,components,pages,styles}`,
`apps/promo/public/favicon.svg`.

**Interfaces:** Consume Task 1's chart geometry and theme resolver; produce
the three static routes, meaningful links and accessible theme controls.

- [x] Build reusable SVG/chart, brand and page-layout components.
- [x] Implement both themes, responsive landing, examples and quick-start.
- [x] Build promo; expect three static pages and exit 0.
- [x] Browser-check desktop/mobile, both themes, keyboard focus and saved
      preferences; fix observed defects.

### Task 3: Workspace integration and qualification

**Files:** Root `package.json`, `README.md`, `AGENTS.md`, `bun.lock`,
`apps/promo/README.md`; narrow lint overrides only if needed at Astro boundaries.

- [x] Include promo in root builds and document `bun run dev:promo`.
- [x] Run root check/typecheck/tests and promo production build; expect exit 0.
- [x] Review generated internal routes/anchors and independent code review.
- [x] Report exact verification results and local preview location.

## Qualification evidence

- Root `bun run check`, `bun typecheck`, `bun run test` and `bun run build` exited 0.
- 309 workspace tests passed, including 6 promo rendering contracts.
- Frozen lockfile installation passed without changes.
- 34 local links and anchors resolved across all three production pages.
- Browser checks covered desktop and 390px mobile widths, both themes, saved theme persistence, keyboard month focus and curve selection.
- Independent review findings were corrected and verified with regression tests and browser inspection.
