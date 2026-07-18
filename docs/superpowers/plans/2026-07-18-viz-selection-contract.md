# Viz Selection Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide a pure, public parent-owned selection contract in `@opsydyn/foldkit-viz` and use it to drive the existing histogram-brush to scatter filtering example.

**Architecture:** `math/brush` remains local pixel-gesture state. The new `interaction/selection` module models durable data-domain selection facts without FoldKit or browser dependencies. The histogram-brush app owns selection and derives its scatter data from it after applying a child histogram message.

**Tech Stack:** TypeScript, Bun test, Vitest, tsdown, FoldKit, Effect.

## Global Constraints

- Keep `@opsydyn/foldkit-viz` framework-agnostic: no runtime `foldkit` or browser dependency in `src/interaction/selection.ts`.
- Preserve the existing `math/brush` and `math/zoom` APIs.
- Make the parent app, not a child chart, own cross-chart selection state.
- Use TDD: observe each new test fail before production implementation.
- Do not add hover or zoom behaviour in this slice; `Keys` and `Interval` are extension points.
- Run root `bun run test` by itself, not alongside commands that rebuild package `dist` directories.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `packages/foldkit-viz/src/interaction/selection.ts` | Pure union, constructors, normalisation, clamping, and membership helpers. |
| `packages/foldkit-viz/test/selection.test.ts` | Contract unit tests. |
| `packages/foldkit-viz/src/index.ts` | Root-barrel re-exports. |
| `packages/foldkit-viz/package.json` | Subpath type/runtime exports. |
| `apps/web/src/apps/histogram-brush/model.ts` | Parent-owned selection model field. |
| `apps/web/src/apps/histogram-brush/update.ts` | Brush-domain conversion and scatter derivation. |
| `apps/web/src/apps/histogram-brush/view.ts` | Parent-selection labels and clear state. |
| `apps/web/src/apps/histogram-brush/update.test.ts` | Selection-ownership regression tests. |
| `packages/foldkit-viz/README.md` | Consumer guidance. |
| `docs/roadmap.md` | First interaction-layer item completion. |

## Task 1: Build The Pure Selection Contract

**Files:**
- Create: `packages/foldkit-viz/src/interaction/selection.ts`
- Create: `packages/foldkit-viz/test/selection.test.ts`
- Modify: `packages/foldkit-viz/src/index.ts`
- Modify: `packages/foldkit-viz/package.json`

**Interfaces:**
- Produces: `Selection`, `SelectionAxis`, `SELECTION_NONE`, `intervalSelection`, `keySelection`, `clampSelection`, `selectionContainsValue`, and `selectionContainsKey`.
- Consumed by: histogram-brush parent model and reducer in Task 2.

- [ ] **Step 1: Write the failing contract tests**

Create `packages/foldkit-viz/test/selection.test.ts`:

```ts
import { describe, expect, it } from 'bun:test';
import {
  clampSelection,
  intervalSelection,
  keySelection,
  SELECTION_NONE,
  selectionContainsKey,
  selectionContainsValue,
} from '../src/interaction/selection';

describe('selection contract', () => {
  it('normalises an interval and clears an empty range', () => {
    expect(intervalSelection('x', [300, 100])).toEqual({
      _tag: 'Interval', axis: 'x', domain: [100, 300],
    });
    expect(intervalSelection('x', [100, 100])).toBe(SELECTION_NONE);
  });

  it('clamps an interval and clears one collapsed by bounds', () => {
    expect(clampSelection(intervalSelection('x', [50, 300]), [100, 200])).toEqual({
      _tag: 'Interval', axis: 'x', domain: [100, 200],
    });
    expect(clampSelection(intervalSelection('x', [10, 20]), [100, 200])).toBe(SELECTION_NONE);
  });

  it('matches values only on the selected axis', () => {
    const selection = intervalSelection('x', [100, 200]);
    expect(selectionContainsValue(selection, 'x', 150)).toBe(true);
    expect(selectionContainsValue(selection, 'y', 150)).toBe(false);
  });

  it('deduplicates keys and clears an empty key selection', () => {
    const selection = keySelection(['slow', 'slow', 'error']);
    expect(selectionContainsKey(selection, 'slow')).toBe(true);
    expect(selectionContainsKey(selection, 'missing')).toBe(false);
    expect(keySelection([])).toBe(SELECTION_NONE);
  });
});
```

