import { expect, test } from 'bun:test';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
import { Window } from 'happy-dom';

import { zlozView, zlozNodeFrame, zlozDragHandle, zlozPort } from '../src/foldkit';
import {
  createEditor,
  updateEditor,
  portAnchor,
  portPosition,
  portBoundaryPosition,
  edgePath,
  parseGraph,
  serializeGraph,
  layoutRequest,
  applyLayout,
  type ZlozGraph,
} from '../src/index';
import type { EditorEvent } from '../src/types';

const graph: ZlozGraph = {
  nodes: [
    {
      id: 'a',
      label: 'A',
      position: { x: 10, y: 20 },
      size: { width: 200, height: 100 },
      ports: [
        { id: 'out', kind: 'output', side: 'right', anchor: { x: 0.8, y: 0.2 }, label: 'Output' },
      ],
    },
    {
      id: 'b',
      label: 'B',
      position: { x: 400, y: 100 },
      size: { width: 160, height: 120 },
      ports: [{ id: 'in', kind: 'input', side: 'left', anchor: { x: 0.2, y: 0.8 } }],
    },
  ],
  edges: [{ id: 'ab', source: { node: 'a', port: 'out' }, target: { node: 'b', port: 'in' } }],
};

test('custom anchors share normalized, world and routing-boundary geometry and survive serialization', () => {
  const a = graph.nodes[0],
    edge = graph.edges[0],
    port = a?.ports[0];
  expect(a).toBeDefined();
  expect(edge).toBeDefined();
  expect(port).toBeDefined();
  if (!a || !edge || !port) return;
  expect(portAnchor(port)).toEqual({ x: 0.8, y: 0.2 });
  expect(portPosition(a, 'out')).toEqual({ x: 170, y: 40 });
  expect(portBoundaryPosition(a, 'out')).toEqual({ x: 210, y: 40 });
  expect(edgePath(graph, edge)).toBe('M170,40 L432,196');
  expect(parseGraph(serializeGraph(graph))).toEqual(graph);
  expect(portPosition({ ...a, size: { width: 300, height: 160 } }, 'out')).toEqual({
    x: 250,
    y: 52,
  });
});

test('port position edits are atomic, undoable, invalidate stale layouts and preserve identity/labels', () => {
  const initial = createEditor(graph),
    request = layoutRequest(initial, 'pending');
  const edited = updateEditor(initial, {
    type: 'PortPositionsChanged',
    positions: [
      {
        endpoint: { node: 'a', port: 'out' },
        position: { side: 'top', anchor: { x: 0.3, y: 0.4 } },
      },
      { endpoint: { node: 'b', port: 'in' }, position: { side: 'left', offset: 0.5 } },
    ],
  });
  expect(edited.past).toHaveLength(1);
  expect(edited.graph.nodes[0]?.ports[0]).toEqual({
    id: 'out',
    kind: 'output',
    label: 'Output',
    side: 'top',
    anchor: { x: 0.3, y: 0.4 },
  });
  expect(edited.graph.edges).toEqual(graph.edges);
  expect(updateEditor(edited, { type: 'UndoPressed' }).graph).toEqual(graph);
  expect(
    applyLayout(edited, request, {
      requestId: request.requestId,
      revision: request.revision,
      positions: [],
      routes: [],
    }),
  ).toBe(edited);
  expect(
    updateEditor(
      { ...initial, readOnly: true },
      {
        type: 'PortPositionsChanged',
        positions: [
          { endpoint: { node: 'a', port: 'out' }, position: { side: 'left', offset: 0.5 } },
        ],
      },
    ),
  ).toEqual({ ...initial, readOnly: true });
});

test('anchor validation rejects ambiguous, out-of-range and non-finite documents without altering legacy ports', () => {
  const document = JSON.parse(serializeGraph(graph));
  for (const port of [
    { id: 'out', kind: 'output', side: 'right', anchor: { x: NaN, y: 0.5 } },
    { id: 'out', kind: 'output', side: 'right', anchor: { x: 1.1, y: 0.5 } },
    { id: 'out', kind: 'output', side: 'right', anchor: { x: 0.5, y: 0.5 }, offset: 0.5 },
  ]) {
    document.graph.nodes[0].ports = [port];
    expect(() => parseGraph(JSON.stringify(document))).toThrow();
  }
  const legacy = {
    ...graph,
    nodes: graph.nodes.map((node) => ({
      ...node,
      ports: node.ports.map((port) => ({
        id: port.id,
        kind: port.kind,
        side: port.side,
        offset: 0.5,
      })),
    })),
  };
  expect(parseGraph(serializeGraph(legacy))).toEqual(legacy);
});

