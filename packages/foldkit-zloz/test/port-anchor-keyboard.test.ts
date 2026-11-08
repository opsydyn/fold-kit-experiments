import { expect, test } from 'bun:test';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
import { Window } from 'happy-dom';

import { zlozView } from '../src/foldkit';
import * as Zloz from '../src/index';
import type { EditorEvent, EditorPolicy, PortAnchorTargetStep } from '../src/index';

const graph: Zloz.ZlozGraph = {
  nodes: [
    {
      id: 'n',
      label: 'N',
      position: { x: 0, y: 0 },
      size: { width: 200, height: 100 },
      ports: [{ id: 'p', kind: 'output', side: 'bottom', anchor: { x: 0.3, y: 0.4 } }],
    },
    {
      id: 'other',
      label: 'Other',
      position: { x: 300, y: 0 },
      size: { width: 100, height: 100 },
      ports: [{ id: 'in', kind: 'input', side: 'left', offset: 0.5 }],
    },
  ],
  edges: [{ id: 'wire', source: { node: 'n', port: 'p' }, target: { node: 'other', port: 'in' } }],
};
const settings = {
  cornerDistance: 12,
  midpointDistance: 12,
  priority: 'midpoints-first' as const,
  allowedCorners: ['top-left'] as const,
  allowedMidpoints: ['left', 'right'] as const,
};
const policy: EditorPolicy = { portAnchorSnap: () => settings };
const step = (value: PortAnchorTargetStep): EditorEvent => ({
  type: 'PortAnchorTargetStepped',
  endpoint: { node: 'n', port: 'p' },
  step: value,
});

test('pure keyboard selection follows permitted target priority, wraps and supports first/last from exact or free positions', () => {
  const free = { x: 0.3, y: 0.4 };
  expect(Zloz.resolvePortAnchorTargetStep(free, settings, 'next')).toEqual({
    type: 'target',
    target: { type: 'midpoint', side: 'left', point: { x: 0, y: 0.5 } },
    index: 0,
    count: 3,
  });
  expect(Zloz.resolvePortAnchorTargetStep(free, settings, 'previous')).toMatchObject({
    type: 'target',
    target: { type: 'corner', corner: 'top-left' },
    index: 2,
    count: 3,
  });
  expect(Zloz.resolvePortAnchorTargetStep({ x: 0, y: 0.5 }, settings, 'next')).toMatchObject({
    target: { side: 'right' },
    index: 1,
  });
  expect(Zloz.resolvePortAnchorTargetStep({ x: 0, y: 0 }, settings, 'next')).toMatchObject({
    target: { side: 'left' },
    index: 0,
  });
  expect(Zloz.resolvePortAnchorTargetStep({ x: 0, y: 0.5 }, settings, 'previous')).toMatchObject({
    target: { corner: 'top-left' },
    index: 2,
  });
  expect(Zloz.resolvePortAnchorTargetStep(free, settings, 'first')).toMatchObject({ index: 0 });
  expect(Zloz.resolvePortAnchorTargetStep(free, settings, 'last')).toMatchObject({ index: 2 });
  expect(
    Zloz.resolvePortAnchorTargetStep(free, { ...settings, priority: 'corners-first' }, 'first'),
  ).toMatchObject({ target: { corner: 'top-left' } });
});

test('edges are excluded, empty and singleton selections are explicit, and invalid steps fail', () => {
  expect(Zloz.resolvePortAnchorTargetStep({ x: 0.5, y: 0.5 }, { distance: 12 }, 'next')).toEqual({
    type: 'empty',
  });
  expect(
    Zloz.resolvePortAnchorTargetStep(
      { x: 0.5, y: 0.5 },
      { ...settings, allowedCorners: [], allowedMidpoints: [] },
      'first',
    ),
  ).toEqual({ type: 'empty' });
  const single = { midpointDistance: 12, allowedMidpoints: ['left'] as const };
  expect(Zloz.resolvePortAnchorTargetStep({ x: 0, y: 0.5 }, single, 'next')).toMatchObject({
    type: 'target',
    index: 0,
    count: 1,
  });
  const invalid = 'invalid';
  // @ts-expect-error Malformed JavaScript actions must fail at the pure boundary.
  const badStep: PortAnchorTargetStep = invalid;
  expect(() => Zloz.resolvePortAnchorTargetStep({ x: 0, y: 0 }, settings, badStep)).toThrow(
    Zloz.ZlozError,
  );
  expect(() => Zloz.resolvePortAnchorTargetStep({ x: Infinity, y: 0 }, settings, 'next')).toThrow(
    Zloz.ZlozError,
  );
});

