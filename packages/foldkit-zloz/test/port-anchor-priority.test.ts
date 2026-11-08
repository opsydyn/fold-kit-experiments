import { expect, test } from 'bun:test';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
import { Window } from 'happy-dom';

import { zlozView } from '../src/foldkit';
import * as Zloz from '../src/index';
import type { EditorEvent, EditorPolicy, PortAnchorSnapPriority } from '../src/index';

type MutablePriorityProfile = { priority: PortAnchorSnapPriority };

const graph: Zloz.ZlozGraph = {
  nodes: [
    {
      id: 'n',
      label: 'N',
      position: { x: 0, y: 0 },
      size: { width: 200, height: 100 },
      ports: [{ id: 'p', kind: 'input', side: 'bottom', anchor: { x: 0.5, y: 0.5 } }],
    },
  ],
  edges: [],
};
const options = {
  size: { width: 200, height: 100 },
  zoom: 1,
  distance: 12,
  cornerDistance: 40,
  midpointDistance: 40,
};
const point = { x: 0.03, y: 0.25 };
const start: EditorEvent = {
  type: 'PortAnchorDragStarted',
  endpoint: { node: 'n', port: 'p' },
  pointer: 1,
  point: { x: 0, y: 0 },
};
const moved: EditorEvent = { type: 'PointerMoved', pointer: 1, point: { x: -94, y: -25 } };
const release: EditorEvent = { type: 'PointerReleased', pointer: 1 };
const bypass = (bypassed: boolean): EditorEvent => ({
  type: 'PortAnchorSnapBypassChanged',
  pointer: 1,
  bypassed,
});
const initial = (priority?: PortAnchorSnapPriority) =>
  Zloz.createEditor(graph, {
    portAnchorCornerSnapDistance: 40,
    portAnchorMidpointSnapDistance: 40,
    portAnchorSnapPriority: priority,
  });

test('point-target priority changes the overlapping winner and preserves the default and edge fallback', () => {
  expect(Zloz.resolvePortAnchorSnap(point, options)).toEqual({
    anchor: { x: 0, y: 0 },
    side: null,
    corner: 'top-left',
  });
  expect(Zloz.resolvePortAnchorSnap(point, { ...options, priority: 'midpoints-first' })).toEqual({
    anchor: { x: 0, y: 0.5 },
    side: null,
    midpoint: 'left',
  });
  expect(Zloz.resolvePortAnchorSnap(point, { ...options, priority: 'corners-first' }).corner).toBe(
    'top-left',
  );
  expect(
    Zloz.resolvePortAnchorSnap(point, {
      ...options,
      priority: 'midpoints-first',
      allowedMidpoints: [],
    }).corner,
  ).toBe('top-left');
  expect(Zloz.resolvePortAnchorSnap(point, { ...options, allowedCorners: [] }).midpoint).toBe(
    'left',
  );
  expect(
    Zloz.resolvePortAnchorSnap(point, {
      ...options,
      priority: 'midpoints-first',
      cornerDistance: 0,
      midpointDistance: 0,
    }).side,
  ).toBe('left');
  expect(
    Zloz.resolvePortAnchorSnap(point, {
      ...options,
      priority: 'midpoints-first',
      cornerDistance: 0,
      midpointDistance: 0,
      distance: 0,
    }),
  ).toEqual({ anchor: point, side: null });
  expect(
    Zloz.resolvePortAnchorSnap(
      { x: 0.015, y: 0.375 },
      { ...options, zoom: 2, priority: 'midpoints-first', cornerDistance: 80 },
    ).midpoint,
  ).toBe('left');
});

test('preferred target kinds take precedence over lower-kind retention without changing within-kind hysteresis', () => {
  const small = {
    ...options,
    size: { width: 20, height: 20 },
    cornerDistance: 12,
    midpointDistance: 12,
    hysteresis: 4,
  };
  expect(
    Zloz.resolvePortAnchorSnap({ x: 0.1, y: 0.1 }, { ...small, previousMidpoint: 'left' }).corner,
  ).toBe('top-left');
  expect(
    Zloz.resolvePortAnchorSnap(
      { x: 0.1, y: 0.1 },
      { ...small, previousCorner: 'top-left', priority: 'midpoints-first' },
    ).midpoint,
  ).toBe('left');
  expect(
    Zloz.resolvePortAnchorSnap(
      { x: 0.6, y: 0.5 },
      { ...small, previousMidpoint: 'left', priority: 'midpoints-first' },
    ).midpoint,
  ).toBe('left');
  expect(
    Zloz.resolvePortAnchorSnap(
      { x: 0.65, y: 0.5 },
      { ...small, previousMidpoint: 'left', priority: 'midpoints-first' },
    ).midpoint,
  ).toBe('right');
});

