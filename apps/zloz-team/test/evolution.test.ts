import { expect, test } from 'bun:test';

import { Html } from '@effect/ui/html';
import { HtmlLocator, HtmlScene } from '@effect/ui/html/testing';
import { Locator } from '@effect/ui/testing';
import type { ZlozGraph } from '@opsydyn/foldkit-zloz';
import { Effect, Schema } from 'effect';

import { empty, graphAt, inspect, observe } from '../src/editor/evolution';
import { view as evolutionView } from '../src/editor/evolution-view';
import { createWorkshopNote } from '../src/editor/workshop';

const emptyGraph: ZlozGraph = { nodes: [], edges: [] };

test('counts all five C4 types, other nodes and authored relationships separately', () => {
  const types = [
    { family: 'c4', role: 'person' },
    { family: 'c4', role: 'software-system' },
    { family: 'c4', role: 'software-system', scope: 'external' },
    { family: 'c4', role: 'container', scope: 'external' },
    { family: 'c4', role: 'component' },
    { family: 'ddd', role: 'aggregate' },
    undefined,
  ] as const;
  const graph: ZlozGraph = {
    nodes: types.map((architecture, index) => ({
      id: String(index),
      label: `Node ${index}`,
      architecture,
      position: { x: 0, y: 0 },
      size: { width: 100, height: 60 },
      ports: [
        { id: 'in', side: 'left', kind: 'input', offset: 0.5 },
        { id: 'out', side: 'right', kind: 'output', offset: 0.5 },
      ],
    })),
    edges: [{ id: 'calls', source: { node: '1', port: 'out' }, target: { node: '2', port: 'in' } }],
  };
  expect(observe(empty, { version: 0, graph }).samples).toEqual([
    {
      version: 0,
      graph,
      counts: {
        events: 0,
        openHotspots: 0,
        person: 1,
        'software-system': 1,
        'external-system': 1,
        container: 1,
        component: 1,
        other: 2,
        relationships: 1,
      },
    },
  ]);
});

test('the first observed version establishes the baseline and repeated or older versions are ignored', () => {
  const history = observe(empty, { version: 42, graph: emptyGraph });
  expect(history.samples.map(({ version }) => version)).toEqual([42]);
  expect(history.restartedAfterGap).toBe(false);
  expect(observe(history, { version: 42, graph: emptyGraph })).toBe(history);
  expect(observe(history, { version: 41, graph: emptyGraph })).toBe(history);
});

test('missing confirmed versions restart the observed window and reset an old inspection', () => {
  const initial = observe(empty, { version: 12, graph: emptyGraph });
  const history = inspect(observe(initial, { version: 13, graph: emptyGraph }), '12');
  const resumed = observe(history, { version: 16, graph: emptyGraph });
  expect(resumed.samples.map(({ version }) => version)).toEqual([16]);
  expect(resumed.restartedAfterGap).toBe(true);
  expect(resumed.inspected).toBeNull();
  expect(inspect(resumed, '13')).toBe(resumed);
});

test('the window holds 40 consecutive versions and evicting an inspected version follows latest', () => {
  const baseline = inspect(observe(empty, { version: 7, graph: emptyGraph }), '7');
  const full = Array.from({ length: 39 }, (_, index) => index + 8).reduce(
    (history, version) => observe(history, { version, graph: emptyGraph }),
    baseline,
  );
  expect(full.inspected).toBe(7);
  const next = observe(full, { version: 47, graph: emptyGraph });
  expect(next.samples.map(({ version }) => version)).toEqual(
    Array.from({ length: 40 }, (_, index) => index + 8),
  );
  expect(next.inspected).toBeNull();
  expect(next.restartedAfterGap).toBe(false);
});

