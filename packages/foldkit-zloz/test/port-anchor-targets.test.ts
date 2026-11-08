import { expect, test } from 'bun:test';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
import { Window } from 'happy-dom';

import { zlozPortAnchorHandle, zlozView } from '../src/foldkit';
import {
  createEditor,
  resolvePortAnchorSnap,
  resolvePortAnchorSnapSettings,
  updateEditor,
  ZlozError,
  type EditorEvent,
  type EditorPolicy,
  type ZlozGraph,
  type PortSide,
} from '../src/index';

const options = {
  size: { width: 200, height: 100 },
  zoom: 1,
  distance: 12,
  cornerDistance: 12,
  midpointDistance: 12,
};
const graph: ZlozGraph = {
  nodes: [
    {
      id: 'n',
      label: 'N',
      position: { x: 0, y: 0 },
      size: options.size,
      ports: [{ id: 'p', kind: 'input', side: 'bottom', anchor: { x: 0.5, y: 0.5 } }],
    },
  ],
  edges: [],
};
const start: EditorEvent = {
  type: 'PortAnchorDragStarted',
  endpoint: { node: 'n', port: 'p' },
  pointer: 1,
  point: { x: 0, y: 0 },
};
const release: EditorEvent = { type: 'PointerReleased', pointer: 1 };
const move = (x: number, y: number): EditorEvent => ({
  type: 'PointerMoved',
  pointer: 1,
  point: { x: x - 100, y: y - 50 },
});
const bypass = (bypassed: boolean): EditorEvent => ({
  type: 'PortAnchorSnapBypassChanged',
  pointer: 1,
  bypassed,
});

test('allowed targets filter each snap kind before choosing the nearest candidate', () => {
  expect(
    resolvePortAnchorSnap({ x: 0.03, y: 0.08 }, { ...options, allowedCorners: ['bottom-right'] })
      .side,
  ).toBe('left');
  expect(
    resolvePortAnchorSnap({ x: 0.03, y: 0.58 }, { ...options, allowedMidpoints: ['right'] }).side,
  ).toBe('left');
  expect(
    resolvePortAnchorSnap({ x: 0.97, y: 0.2 }, { ...options, allowedEdges: ['left'] }).side,
  ).toBeNull();
  expect(
    resolvePortAnchorSnap({ x: 0.03, y: 0.2 }, { ...options, allowedEdges: ['left'] }).side,
  ).toBe('left');
  expect(
    resolvePortAnchorSnap(
      { x: 0.97, y: 0.5 },
      { ...options, midpointDistance: 200, allowedMidpoints: ['left'] },
    ).midpoint,
  ).toBe('left');
  expect(
    resolvePortAnchorSnap(
      { x: 0.97, y: 0.08 },
      { ...options, cornerDistance: 300, allowedCorners: ['top-left'] },
    ).corner,
  ).toBe('top-left');
  const point = { x: 0.03, y: 0.08 };
  expect(
    resolvePortAnchorSnap(point, {
      ...options,
      allowedEdges: [],
      allowedCorners: [],
      allowedMidpoints: [],
    }),
  ).toEqual({ anchor: point, side: null });
  expect(resolvePortAnchorSnap(point, options).corner).toBe('top-left');
});