test('batch position edits reject malformed, duplicate and unknown entries atomically, and detach caller coordinates', () => {
  const initial = createEditor(graph);
  const anchor = { x: 0.3, y: 0.4 };
  const edited = updateEditor(initial, {
    type: 'PortPositionsChanged',
    positions: [{ endpoint: { node: 'a', port: 'out' }, position: { side: 'right', anchor } }],
  });
  anchor.x = 0.9;
  expect(edited.graph.nodes[0]?.ports[0]?.anchor).toEqual({ x: 0.3, y: 0.4 });
  const positions = JSON.parse(
    '[{"endpoint":{"node":"a","port":"out"},"position":{"side":"right","anchor":{"x":0.8,"y":0.2},"offset":0.5}},{"endpoint":{"node":"b","port":"in"},"position":{"side":"left","offset":0.5}}]',
  );
  expect(() => updateEditor(initial, { type: 'PortPositionsChanged', positions })).toThrow();
  expect(() =>
    updateEditor(initial, {
      type: 'PortPositionsChanged',
      positions: [
        { endpoint: { node: 'missing', port: 'out' }, position: { side: 'right', offset: 0.5 } },
      ],
    }),
  ).toThrow();
  expect(() =>
    updateEditor(initial, {
      type: 'PortPositionsChanged',
      positions: [
        { endpoint: { node: 'a', port: 'out' }, position: { side: 'right', offset: 0.5 } },
        { endpoint: { node: 'a', port: 'out' }, position: { side: 'left', offset: 0.5 } },
      ],
    }),
  ).toThrow();
  expect(initial.graph).toEqual(graph);
  expect(initial.past).toHaveLength(0);
  const dragging = updateEditor(initial, {
    type: 'ConnectionDragStarted',
    endpoint: { node: 'a', port: 'out' },
    point: { x: 170, y: 40 },
    pointer: 7,
  });
  expect(
    updateEditor(dragging, {
      type: 'PortPositionsChanged',
      positions: [
        { endpoint: { node: 'a', port: 'out' }, position: { side: 'left', offset: 0.5 } },
      ],
    }),
  ).toBe(dragging);
  expect(updateEditor(initial, { type: 'PortPositionsChanged', positions: [] })).toBe(initial);
  expect(
    updateEditor(initial, {
      type: 'PortPositionsChanged',
      positions: [
        {
          endpoint: { node: 'a', port: 'out' },
          position: { side: 'right', anchor: { x: 0.8, y: 0.2 } },
        },
      ],
    }),
  ).toBe(initial);
});

test('public frames isolate port coordinates from visual borders and padding', async () => {
  const result = await Effect.runPromise(
    renderToString(
      {
        Flags: Schema.Struct({}),
        init: () => ({ model: createEditor(graph) }),
        view: (model, h: HtmlBuilder<EditorEvent>) => ({
          title: 'Anchors',
          body: zlozView(h, model, {
            id: 'anchors',
            label: 'Anchors',
            onEvent: (event) => event,
            renderNodeShell: (context, builder) =>
              zlozNodeFrame(
                builder,
                context,
                [
                  builder.Class('thick-shell'),
                  builder.Style({
                    border: '16px solid red',
                    padding: '12px',
                    height: `${context.node.size.height}px`,
                  }),
                ],
                [
                  zlozDragHandle(builder, context, [], [context.node.label]),
                  ...context.node.ports.map((port) => zlozPort(builder, context, port, [], ['●'])),
                ],
              ),
          }),
        }),
      },
      { flags: {}, isHydratable: false },
    ),
  );
  const window = new Window();
  window.document.body.innerHTML = result.html;
  const frame = window.document.querySelector('[data-flow-node="a"]');
  expect(frame?.getAttribute('style')).toContain('border: 0');
  expect(frame?.querySelector('.thick-shell')?.getAttribute('style')).toContain('position: static');
  expect(frame?.querySelector('.thick-shell')?.getAttribute('style')).toContain(
    'border: 16px solid red',
  );
  const port = frame?.querySelector('[data-flow-port="out"]');
  expect(port?.getAttribute('style')).toContain('left: 80%');
  expect(port?.getAttribute('style')).toContain('top: 20%');
});

test('routing hints do not change custom anchor coordinates', () => {
  const node = graph.nodes[0];
  expect(node).toBeDefined();
  if (!node) return;
  const boundaries = {
    left: { x: 10, y: 40 },
    right: { x: 210, y: 40 },
    top: { x: 170, y: 20 },
    bottom: { x: 170, y: 120 },
  };
  for (const side of ['left', 'right', 'top', 'bottom'] as const) {
    const positioned = {
      ...node,
      ports: [{ id: 'out', kind: 'output' as const, side, anchor: { x: 0.8, y: 0.2 } }],
    };
    expect(portPosition(positioned, 'out')).toEqual({ x: 170, y: 40 });
    expect(portBoundaryPosition(positioned, 'out')).toEqual(boundaries[side]);
  }
});
