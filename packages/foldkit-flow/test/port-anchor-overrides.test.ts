import { expect, test } from 'bun:test';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
import { Window } from 'happy-dom';

import { flowPortAnchorHandle, flowView } from '../src/foldkit';
import * as Flow from '../src/index';
import type { EditorEvent, EditorPolicy, FlowGraph, PortAnchorSnapOverrides } from '../src/index';

const { createEditor, updateEditor } = Flow;
const graph: FlowGraph = {
  nodes: ['n', 'other'].map((id) => ({
    id,
    label: id,
    position: { x: id === 'n' ? 0 : 300, y: 0 },
    size: { width: 200, height: 100 },
    ports: [
      { id: 'in', kind: 'input', side: 'right', anchor: { x: 0.5, y: 0.5 } },
      { id: 'out', kind: 'output', side: 'right', anchor: { x: 0.5, y: 0.5 } },
    ],
  })),
  edges: [
    { id: 'wire', source: { node: 'n', port: 'out' }, target: { node: 'other', port: 'in' } },
  ],
};
const defaults = { distance: 12, cornerDistance: 12, midpointDistance: 12, hysteresis: 4 };
const initial = () =>
  createEditor(graph, {
    portAnchorSnapDistance: 12,
    portAnchorCornerSnapDistance: 12,
    portAnchorMidpointSnapDistance: 12,
    portAnchorSnapHysteresis: 4,
  });
const policy: EditorPolicy = {
  portAnchorSnap: ({ node, port }, current) => {
    expect(current).toEqual(graph);
    if (node.id !== 'n') return undefined;
    return port.id === 'in'
      ? { distance: 0, cornerDistance: 0, midpointDistance: 18, hysteresis: 6 }
      : { distance: 0, cornerDistance: 0, midpointDistance: 0 };
  },
};
const start = (
  port = 'in',
  node = 'n',
): Extract<EditorEvent, { type: 'PortAnchorDragStarted' }> => ({
  type: 'PortAnchorDragStarted',
  endpoint: { node, port },
  pointer: 1,
  point: { x: 0, y: 0 },
  snapBypassModifier: 'Alt',
});
const move = (x: number, y: number): EditorEvent => ({
  type: 'PointerMoved',
  pointer: 1,
  point: { x: x - 100, y: y - 50 },
});
const release: EditorEvent = { type: 'PointerReleased', pointer: 1 };
const bypass = (bypassed: boolean): EditorEvent => ({
  type: 'PortAnchorSnapBypassChanged',
  pointer: 1,
  bypassed,
});

test('ports on the same node use separate rules while other nodes inherit editor settings', () => {
  const state = initial();
  const midpoint = updateEditor(updateEditor(state, start(), policy), move(15, 50));
  expect(midpoint.graph.nodes[0]?.ports[0]?.anchor).toEqual({ x: 0, y: 0.5 });
  expect(midpoint.gesture).toMatchObject({ snappedMidpoint: 'left', snappedSide: null });
  const noCorner = updateEditor(updateEditor(state, start(), policy), move(6, 8));
  expect(noCorner.graph.nodes[0]?.ports[0]?.anchor?.x).toBeCloseTo(0.03, 12);
  expect(noCorner.gesture).toMatchObject({ snappedCorner: null, snappedSide: null });
  const free = updateEditor(updateEditor(state, start('out'), policy), move(6, 8));
  expect(free.graph.nodes[0]?.ports[1]?.anchor?.x).toBeCloseTo(0.03, 12);
  expect(free.graph.nodes[0]?.ports[1]?.anchor?.y).toBeCloseTo(0.08, 12);
  expect(free.gesture).toMatchObject({
    snappedCorner: null,
    snappedMidpoint: null,
    snappedSide: null,
  });
  const inherited = updateEditor(updateEditor(state, start('in', 'other'), policy), move(6, 8));
  expect(inherited.graph.nodes[1]?.ports[0]?.anchor).toEqual({ x: 0, y: 0 });
  expect(inherited.gesture).toMatchObject({ snappedCorner: 'top-left', snapSettings: defaults });
  expect(state.portAnchorSnapDistance).toBe(12);
  expect(state.past).toHaveLength(0);
});

test('resolved overrides are detached and captured once for the drag, including modifier-only changes', () => {
  const override = { distance: 0, cornerDistance: 0, midpointDistance: 18, hysteresis: 6 };
  const state = initial();
  const begun = updateEditor(state, start(), { portAnchorSnap: () => override });
  expect(begun.gesture).toMatchObject({ snapSettings: override });
  override.midpointDistance = 0;
  const replacement: EditorPolicy = { portAnchorSnap: () => ({ midpointDistance: 0 }) };
  const snapped = updateEditor(begun, move(15, 50), replacement);
  expect(snapped.gesture).toMatchObject({ snappedMidpoint: 'left' });
  const retained = updateEditor(snapped, move(23, 50), replacement);
  expect(retained.gesture).toMatchObject({ snappedMidpoint: 'left' });
  const free = updateEditor(retained, bypass(true), replacement);
  expect(free.graph.nodes[0]?.ports[0]?.anchor?.x).toBeCloseTo(0.115, 12);
  expect(free.gesture).toMatchObject({ snapBypassed: true, snappedMidpoint: null });
  const resumed = updateEditor(free, bypass(false), replacement);
  expect(resumed.gesture).toMatchObject({ snappedMidpoint: null });
  const reacquired = updateEditor(resumed, move(15, 50), replacement);
  expect(reacquired.gesture).toMatchObject({ snappedMidpoint: 'left' });
  const saved = updateEditor(reacquired, release, replacement);
  const next = updateEditor(saved, start(), replacement);
  expect(next.gesture).toMatchObject({ snapSettings: { ...defaults, midpointDistance: 0 } });
});

