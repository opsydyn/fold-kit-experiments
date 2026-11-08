import { expect, test } from 'bun:test';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
import { Window } from 'happy-dom';

import { zlozView } from '../src/foldkit';
import { createEditor, updateEditor, type EditorEvent } from '../src/index';

const initial = () =>
  createEditor(
    {
      nodes: [
        {
          id: 'n',
          label: 'N',
          position: { x: 0, y: 0 },
          size: { width: 200, height: 100 },
          ports: [{ id: 'p', kind: 'input', side: 'left', offset: 0.5 }],
        },
      ],
      edges: [],
    },
    { portAnchorSnapDistance: 12, portAnchorSnapHysteresis: 4 },
  );
const endpoint = { node: 'n', port: 'p' };
const start: EditorEvent = {
  type: 'PortAnchorDragStarted',
  endpoint,
  pointer: 1,
  point: { x: 0, y: 0 },
};
const move: EditorEvent = { type: 'PointerMoved', pointer: 1, point: { x: 7, y: 0 } };
const bypass = (
  bypassed: boolean,
): Extract<EditorEvent, { type: 'PortAnchorSnapBypassChanged' }> => ({
  type: 'PortAnchorSnapBypassChanged',
  pointer: 1,
  bypassed,
});
const release: EditorEvent = { type: 'PointerReleased', pointer: 1 };

test('modifier changes recompute the raw point without pointer motion or preference edits', () => {
  const state = initial();
  const snapped = updateEditor(updateEditor(state, start), move);
  expect(snapped.gesture).toMatchObject({ snappedSide: 'left' });
  const free = updateEditor(snapped, bypass(true));
  expect(free.graph.nodes[0]?.ports[0]?.anchor).toEqual({ x: 0.035, y: 0.5 });
  expect(free.gesture).toMatchObject({ snapBypassed: true, snappedSide: null });
  expect(free.portAnchorSnapDistance).toBe(12);
  expect(free.portAnchorSnapHysteresis).toBe(4);
  expect(free.past).toHaveLength(0);
  const restored = updateEditor(free, bypass(false));
  expect(restored.graph).toEqual(state.graph);
  expect(restored.gesture).toMatchObject({ snapBypassed: false, snappedSide: 'left' });
  expect(updateEditor(free, { ...bypass(false), pointer: 2 })).toBe(free);
  const saved = updateEditor(free, release);
  expect(saved.past).toHaveLength(1);
  expect(updateEditor(saved, { type: 'UndoPressed' }).graph).toEqual(state.graph);
});

test('bypass discards retained edges and restores fresh acquisition, not the old hysteresis latch', () => {
  const state = initial();
  const snapped = updateEditor(updateEditor(state, start), move);
  const retained = updateEditor(snapped, { ...move, point: { x: 15, y: 0 } });
  expect(retained.gesture).toMatchObject({ snappedSide: 'left' });
  const free = updateEditor(retained, bypass(true));
  const resumed = updateEditor(free, bypass(false));
  expect(resumed.gesture).toMatchObject({ snappedSide: null, snapBypassed: false });
  expect(resumed.graph.nodes[0]?.ports[0]?.anchor?.x).toBe(0.075);
  const reacquired = updateEditor(resumed, move);
  expect(reacquired.gesture).toMatchObject({ snappedSide: 'left' });
  expect(updateEditor(reacquired, { type: 'GestureCancelled' }).graph).toEqual(state.graph);
});

test('held-at-start and pointer modifier facts retain no-motion, clamping, policy and rollback guards', () => {
  const state = initial();
  const begun = updateEditor(state, { ...start, snapBypassed: true });
  expect(updateEditor(begun, bypass(false)).graph).toEqual(state.graph);
  const raw = updateEditor(begun, { ...move, point: { x: 15, y: 0 } });
  expect(raw.graph.nodes[0]?.ports[0]?.anchor?.x).toBe(0.075);
  const restored = updateEditor(raw, { ...move, portAnchorSnapBypassed: false });
  expect(restored.gesture).toMatchObject({ snappedSide: 'left' });
  const clamped = updateEditor(restored, {
    ...move,
    point: { x: -100, y: 1000 },
    portAnchorSnapBypassed: true,
  });
  expect(clamped.graph.nodes[0]?.ports[0]?.anchor).toEqual({ x: 0, y: 1 });
  expect(updateEditor(raw, bypass(false), { canEditPort: () => 'Managed' }).graph).toEqual(
    state.graph,
  );
  expect(updateEditor({ ...raw, readOnly: true }, bypass(false)).graph).toEqual(state.graph);
  expect(updateEditor(raw, { type: 'GestureCancelled' }).graph).toEqual(state.graph);
  expect(updateEditor(state, bypass(true))).toBe(state);
});

test('bypass feedback is composable and keeps the configured mapping separate from snap preferences', async () => {
  const state = { ...initial(), selectedNodes: ['n'] };
  const point = { x: 7, y: 0 };
  const preview = updateEditor(updateEditor(state, { ...start, snapBypassModifier: 'Alt' }), {
    type: 'PointerMoved',
    pointer: 1,
    point,
  });
  point.x = 100;
  const free = updateEditor(preview, bypass(true));
  expect(free.graph.nodes[0]?.ports[0]?.anchor?.x).toBe(0.035);
  const result = await Effect.runPromise(
    renderToString(
      {
        Flags: Schema.Struct({}),
        init: () => ({ model: free }),
        view: (model, h: HtmlBuilder<EditorEvent>) => ({
          title: 'Bypass',
          body: zlozView(h, model, {
            id: 'bypass',
            label: 'Bypass',
            onEvent: (event) => event,
            portAnchorHandles: true,
            portAnchorSnapBypassModifier: 'Control',
            renderPortAnchorHandle: (context) => {
              expect(context.snapBypassed).toBe(true);
              expect(context.snapBypassModifier).toBe('Alt');
              expect(context.snappedSide).toBeNull();
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
  const handle = window.document.querySelector('[data-flow-anchor-port]');
  expect(
    window.document
      .querySelector('[data-flow-surface]')
      ?.getAttribute('data-flow-port-anchor-snap-bypass'),
  ).toBe('Control');
  expect(handle?.getAttribute('data-flow-anchor-bypassed')).toBe('true');
  expect(handle?.getAttribute('data-flow-anchor-snapped')).toBeNull();
  expect(handle?.getAttribute('title')).toContain('Release Alt to restore snapping');
  expect(handle?.getAttribute('style')).toContain('2px dashed');
});