test('each different keyboard target is one protected Undo transaction with named feedback and intact wiring', () => {
  const state = Zloz.createEditor(graph);
  const first = Zloz.updateEditor(state, step('next'), policy);
  expect(first.graph.nodes[0]?.ports[0]).toEqual({
    id: 'p',
    kind: 'output',
    side: 'bottom',
    anchor: { x: 0, y: 0.5 },
  });
  expect(first.graph.edges).toEqual(state.graph.edges);
  expect(first.past).toHaveLength(1);
  expect(first.notice).toBe('N: p positioned at left midpoint.');
  expect(first.gesture.type).toBe('idle');
  const second = Zloz.updateEditor(first, step('next'), policy);
  expect(second.graph.nodes[0]?.ports[0]?.anchor).toEqual({ x: 1, y: 0.5 });
  expect(second.past).toHaveLength(2);
  const undone = Zloz.updateEditor(second, { type: 'UndoPressed' });
  expect(undone.graph).toEqual(first.graph);
  expect(Zloz.updateEditor(undone, { type: 'RedoPressed' }).graph).toEqual(second.graph);
  expect(
    Zloz.updateEditor(first, step('previous'), policy).graph.nodes[0]?.ports[0]?.anchor,
  ).toEqual({ x: 0, y: 0 });
  expect(Zloz.serializeGraph(second.graph)).not.toContain('TargetStep');
});

test('empty, repeated and protected actions preserve history and current permission wins before rule resolution', () => {
  const state = Zloz.createEditor(graph);
  const empty = Zloz.updateEditor(state, step('next'));
  expect(empty.graph).toBe(state.graph);
  expect(empty.past).toBe(state.past);
  expect(empty.notice).toBe('No enabled corner or midpoint targets for N: p.');
  const first = Zloz.updateEditor(state, step('first'), policy);
  const repeated = Zloz.updateEditor(first, step('first'), policy);
  expect(repeated.graph).toBe(first.graph);
  expect(repeated.past).toBe(first.past);
  const denied = Zloz.updateEditor(state, step('next'), {
    canEditPort: () => 'Managed',
    portAnchorSnap: () => {
      throw new Zloz.ZlozError('invalid-edit', 'must not resolve');
    },
  });
  expect(denied.graph).toBe(state.graph);
  expect(denied.notice).toBe('Managed');
  expect(Zloz.updateEditor({ ...state, readOnly: true }, step('next'), policy).graph).toBe(
    state.graph,
  );
  const begun = Zloz.updateEditor(
    state,
    {
      type: 'PortAnchorDragStarted',
      endpoint: { node: 'n', port: 'p' },
      pointer: 1,
      point: { x: 0, y: 0 },
    },
    policy,
  );
  expect(Zloz.updateEditor(begun, step('next'), policy)).toBe(begun);
  const offsetGraph: Zloz.ZlozGraph = {
    nodes: [
      {
        id: 'n',
        label: 'N',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 100 },
        ports: [{ id: 'p', kind: 'input', side: 'left', offset: 0.5 }],
      },
    ],
    edges: [],
  };
  const offset = Zloz.createEditor(offsetGraph);
  const unchanged = Zloz.updateEditor(offset, step('next'), {
    portAnchorSnap: () => ({ midpointDistance: 12, allowedMidpoints: ['left'] }),
  });
  expect(unchanged.graph).toBe(offset.graph);
  expect(unchanged.past).toHaveLength(0);
});

test('atomic keyboard moves re-read current per-port rules while exact arrow nudges stay exact', () => {
  const state = Zloz.createEditor(graph, { portAnchorSnapPriority: 'corners-first' });
  const first = Zloz.updateEditor(state, step('first'), policy);
  const changedPolicy: EditorPolicy = {
    portAnchorSnap: () => ({ cornerDistance: 12, allowedCorners: ['bottom-right'] }),
  };
  const next = Zloz.updateEditor(first, step('next'), changedPolicy);
  expect(next.graph.nodes[0]?.ports[0]?.anchor).toEqual({ x: 1, y: 1 });
  const nudged = Zloz.updateEditor(
    first,
    { type: 'PortAnchorNudged', endpoint: { node: 'n', port: 'p' }, delta: { x: 0.01, y: 0 } },
    policy,
  );
  expect(nudged.graph.nodes[0]?.ports[0]?.anchor).toEqual({ x: 0.01, y: 0.5 });
  const denied = Zloz.updateEditor(next, step('previous'), {
    ...policy,
    canEditPort: () => 'Now locked',
  });
  expect(denied.graph).toBe(next.graph);
  expect(denied.notice).toBe('Now locked');
});

test('native and custom anchor handles receive opt-in keyboard help and shortcut metadata', async () => {
  for (const enabled of [false, true]) {
    const state = { ...Zloz.createEditor(graph), selectedNodes: ['n'] };
    const result = await Effect.runPromise(
      renderToString(
        {
          Flags: Schema.Struct({}),
          init: () => ({ model: state }),
          view: (model, h: HtmlBuilder<EditorEvent>) => ({
            title: 'Keyboard targets',
            body: zlozView(h, model, {
              id: 'keyboard',
              label: 'Keyboard',
              onEvent: (event) => event,
              portAnchorHandles: true,
              portAnchorKeyboardTargets: enabled,
              renderPortAnchorHandle: (context) => {
                expect(context.keyboardTargets).toBe(enabled);
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
    const surface = window.document.querySelector('[data-flow-surface]');
    const handle = window.document.querySelector('[data-flow-anchor-port]');
    expect(surface?.getAttribute('data-flow-anchor-keyboard-targets')).toBe(String(enabled));
    expect(handle?.getAttribute('aria-keyshortcuts')).toBe(
      enabled ? 'PageDown PageUp Home End' : null,
    );
    expect(handle?.getAttribute('title')?.includes('Page Down/Up')).toBe(enabled);
  }
});
