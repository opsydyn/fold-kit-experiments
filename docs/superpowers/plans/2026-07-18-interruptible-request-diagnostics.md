# Interruptible Request Diagnostics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the request diagnostics reload action interrupt and replace an in-flight `foldkit/http` request using FoldKit `0.129.0`.

**Architecture:** `FetchMetrics` owns HTTP work and is registered under a fixed diagnostics-dataset key with `Command.Interruptible.define`. The application update owns cancellation and dispatches a replacement request only after the interrupt outcome Message, leaving Astro lifecycle and chart primitives unchanged.

**Tech Stack:** FoldKit `0.129.0`, Effect, `foldkit/http`, `foldkit/experimental`, Vitest, Astro.

## Global Constraints

- Install the locked `foldkit@0.129.0` package before importing its new API.
- Preserve unidirectional flow: view -> Message -> update -> Command -> Message.
- Keep `FetchMetrics` as the only owner of the HTTP effect and `Http.layer` provisioning.
- Use a past-tense interrupt outcome Message and a `Schema.Unknown` type override only if the outcome cannot be represented by Effect Schema.
- Do not return an interrupt Command and replacement `FetchMetrics()` Command in the same update batch.
- Do not change public APIs of `@opsydyn/astro-foldkit` or `@opsydyn/foldkit-viz`.

---

### Task 1: Install and verify the FoldKit 0.129 Command API

**Files:**

- Modify: `node_modules/` only through Bun installation; no tracked source change.

**Interfaces:**

- Consumes: `bun.lock` resolving `foldkit@0.129.0`.
- Produces: Installed declarations for `Command.Interruptible.define` and its `Interrupt` constructor.

- [x] **Step 1: Install from the existing lockfile**

  Run:

  ```sh
  bun install --frozen-lockfile
  ```

  Expected: workspace `foldkit` symlinks resolve to `0.129.0`.

- [x] **Step 2: Inspect the installed declarations**

  Run:

  ```sh
  rg -n -C 3 'Interruptible' node_modules/.bun/foldkit@0.129.0*/node_modules/foldkit/dist
  ```

  Expected: the exact no-argument definition and interrupt-call overloads are available before source is changed.

### Task 2: Cover interrupt sequencing with failing update tests

**Files:**

- Modify: `apps/web/src/apps/request-diagnostics/machine.test.ts`
- Modify: `apps/web/src/apps/request-diagnostics/command.test.ts`

**Interfaces:**

- Consumes: `ClickedReload`, `FetchMetrics`, and the new interrupt outcome Message.
- Produces: tests proving a reload in `Loading` first interrupts and starts replacement only after the outcome Message.

- [x] **Step 1: Add the failing loading-state test**

  Add a test asserting that `diagnosticsMachine.step(Loading(), ClickedReload())` transitions to `Loading` and returns exactly one interrupt Command, with no replacement `FetchMetrics()` Command in that command list.

- [x] **Step 2: Add the failing update sequencing test**

  Add a test that sends the interrupt outcome Message to `update(initModel, message)` and asserts that it returns exactly one `FetchMetrics()` replacement command.

- [x] **Step 3: Run focused tests and confirm the expected API failure**

  Run:

  ```sh
  bun run --filter @opsydyn/web test -- apps/web/src/apps/request-diagnostics/machine.test.ts apps/web/src/apps/request-diagnostics/command.test.ts
  ```

  Expected: FAIL because `ClickedReload` is ignored while loading and the interrupt outcome Message does not exist.

### Task 3: Implement the interruptible command flow

**Files:**

- Modify: `apps/web/src/apps/request-diagnostics/command.ts`
- Modify: `apps/web/src/apps/request-diagnostics/message.ts`
- Modify: `apps/web/src/apps/request-diagnostics/update.ts`

**Interfaces:**

- Consumes: FoldKit `Command.Interruptible.define` and `FetchMetrics.Interrupt`.
- Produces: `FetchMetrics()` for metrics work and `CompletedCancelFetchMetrics` as the app-owned interrupt result fact.

- [x] **Step 1: Define `FetchMetrics` as interruptible**

  Retain the existing HTTP effect and response decoding, but use the no-argument `Command.Interruptible.define` overload so FoldKit uses the command name as the diagnostics key.

- [x] **Step 2: Add the completion Message**

  Add `CompletedCancelFetchMetrics` to the message schema. It carries `Command.Interruptible.Outcome`, which is directly representable by Effect Schema.

- [x] **Step 3: Sequence reload through the completion Message**

  Change every `ClickedReload` state-machine transition to return `FetchMetrics.Interrupt(CompletedCancelFetchMetrics)` and add the `CompletedCancelFetchMetrics` update case returning `[model, [FetchMetrics()]]`.

- [x] **Step 4: Run the focused tests**

  Run:

  ```sh
  bun run --filter @opsydyn/web test -- apps/web/src/apps/request-diagnostics/machine.test.ts apps/web/src/apps/request-diagnostics/command.test.ts
  ```

  Expected: PASS.

### Task 4: Verify the full workspace and document the shipped slice

**Files:**

- Modify: `ROADMAP.md`

**Interfaces:**

- Consumes: Working interruptible reload flow.
- Produces: the P0 roadmap item marked complete with a short pointer to the retained sequencing rule.

- [x] **Step 1: Mark P0 complete**

  Mark the cancellable request diagnostics item complete and retain the constraint that a replacement starts only from the interrupt outcome Message.

- [x] **Step 2: Run all verification**

  Run:

  ```sh
  bun run check
  bun typecheck
  bun run --filter '*' test
  bun run build
  git diff --check
  ```

  Expected: all commands exit `0`; pre-existing lint warnings may remain.

- [x] **Step 3: Commit the slice**

  ```sh
  git add apps/web/src/apps/request-diagnostics/command.ts apps/web/src/apps/request-diagnostics/message.ts apps/web/src/apps/request-diagnostics/update.ts apps/web/src/apps/request-diagnostics/machine.test.ts apps/web/src/apps/request-diagnostics/command.test.ts ROADMAP.md docs/superpowers/plans/2026-07-18-interruptible-request-diagnostics.md
  git commit -m "feat: add interruptible diagnostics reload"
  ```