- [ ] **Step 2: Verify RED**

Run `bun run --filter @opsydyn/foldkit-viz test -- test/selection.test.ts`.

Expected: FAIL because `src/interaction/selection.ts` does not exist.

- [ ] **Step 3: Implement the minimal pure module**

Create `packages/foldkit-viz/src/interaction/selection.ts`:

```ts
export type SelectionAxis = 'x' | 'y';

export type Selection =
  | Readonly<{ _tag: 'None' }>
  | Readonly<{ _tag: 'Interval'; axis: SelectionAxis; domain: readonly [number, number] }>
  | Readonly<{ _tag: 'Keys'; keys: ReadonlyArray<string> }>;

export const SELECTION_NONE: Selection = { _tag: 'None' };

export const intervalSelection = (
  axis: SelectionAxis,
  [first, second]: readonly [number, number],
): Selection => {
  const domain: readonly [number, number] = [Math.min(first, second), Math.max(first, second)];
  return domain[0] === domain[1] ? SELECTION_NONE : { _tag: 'Interval', axis, domain };
};

export const keySelection = (keys: ReadonlyArray<string>): Selection => {
  const unique = [...new Set(keys)];
  return unique.length === 0 ? SELECTION_NONE : { _tag: 'Keys', keys: unique };
};

export const clampSelection = (selection: Selection, bounds: readonly [number, number]): Selection => {
  if (selection._tag !== 'Interval') return selection;
  const [lower, upper] = [Math.min(...bounds), Math.max(...bounds)];
  return intervalSelection(selection.axis, [
    Math.max(lower, selection.domain[0]),
    Math.min(upper, selection.domain[1]),
  ]);
};

export const selectionContainsValue = (
  selection: Selection,
  axis: SelectionAxis,
  value: number,
): boolean =>
  selection._tag === 'Interval' &&
  selection.axis === axis &&
  value >= selection.domain[0] &&
  value <= selection.domain[1];

export const selectionContainsKey = (selection: Selection, key: string): boolean =>
  selection._tag === 'Keys' && selection.keys.includes(key);
```

Use named conditionals if the repository lint configuration reports warnings for the shown expressions.

- [ ] **Step 4: Publish both entry points**

In `src/index.ts`, add:

```ts
export type { Selection, SelectionAxis } from './interaction/selection';
export {
  clampSelection,
  intervalSelection,
  keySelection,
  SELECTION_NONE,
  selectionContainsKey,
  selectionContainsValue,
} from './interaction/selection';
```

In `package.json`, add `interaction/selection` under `typesVersions['*']` with `./dist/interaction/selection.d.mts`, and add the matching `./interaction/selection` `exports` object with that declaration path and `./dist/interaction/selection.mjs`.

- [ ] **Step 5: Verify GREEN**

Run:

```sh
bun run --filter @opsydyn/foldkit-viz test -- test/selection.test.ts
bun run --filter @opsydyn/foldkit-viz typecheck
```

Expected: both commands exit 0.

- [ ] **Step 6: Commit**

```sh
git add packages/foldkit-viz/src/interaction/selection.ts packages/foldkit-viz/test/selection.test.ts packages/foldkit-viz/src/index.ts packages/foldkit-viz/package.json
git commit -m "feat(foldkit-viz): add selection contract"
```

## Task 2: Migrate Histogram Brush Filtering To Parent Selection

**Files:**
- Create: apps/web/src/apps/histogram-brush/update.test.ts
- Modify: apps/web/src/apps/histogram-brush/model.ts
- Modify: apps/web/src/apps/histogram-brush/update.ts
- Modify: apps/web/src/apps/histogram-brush/view.ts