test('rewind has exact confirmed geometry and never supplies a missing version', () => {
  const original: ZlozGraph = {
    nodes: [
      {
        id: 'worker',
        label: 'Original',
        position: { x: 12, y: 50 },
        size: { width: 100, height: 60 },
        ports: [],
      },
    ],
    edges: [],
  };
  const moved: ZlozGraph = {
    nodes: original.nodes.map((node) => ({
      ...node,
      label: 'Renamed',
      position: { x: 200, y: 50 },
    })),
    edges: [],
  };
  const baseline = observe(empty, { version: 7, graph: original });
  const history = observe(baseline, { version: 8, graph: moved });
  expect(graphAt(history, 7)?.nodes[0]).toMatchObject({
    label: 'Original',
    position: { x: 12, y: 50 },
  });
  expect(graphAt(history, 8)?.nodes[0]).toMatchObject({
    label: 'Renamed',
    position: { x: 200, y: 50 },
  });
  const resumed = observe(history, { version: 11, graph: emptyGraph });
  expect(graphAt(resumed, 8)).toBeUndefined();
  expect(graphAt(resumed, 10)).toBeUndefined();
  expect(graphAt(resumed, 11)).toEqual(emptyGraph);
});

test('workshop chart activation opens the selected version with its retained predecessor', () => {
  const history = [17, 18, 19].reduce(
    (current, version) => observe(current, { version, graph: emptyGraph }),
    empty,
  );
  const Target = Schema.Struct({
    version: Schema.Number,
    baseline: Schema.optionalKey(Schema.Number),
  });
  const fixture = Html.component({
    name: 'EvolutionActivation',
    model: Target,
    message: Target,
  }).make({
    init: () => ({ version: -1 }),
    update: (_state, target) => target,
    view: (h, model) =>
      model.version >= 0
        ? h.p.children(`Review ${model.version}, baseline ${model.baseline ?? 'none'}`)
        : evolutionView(
            h,
            history,
            'live',
            () => model,
            (version, baseline) => (baseline === undefined ? { version } : { version, baseline }),
            'available',
            'workshop',
          ),
  });
  Effect.gen(function* () {
    for (const [attribute, value, expected] of [
      ['data-evolution-version', '17', 'Review 17, baseline none'],
      ['data-evolution-version', '18', 'Review 18, baseline 17'],
      ['id', 'board-open-history', 'Review 19, baseline 18'],
    ] as const) {
      const scene = yield* HtmlScene.make(fixture, {});
      scene.click(Locator.attr(attribute, value)).expect(Locator.text(expected)).toExist();
    }
  }).pipe(Effect.scoped, Effect.runSync);
});

test('only Event Storming domain events contribute to the workshop event series', () => {
  const nodes = [
    createWorkshopNote('domain-event', 'event', []),
    createWorkshopNote('command', 'command', []),
    {
      ...createWorkshopNote('domain-event', 'ddd-event', []),
      architecture: { family: 'ddd', role: 'domain-event' } as const,
    },
  ];
  expect(
    observe(empty, { version: 7, graph: { nodes, edges: [] } }).samples[0]?.counts,
  ).toMatchObject({ events: 1, openHotspots: 0, other: 3 });
});

test.each([
  ['live', 'blocked'],
  ['offline', 'blocked'],
] as const)(
  'Evolution keeps counts readable with rewind unavailable (%s, %s)',
  (connection, availability) => {
    const history = [7, 8].reduce(
      (current, version) => observe(current, { version, graph: emptyGraph }),
      empty,
    );
    const fixture = Html.component({
      name: 'EvolutionCounts',
      model: Schema.Null,
      message: Schema.String,
    }).make({
      init: () => null,
      update: ($) => $.model,
      view: (h) =>
        evolutionView(h, history, connection, (value) => value, String, availability, 'workshop'),
    });
    Effect.gen(function* () {
      const scene = yield* HtmlScene.make(fixture, {});
      scene.expect(HtmlLocator.role('table', { name: 'Counts at version 8' })).toExist();
      scene.expect(HtmlLocator.role('button', { name: 'Open on canvas' })).toBeDisabled();
      scene.expect(Locator.attr('data-evolution-version')).toBeAbsent();
    }).pipe(Effect.scoped, Effect.runSync);
  },
);