test('priority settings inherit, override, validate and change only while idle without document history', () => {
  expect(
    Zloz.resolvePortAnchorSnapSettings({ priority: 'midpoints-first' }, { priority: undefined })
      .priority,
  ).toBe('midpoints-first');
  expect(
    Zloz.resolvePortAnchorSnapSettings(
      { priority: 'midpoints-first' },
      { priority: 'corners-first' },
    ).priority,
  ).toBe('corners-first');
  const state = initial();
  const enabled = Zloz.updateEditor(state, {
    type: 'PortAnchorSnapPriorityChanged',
    priority: 'midpoints-first',
  });
  expect(enabled.portAnchorSnapPriority).toBe('midpoints-first');
  expect(enabled.graph).toBe(state.graph);
  expect(enabled.past).toBe(state.past);
  const begun = Zloz.updateEditor(enabled, start);
  expect(
    Zloz.updateEditor(begun, { type: 'PortAnchorSnapPriorityChanged', priority: 'corners-first' }),
  ).toBe(begun);
  for (const priority of ['invalid', null, 0]) {
    const invalid = { priority };
    const invalidOptions = { portAnchorSnapPriority: priority };
    const invalidEvent = { type: 'PortAnchorSnapPriorityChanged' as const, priority };
    // @ts-expect-error Deliberately malformed JavaScript input exercises runtime validation.
    const bad: Zloz.PortAnchorSnapOverrides = invalid;
    // @ts-expect-error Deliberately malformed initial preferences must fail before state creation.
    const badOptions: Zloz.EditorOptions = invalidOptions;
    // @ts-expect-error Malformed preference facts are ignored by the reducer.
    const badEvent: EditorEvent = invalidEvent;
    expect(() => Zloz.resolvePortAnchorSnapSettings(bad)).toThrow(Zloz.ZlozError);
    expect(() => Zloz.resolvePortAnchorSnap(point, { ...options, ...bad })).toThrow(Zloz.ZlozError);
    expect(() => Zloz.createEditor(graph, badOptions)).toThrow(Zloz.ZlozError);
    expect(() => Zloz.portAnchorSnapGuideTargets(bad)).toThrow(Zloz.ZlozError);
    expect(Zloz.updateEditor(state, badEvent)).toBe(state);
  }
});

test('global and per-port priorities are captured through bypass, policy changes, cancellation and one Undo', () => {
  const state = initial('midpoints-first');
  const inherited = Zloz.updateEditor(Zloz.updateEditor(state, start), moved);
  expect(inherited.gesture).toMatchObject({
    snappedMidpoint: 'left',
    snapSettings: { priority: 'midpoints-first' },
  });
  const cornerPolicy: EditorPolicy = { portAnchorSnap: () => ({ priority: 'corners-first' }) };
  const corner = Zloz.updateEditor(
    Zloz.updateEditor(state, start, cornerPolicy),
    moved,
    cornerPolicy,
  );
  expect(corner.gesture).toMatchObject({ snappedCorner: 'top-left' });
  const profile: MutablePriorityProfile = { priority: 'midpoints-first' };
  const begun = Zloz.updateEditor(initial(), start, { portAnchorSnap: () => profile });
  profile.priority = 'corners-first';
  const preview = Zloz.updateEditor(begun, moved, cornerPolicy);
  expect(preview.gesture).toMatchObject({ snappedMidpoint: 'left' });
  const free = Zloz.updateEditor(preview, bypass(true), cornerPolicy);
  expect(free.graph.nodes[0]?.ports[0]?.anchor?.x).toBeCloseTo(point.x, 12);
  expect(Zloz.updateEditor(free, bypass(false), cornerPolicy).gesture).toMatchObject({
    snappedMidpoint: 'left',
  });
  const saved = Zloz.updateEditor(preview, release, cornerPolicy);
  expect(saved.past).toHaveLength(1);
  const undone = Zloz.updateEditor(saved, { type: 'UndoPressed' });
  expect(undone.graph).toEqual(state.graph);
  expect(Zloz.updateEditor(undone, { type: 'RedoPressed' }).graph).toEqual(saved.graph);
  expect(Zloz.updateEditor(preview, { type: 'GestureCancelled' }).graph).toEqual(state.graph);
  expect(Zloz.updateEditor(preview, release, { canEditPort: () => 'Managed' }).graph).toEqual(
    state.graph,
  );
  expect(Zloz.updateEditor(saved, start, cornerPolicy).gesture).toMatchObject({
    snapSettings: { priority: 'corners-first' },
  });
  expect(Zloz.updateEditor(Zloz.updateEditor(state, start), release).past).toHaveLength(0);
});

test('guides retain permitted targets and highlight the winner with captured priority feedback', async () => {
  for (const priority of ['corners-first', 'midpoints-first'] as const) {
    const policy: EditorPolicy = {
      portAnchorSnap: () => ({ allowedCorners: ['top-left'], allowedMidpoints: ['left'] }),
    };
    const state = { ...initial(priority), selectedNodes: ['n'] };
    const preview = Zloz.updateEditor(Zloz.updateEditor(state, start, policy), moved, policy);
    const result = await Effect.runPromise(
      renderToString(
        {
          Flags: Schema.Struct({}),
          init: () => ({ model: preview }),
          view: (model, h: HtmlBuilder<EditorEvent>) => ({
            title: 'Priority',
            body: zlozView(h, model, {
              id: 'priority',
              label: 'Priority',
              onEvent: (event) => event,
              portAnchorGuides: true,
              renderPortAnchorGuide: (context) => {
                expect(context.settings.priority).toBe(priority);
                return undefined;
              },
            }),
          }),
        },
        { flags: {}, isHydratable: false },
      ),
    );
    const window = new Window();
    window.document.body.innerHTML = result.html;
    expect(window.document.querySelectorAll('[data-flow-anchor-guide]')).toHaveLength(2);
    const active = window.document.querySelector('[data-flow-anchor-guide-active="true"]');
    expect(active?.getAttribute('data-flow-anchor-guide')).toBe(
      priority === 'corners-first' ? 'corner' : 'midpoint',
    );
  }
});
