# FoldKit 0.129.0 Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the monorepo to FoldKit `0.129.0` and record the next product slices enabled by interruptible Commands.

**Architecture:** Keep dependency ownership unchanged across the Astro integration, viz package, and demo app. This slice records the cancellation design and release intent; it does not add runtime cancellation behaviour until a focused follow-up implementation can be tested against the new API.

**Tech Stack:** Bun workspaces, FoldKit `0.129.0`, Effect, Astro, TypeScript, oxlint, oxfmt, release-please.

## Global Constraints

- Keep `foldkit` at `0.129.0` in all package dependency and peer-dependency declarations.
- Do not add a second release-management system; this repository uses release-please.
- Do not implement interruptible Commands in this dependency-bump slice.
- Preserve existing workspace scripts and package boundaries.
- Run `bun run check`, `bun typecheck`, `bun test`, and package builds before claiming completion.

### Task 1: Upgrade FoldKit dependency declarations

**Files:**

- Modify: `apps/web/package.json`
- Modify: `packages/astro-foldkit/package.json`
- Modify: `packages/foldkit-viz/package.json`
- Modify: `bun.lock`

**Interfaces:**

- Consumes: Existing workspace package manifests and Bun lockfile.
- Produces: A consistent `foldkit@0.129.0` dependency floor across all active workspaces.

- [ ] **Step 1: Update all FoldKit ranges**

  Set direct dependencies to `^0.129.0` and peer dependency floors to `>=0.129.0` in the three active package manifests.

- [ ] **Step 2: Refresh the lockfile**

  Run:

  ```sh
  bun install --lockfile-only
  ```

  Expected: `bun.lock` resolves `foldkit@0.129.0` without changing unrelated dependency families.

- [ ] **Step 3: Verify dependency consistency**

  Run:

  ```sh
  rg -n 'foldkit|0\.128\.1|0\.129\.0' apps packages bun.lock
  ```

  Expected: No active manifest or lockfile entry retains the old `0.128.1` FoldKit version.

### Task 2: Record the product roadmap

**Files:**

- Modify: `ROADMAP.md`

**Interfaces:**

- Consumes: Existing chart roadmap and the FoldKit `0.129.0` interruptible Command capability.
- Produces: A prioritised set of actionable slices for the demo app and both published packages.

- [ ] **Step 1: Add a FoldKit 0.129 augmentation section**

  Add a section near the active roadmap phases with checkboxes for:

  - A cancellable `request-diagnostics` HTTP example using a real request key.
  - An Astro navigation-aware cancellation example that keeps cancellation ownership in the FoldKit app.
  - Guidance and an example for cancelling remote chart-data loads while keeping viz primitives pure.
  - A later evaluation of `@foldkit/markdown`, `@foldkit/devtools`, and `@foldkit/ui`.

- [ ] **Step 2: Document the sequencing constraint**

  State that an interrupt and replacement request must be sequenced through the interrupt result Message, not returned in the same update batch.

### Task 3: Verify and prepare release handoff

**Files:**

- No source files expected beyond Tasks 1 and 2.

**Interfaces:**

- Consumes: Updated manifests, lockfile, and roadmap.
- Produces: Verified release-ready workspace state for the next implementation slice.

- [ ] **Step 1: Run repository checks**

  Run:

  ```sh
  bun run check
  bun typecheck
  bun test
  bun run build
  ```

  Expected: All commands exit `0`; existing lint warnings may remain if they do not fail the check.

- [ ] **Step 2: Inspect the final diff**

  Run:

  ```sh
  git diff --check
  git diff --stat
  git status --short
  ```

  Expected: Only the planned manifests, lockfile, roadmap, and plan document are changed.

- [ ] **Step 3: Commit the upgrade**

  ```sh
  git add apps/web/package.json packages/astro-foldkit/package.json packages/foldkit-viz/package.json bun.lock ROADMAP.md docs/superpowers/plans/2026-07-18-foldkit-0-129-0-upgrade.md
  git commit -m "chore: upgrade foldkit to 0.129.0"
  ```