**Interfaces:**
- Consumes: Task 1 Selection, SELECTION_NONE, intervalSelection, and selectionContainsValue.
- Produces: parent-owned model.selection and scatter points derived only from that field.

- [ ] **Step 1: Write failing ownership tests**

Create apps/web/src/apps/histogram-brush/update.test.ts. Seed existing chart bounds, then route child facts through the parent reducer:

~~~ts
import { describe, expect, it } from 'vitest';
import * as Histogram from '../../ui/histogram-chart';
import * as Scatter from '../../ui/scatter-chart';
import { GotHistogramMessage, GotScatterMessage } from './message';
import { init } from './model';
import { update } from './update';

const seedBounds = (model: ReturnType<typeof init>[0]) =>
  update(
    model,
    GotHistogramMessage({
      message: Histogram.RecordedSvgBounds({
        clientLeft: 0,
        renderedPW: model.histogram.layout.pw,
      }),
    }),
  )[0];

const selectedModel = () => {
  const initial = seedBounds(init(undefined)[0]);
  const started = update(
    initial,
    GotHistogramMessage({
      message: Histogram.StartedHistogramBrush({ screenX: 40, clientX: 40 }),
    }),
  )[0];
  const moved = update(
    started,
    GotHistogramMessage({ message: Histogram.MovedHistogramBrush({ screenX: 180 }) }),
  )[0];
  return update(
    moved,
    GotHistogramMessage({ message: Histogram.EndedHistogramBrush({ screenX: 180 }) }),
  )[0];
};

describe('histogram brush selection', () => {
  it('stores a parent interval and derives filtered scatter points from it', () => {
    const model = selectedModel();
    expect(model.selection._tag).toBe('Interval');
    expect(model.scatter.points).not.toEqual(model.allPoints);
  });

  it('clears the parent selection and restores every point', () => {
    const model = update(
      selectedModel(),
      GotHistogramMessage({ message: Histogram.ClearedHistogramBrush() }),
    )[0];
    expect(model.selection).toEqual({ _tag: 'None' });
    expect(model.scatter.points).toEqual(model.allPoints);
  });

  it('does not replace the parent selection for a local scatter message', () => {
    const selected = selectedModel();
    const model = update(
      selected,
      GotScatterMessage({ message: Scatter.HoveredPoint({ index: 0 }) }),
    )[0];
    expect(model.selection).toBe(selected.selection);
  });
});
~~~

- [ ] **Step 2: Verify RED**

Run:

~~~sh
bun run --filter @opsydyn/web test -- src/apps/histogram-brush/update.test.ts
~~~

Expected: FAIL because the app model has no selection field.

- [ ] **Step 3: Add parent selection and pure derivation**

In model.ts:

~~~ts
import type { Selection } from '@opsydyn/foldkit-viz/interaction/selection';
import { SELECTION_NONE } from '@opsydyn/foldkit-viz/interaction/selection';

export const Model = Schema.Struct({
  histogram: Schema.Unknown,
  scatter: Schema.Unknown,
  allPoints: Schema.Unknown,
  selection: Schema.Unknown,
});

~~~

Add readonly selection: Selection to the Model TypeScript override and initialise it with selection: SELECTION_NONE.

In update.ts, replace the current applyBrushFilter with these helpers:

~~~ts
import {
  intervalSelection,
  SELECTION_NONE,
  selectionContainsValue,
  type Selection,
} from '@opsydyn/foldkit-viz/interaction/selection';

const selectionFromHistogram = (histogram: Histogram.Model): Selection =>
  Option.match(Histogram.getBrushDomain(histogram), {
    onNone: () => SELECTION_NONE,
    onSome: (domain) => intervalSelection('x', domain),
  });

const pointsForSelection = (
  allPoints: ReadonlyArray<Scatter.Point>,
  selection: Selection,
): ReadonlyArray<Scatter.Point> =>
  selection._tag === 'Interval'
    ? allPoints.filter((point) => selectionContainsValue(selection, 'x', point.x))
    : allPoints;