test('forbidden previous targets cannot retain, and filtering preserves zoom, ties and priority', () => {
  expect(
    resolvePortAnchorSnap(
      { x: 0.075, y: 0.2 },
      { ...options, hysteresis: 4, previousSide: 'left', allowedEdges: [] },
    ).side,
  ).toBeNull();
  expect(
    resolvePortAnchorSnap(
      { x: 0.075, y: 0 },
      {
        ...options,
        hysteresis: 4,
        previousCorner: 'top-left',
        allowedCorners: [],
        allowedEdges: [],
      },
    ).corner,
  ).toBeUndefined();
  expect(
    resolvePortAnchorSnap(
      { x: 0.075, y: 0.5 },
      {
        ...options,
        hysteresis: 4,
        previousMidpoint: 'left',
        allowedMidpoints: [],
        allowedEdges: [],
      },
    ).midpoint,
  ).toBeUndefined();
  const restricted = {
    ...options,
    distance: 0,
    cornerDistance: 0,
    allowedMidpoints: ['left', 'right'] as const,
  };
  expect(resolvePortAnchorSnap({ x: 0.5, y: 0.06 }, restricted).midpoint).toBeUndefined();
  expect(resolvePortAnchorSnap({ x: 0.015, y: 0.54 }, { ...restricted, zoom: 2 }).midpoint).toBe(
    'left',
  );
  expect(
    resolvePortAnchorSnap({ x: 0.03, y: 0.58 }, { ...restricted, zoom: 2 }).midpoint,
  ).toBeUndefined();
  const tie = {
    ...restricted,
    size: { width: 20, height: 100 },
    allowedMidpoints: ['right', 'left'] as const,
  };
  expect(resolvePortAnchorSnap({ x: 0.5, y: 0.5 }, tie).midpoint).toBe('left');
  expect(
    resolvePortAnchorSnap({ x: 0.5, y: 0.5 }, { ...tie, preferredSide: 'right' }).midpoint,
  ).toBe('right');
  expect(
    resolvePortAnchorSnap(
      { x: 0.1, y: 0.1 },
      {
        ...options,
        size: { width: 20, height: 20 },
        allowedCorners: ['top-left'],
        allowedMidpoints: ['left'],
      },
    ).corner,
  ).toBe('top-left');
});

test('settings inherit lists, normalize duplicates without changing tie order, and detach caller arrays', () => {
  const mids: PortSide[] = ['right', 'left', 'right'];
  const defaults = {
    allowedEdges: ['top'] as const,
    allowedCorners: ['top-left'] as const,
    allowedMidpoints: mids,
  };
  const resolved = resolvePortAnchorSnapSettings(defaults, {
    allowedEdges: [],
    allowedCorners: undefined,
  });
  expect(resolved).toEqual({
    distance: 0,
    cornerDistance: 0,
    midpointDistance: 0,
    hysteresis: 0,
    allowedEdges: [],
    allowedCorners: ['top-left'],
    allowedMidpoints: ['left', 'right'],
  });
  expect(resolved.allowedMidpoints).not.toBe(mids);
  mids.splice(0, mids.length, 'bottom');
  expect(resolved.allowedMidpoints).toEqual(['left', 'right']);
  expect(resolvePortAnchorSnapSettings({}, { allowedEdges: undefined })).toEqual({
    distance: 0,
    cornerDistance: 0,
    midpointDistance: 0,
    hysteresis: 0,
  });
});

test('invalid names and non-array lists fail in settings, direct geometry and drag start', () => {
  for (const field of ['allowedEdges', 'allowedCorners', 'allowedMidpoints'] as const) {
    for (const value of [['unknown'], 'left', { length: 1 }]) {
      const override = { [field]: value };
      expect(() => resolvePortAnchorSnapSettings({}, override)).toThrow(ZlozError);
      expect(() => resolvePortAnchorSnap({ x: 0, y: 0 }, { ...options, ...override })).toThrow(
        ZlozError,
      );
      const initial = createEditor(graph);
      expect(() => updateEditor(initial, start, { portAnchorSnap: () => override })).toThrow(
        ZlozError,
      );
      expect(initial.gesture.type).toBe('idle');
      expect(initial.past).toHaveLength(0);
    }
  }
});

