/**
 * Benchmarks against the budgets in docs/effect-three/PLAN.md (Phase 5).
 *
 *   bun bench/index.ts          print results
 *   bun bench/index.ts --check  also exit 1 when a budget is exceeded
 */
import {
  createPicker,
  createPointerTracker,
  createSceneGraph,
  createSceneLoop,
  recordingRendererFactory,
  type SceneDescription,
} from '../src/kernel/index.ts';
import { decodeScene, runtimeMountCycle } from './effectCases.ts';
import { heapGrowthPerCall, type Measurement, measure } from './measure.ts';
import { spinningCube, wideScene } from './scenes.ts';

type Row = Measurement & { readonly budgetMs?: number; readonly note?: string };

const rows: Array<Row> = [];
const record = (row: Row): void => {
  rows.push(row);
};

/** Reconciles alternately to two descriptions, so no call hits the reference fast path. */
const alternating = (a: SceneDescription, b: SceneDescription) => {
  const graph = createSceneGraph();
  graph.reconcile(a);
  let flip = false;
  return {
    graph,
    step: () => {
      flip = !flip;
      return graph.reconcile(flip ? b : a);
    },
  };
};

// 1. No-op reconcile of a structurally equal 1,000-mesh scene (Foldkit sends a fresh
// object on every render, so this is the common case).
{
  const { step } = alternating(wideScene(1000), wideScene(1000));
  const result = step();
  const note = result._tag === 'Applied' ? `${result.ops.length} ops` : result.error._tag;
  record({ ...measure('no-op reconcile, 1,000 meshes', step), budgetMs: 0.2, note });
}

// 2. One changed property among 1,000 meshes: exactly one Update.
{
  const { step } = alternating(wideScene(1000), wideScene(1000, 500));
  const result = step();
  const note = result._tag === 'Applied' ? `${result.ops.length} op` : result.error._tag;
  record({ ...measure('one change, 1,000 meshes', step), budgetMs: 0.5, note });
}

// 3. Kernel mount + unmount of a one-cube scene.
record({
  ...measure('kernel mount + unmount', () => {
    const graph = createSceneGraph();
    graph.reconcile(spinningCube);
    graph.dispose();
  }),
  budgetMs: 1,
});

// 4. Full Effect runtime mount + unmount (scope, renderer, queue, frame subscription).
record({ ...measure('runtime mount + unmount', runtimeMountCycle(spinningCube)), budgetMs: 1 });

// 5. Per-frame kernel overhead with one animated mesh and no pointer.
{
  const graph = createSceneGraph();
  graph.reconcile(spinningCube);
  let time = 0;
  const loop = createSceneLoop({
    graph,
    renderer: recordingRendererFactory().create(),
    elapsedSeconds: () => time,
    emit: () => undefined,
  });
  const frame = (): void => {
    time += 1 / 60;
    loop.frame();
  };
  const bytes = heapGrowthPerCall(frame, 100_000);
  record({
    ...measure('frame: 1 animated mesh', frame, { batch: 1000 }),
    budgetMs: 0.05,
    note: `${bytes.toFixed(1)} B/frame heap growth`,
  });
}

// 6. Per-frame hover re-test with the pointer over the scene (reported, no budget).
{
  const graph = createSceneGraph();
  graph.reconcile(wideScene(100));
  graph.resize(800, 600);
  const tracker = createPointerTracker(createPicker(graph));
  tracker.input({ _tag: 'PointerMove', x: 0, y: 0 });
  record(measure('hover re-test, 100 interactive meshes', () => tracker.frame()));
}

// 7. Schema decode at the adapter boundary (reported, no budget). Only values assigned to
// the element outside the typed `view` helper pay this; typed scenes skip it.
record({
  ...measure('schema decode, 1,000 meshes', decodeScene(wideScene(1000)), { batch: 5 }),
  note: 'untyped values only',
});

const format = (ms: number): string =>
  ms < 0.001 ? `${(ms * 1_000_000).toFixed(0)} ns` : `${(ms * 1000).toFixed(1)} µs`;
const over = rows.filter((row) => row.budgetMs !== undefined && row.medianMs > row.budgetMs);

console.table(
  rows.map((row) => ({
    case: row.name,
    median: format(row.medianMs),
    p95: format(row.p95Ms),
    budget: row.budgetMs === undefined ? '—' : format(row.budgetMs),
    status: row.budgetMs === undefined ? 'report' : row.medianMs > row.budgetMs ? 'OVER' : 'ok',
    note: row.note ?? '',
  })),
);

if (process.argv.includes('--check') && over.length > 0) {
  console.error(
    `${over.length} benchmark(s) over budget: ${over.map((row) => row.name).join(', ')}`,
  );
  process.exit(1);
}