const applyBrushSelection = (model: Model, histogram: Histogram.Model): Return => {
  const selection = selectionFromHistogram(histogram);
  const [scatter] = Scatter.update(
    model.scatter,
    Scatter.UpdatedPoints({ points: pointsForSelection(model.allPoints, selection) }),
  );
  return [{ ...model, histogram, scatter, selection }, []];
};
~~~

If the two conditional expressions produce new lint warnings, replace each with Match.value over the tagged Selection union while preserving exactly the same branches.

Keep BRUSH_TAGS as the only selection-changing child messages. Non-brush histogram messages and all scatter messages must preserve the current parent selection.

- [ ] **Step 4: Read selection in the app view**

In view.ts, replace Histogram.getBrushDomain(model.histogram) with:

~~~ts
const selection = model.selection;
const brushDomain =
  selection._tag === 'Interval' && selection.axis === 'x' ? selection.domain : null;
const hasBrush = brushDomain !== null;
~~~

Derive the range label, count label, status colour, empty state, and clear-button opacity from hasBrush and brushDomain. For None and Keys, retain the current all-requests label and inactive clear state.

Keep the clear action mapped to the existing Histogram.ClearedHistogramBrush fact: the reducer converts the resulting child state into SELECTION_NONE.

- [ ] **Step 5: Verify GREEN**

Run:

~~~sh
bun run --filter @opsydyn/web test -- src/apps/histogram-brush/update.test.ts
bun run --filter @opsydyn/web typecheck
~~~

Expected: both commands exit 0. The test proves brush filtering, clearing, and local scatter-message stability.

- [ ] **Step 6: Commit**

~~~sh
git add apps/web/src/apps/histogram-brush/model.ts apps/web/src/apps/histogram-brush/update.ts apps/web/src/apps/histogram-brush/view.ts apps/web/src/apps/histogram-brush/update.test.ts
git commit -m "feat(web): own histogram brush selection"
~~~

## Task 3: Document The Contract And Verify The Workspace

**Files:**
- Modify: packages/foldkit-viz/README.md
- Modify: docs/roadmap.md

**Interfaces:**
- Consumes: public imports and ownership behaviour delivered in Tasks 1 and 2.
- Produces: consumer guidance that keeps Viz pure and places cross-chart state in the parent app.

- [ ] **Step 1: Add module and ownership guidance**

In the Viz README module table, add:

~~~markdown
| @opsydyn/foldkit-viz/interaction/selection | Selection, interval/key constructors, clamping, and membership helpers for parent-owned chart interaction state |
~~~

After the table, add a Parent-owned interaction state section:

~~~ts
const selection = intervalSelection('x', [100, 300]);
const visible = allPoints.filter((point) =>
  selectionContainsValue(selection, 'x', point.x),
);
~~~

State that Viz owns pure interaction values, individual charts own local gesture mechanics, and the consuming parent owns shared selection and child-message coordination. Mention keySelection only as the future hover/active-series form; do not imply hover or zoom are implemented in this slice.

- [ ] **Step 2: Update only the completed roadmap item**

In docs/roadmap.md, mark this exact item complete:

~~~markdown
- [x] Define controlled parent-owned selection contracts for brush, zoom, hover, and active series.
~~~

Do not change the remaining interaction-layer, reference-app, release-quality, or deliberate-non-goal checkboxes.

- [ ] **Step 3: Run sequential full verification**

Run each command only after its predecessor completes:

~~~sh
bun run check
bun typecheck
bun run test
git diff --check
~~~

Expected: every command exits 0. bun run check may print established warning-level lint findings, but Oxfmt must report that all matched files are correctly formatted. bun run test must report the full workspace suite green.

- [ ] **Step 4: Commit**

~~~sh
git add packages/foldkit-viz/README.md docs/roadmap.md
git commit -m "docs: explain parent-owned chart selection"
~~~