test('a captured per-port target list respects bypass, current protection, free placement and one Undo', () => {
  const mids: PortSide[] = ['left'];
  const policy: EditorPolicy = {
    portAnchorSnap: () => ({
      distance: 12,
      cornerDistance: 12,
      midpointDistance: 12,
      hysteresis: 4,
      allowedEdges: [],
      allowedCorners: [],
      allowedMidpoints: mids,
    }),
  };
  const initial = createEditor(graph);
  const begun = updateEditor(initial, start, policy);
  mids.splice(0, mids.length, 'right');
  const snapped = updateEditor(begun, move(7, 50), policy);
  expect(snapped.gesture).toMatchObject({
    snappedMidpoint: 'left',
    snapSettings: { allowedMidpoints: ['left'] },
  });
  const forbidden = updateEditor(snapped, move(100, 7), policy);
  expect(forbidden.gesture).toMatchObject({ snappedMidpoint: null, snappedSide: null });
  expect(forbidden.graph.nodes[0]?.ports[0]?.anchor?.y).toBeCloseTo(0.07, 12);
  const retained = updateEditor(snapped, move(15, 50), policy);
  expect(retained.gesture).toMatchObject({ snappedMidpoint: 'left' });
  const free = updateEditor(retained, bypass(true), policy);
  expect(free.graph.nodes[0]?.ports[0]?.anchor?.x).toBeCloseTo(0.075, 12);
  expect(updateEditor(free, bypass(false), policy).gesture).toMatchObject({
    snappedMidpoint: null,
  });
  const clamped = updateEditor(free, move(-10, -10), policy);
  expect(clamped.graph.nodes[0]?.ports[0]?.anchor).toEqual({ x: 0, y: 0 });
  expect(updateEditor(clamped, release, policy).past).toHaveLength(1);
  const saved = updateEditor(snapped, release, policy);
  expect(saved.past).toHaveLength(1);
  expect(saved.graph.nodes[0]?.ports[0]?.side).toBe('bottom');
  const undone = updateEditor(saved, { type: 'UndoPressed' });
  expect(undone.graph).toEqual(initial.graph);
  expect(updateEditor(undone, { type: 'RedoPressed' }).graph).toEqual(saved.graph);
  expect(updateEditor(snapped, { type: 'GestureCancelled' }).graph).toEqual(initial.graph);
  expect(updateEditor(snapped, release, { canEditPort: () => 'Managed' }).graph).toEqual(
    initial.graph,
  );
  expect(updateEditor(saved, start, policy).gesture).toMatchObject({
    snapSettings: { allowedMidpoints: ['right'] },
  });
  const nudged = updateEditor(
    initial,
    { type: 'PortAnchorNudged', endpoint: { node: 'n', port: 'p' }, delta: { x: 0, y: 0.01 } },
    policy,
  );
  expect(nudged.graph.nodes[0]?.ports[0]?.anchor).toEqual({ x: 0.5, y: 0.51 });
});

test('custom feedback receives detached captured target arrays', async () => {
  const initial = { ...createEditor(graph), selectedNodes: ['n'] };
  const begun = updateEditor(initial, start, {
    portAnchorSnap: () => ({ midpointDistance: 12, allowedMidpoints: ['left', 'right'] }),
  });
  const preview = updateEditor(begun, move(7, 50));
  const result = await Effect.runPromise(
    renderToString(
      {
        Flags: Schema.Struct({}),
        init: () => ({ model: preview }),
        view: (model, h: HtmlBuilder<EditorEvent>) => ({
          title: 'Targets',
          body: zlozView(h, model, {
            id: 'targets',
            label: 'Targets',
            onEvent: (event) => event,
            portAnchorHandles: true,
            renderPortAnchorHandle: (context, builder) => {
              expect(context.snapSettings?.allowedMidpoints).toEqual(['left', 'right']);
              if (model.gesture.type === 'port-anchor-drag')
                expect(context.snapSettings?.allowedMidpoints).not.toBe(
                  model.gesture.snapSettings?.allowedMidpoints,
                );
              return zlozPortAnchorHandle(
                builder,
                context,
                [builder.Class('allowed-targets')],
                ['Left/right only'],
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
  expect(
    window.document.querySelector('.allowed-targets')?.getAttribute('data-flow-anchor-midpoint'),
  ).toBe('left');
  expect(window.document.querySelector('.allowed-targets')?.textContent).toBe('Left/right only');
});