test('overridden snapping shares policy rechecks, rollback, wiring and one Undo/Redo transaction', () => {
  const state = initial();
  const preview = updateEditor(updateEditor(state, start(), policy), move(15, 50));
  const saved = updateEditor(preview, release);
  expect(saved.past).toHaveLength(1);
  expect(saved.graph.edges).toEqual(state.graph.edges);
  expect(saved.graph.nodes[0]?.ports[0]?.side).toBe('right');
  const undone = updateEditor(saved, { type: 'UndoPressed' });
  expect(undone.graph).toEqual(state.graph);
  expect(updateEditor(undone, { type: 'RedoPressed' }).graph).toEqual(saved.graph);
  expect(updateEditor(preview, { type: 'GestureCancelled' }).graph).toEqual(state.graph);
  const denied = { canEditPort: () => 'Managed' };
  expect(updateEditor(preview, release, denied).graph).toEqual(state.graph);
  expect(updateEditor(preview, move(6, 8), denied).graph).toEqual(state.graph);
  expect(updateEditor({ ...preview, readOnly: true }, bypass(true)).graph).toEqual(state.graph);
  const protectedStart = updateEditor(state, start(), {
    ...denied,
    portAnchorSnap: () => {
      throw new Flow.FlowError('invalid-edit', 'must not run');
    },
  });
  expect(protectedStart.gesture.type).toBe('idle');
  expect(protectedStart.notice).toBe('Managed');
  const precise = updateEditor(preview, bypass(true));
  expect(updateEditor(precise, release).past).toHaveLength(1);
  expect(updateEditor(updateEditor(precise, release), { type: 'UndoPressed' }).graph).toEqual(
    state.graph,
  );
  const still = updateEditor(updateEditor(state, start(), policy), {
    type: 'PointerMoved',
    pointer: 1,
    point: { x: 0, y: 0 },
  });
  expect(updateEditor(still, release).past).toHaveLength(0);
  const nudged = updateEditor(
    state,
    { type: 'PortAnchorNudged', endpoint: { node: 'n', port: 'in' }, delta: { x: 0.01, y: 0 } },
    policy,
  );
  expect(nudged.graph.nodes[0]?.ports[0]?.anchor).toEqual({ x: 0.51, y: 0.5 });
  expect(Flow.serializeGraph(saved.graph)).not.toContain('snapSettings');
});

test('public settings resolution inherits absent fields, honors zero and validates every field before a drag', () => {
  expect(Flow.resolvePortAnchorSnapSettings(defaults)).toEqual(defaults);
  expect(
    Flow.resolvePortAnchorSnapSettings(defaults, { distance: 0, cornerDistance: undefined }),
  ).toEqual({ ...defaults, distance: 0 });
  expect(Flow.resolvePortAnchorSnapSettings({}, { midpointDistance: 18 })).toEqual({
    distance: 0,
    cornerDistance: 0,
    midpointDistance: 18,
    hysteresis: 0,
  });
  for (const field of ['distance', 'cornerDistance', 'midpointDistance', 'hysteresis'] as const) {
    for (const value of [-1, NaN, Infinity]) {
      const override: PortAnchorSnapOverrides = { [field]: value };
      expect(() => Flow.resolvePortAnchorSnapSettings(defaults, override)).toThrow(Flow.FlowError);
      const state = initial();
      expect(() => updateEditor(state, start(), { portAnchorSnap: () => override })).toThrow(
        Flow.FlowError,
      );
      expect(state.gesture.type).toBe('idle');
      expect(state.past).toHaveLength(0);
      expect(state.graph).toEqual(graph);
    }
  }
});

test('composable handle feedback exposes captured settings without re-evaluating the host callback', async () => {
  const initialState = { ...initial(), selectedNodes: ['n'] };
  const preview = updateEditor(updateEditor(initialState, start(), policy), move(15, 50));
  const result = await Effect.runPromise(
    renderToString(
      {
        Flags: Schema.Struct({}),
        init: () => ({ model: preview }),
        view: (model, h: HtmlBuilder<EditorEvent>) => ({
          title: 'Overrides',
          body: flowView(h, model, {
            id: 'overrides',
            label: 'Overrides',
            onEvent: (event) => event,
            portAnchorHandles: true,
            renderPortAnchorHandle: (context, builder) => {
              if (!context.active) {
                expect(context.snapSettings).toBeUndefined();
                return undefined;
              }
              expect(context.snapSettings).toEqual({
                distance: 0,
                cornerDistance: 0,
                midpointDistance: 18,
                hysteresis: 6,
              });
              if (model.gesture.type === 'port-anchor-drag')
                expect(context.snapSettings).not.toBe(model.gesture.snapSettings);
              return flowPortAnchorHandle(
                builder,
                context,
                [builder.Class('custom-profile')],
                [`Midpoint radius ${context.snapSettings?.midpointDistance}`],
              );
            },
          }),
        }),
      },
      { flags: {}, isHydratable: false },
    ),
  );
  const window = new Window();
  window.document.body.innerHTML = result.html;
  const handle = window.document.querySelector('.custom-profile');
  expect(handle?.getAttribute('data-flow-anchor-midpoint')).toBe('left');
  expect(handle?.textContent).toBe('Midpoint radius 18');
  expect(handle?.getAttribute('title')).toContain('Snapped to left midpoint');
});
