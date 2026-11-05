import { expect, test } from 'bun:test';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
import { Window } from 'happy-dom';

import { createEditor } from '../src/editor';
import { flowView } from '../src/foldkit';
import { edgeGeometry } from '../src/geometry';
import { resolveEdgeGeometry, type FlowEdgeGeometryPolicy } from '../src/index';
import type { EditorEvent } from '../src/types';
import type { FlowEdge } from '../src/types';

const edge: FlowEdge = {
  id: 'ab',
  source: { node: 'a', port: 'out' },
  target: { node: 'b', port: 'in' },
  label: 'Dependency',
};
const graph = createEditor({
  nodes: [
    {
      id: 'a',
      label: 'A',
      position: { x: 0, y: 0 },
      size: { width: 100, height: 80 },
      ports: [{ id: 'out', kind: 'output', side: 'right', offset: 0.5 }],
    },
    {
      id: 'b',
      label: 'B',
      position: { x: 300, y: 100 },
      size: { width: 100, height: 80 },
      ports: [{ id: 'in', kind: 'input', side: 'left', offset: 0.5 }],
    },
  ],
  edges: [edge],
}).graph;

test('geometry policy uses resolved endpoints and returns one shared path and label anchor', () => {
  const policy: FlowEdgeGeometryPolicy = ({ source, target, defaultGeometry }) => {
    expect(source).toEqual({ x: 100, y: 40 });
    expect(target).toEqual({ x: 300, y: 140 });
    expect(defaultGeometry.path).toBe(edgeGeometry(graph, edge).path);
    return {
      path: `M${source.x},${source.y} L200,-60 L${target.x},${target.y}`,
      labelPosition: { x: 200, y: -60 },
    };
  };
  expect(resolveEdgeGeometry(graph, edge, { policy })).toEqual({
    path: 'M100,40 L200,-60 L300,140',
    labelPosition: { x: 200, y: -60 },
  });
});

test('undefined preserves authored styles, layout routes and their label anchors', () => {
  const route = [
    { x: 100, y: 40 },
    { x: 100, y: -50 },
    { x: 300, y: -50 },
    { x: 300, y: 140 },
  ];
  for (const current of [edge, { ...edge, pathStyle: 'smooth' as const }]) {
    const expected = edgeGeometry(graph, current, route);
    expect(resolveEdgeGeometry(graph, current, { route, policy: () => undefined })).toEqual({
      path: expected.path,
      labelPosition: expected.center,
    });
  }
});

test('custom geometry receives collapsed-group boundary anchors and rejects invalid output', () => {
  const group = {
    id: 'g',
    kind: 'group' as const,
    label: 'Group',
    position: { x: -20, y: -20 },
    size: { width: 160, height: 120 },
    ports: [],
  };
  const result = resolveEdgeGeometry(graph, edge, {
    sourceGroup: group,
    policy: ({ source, target }) => ({
      path: `M${source.x},${source.y} L${target.x},${target.y}`,
      labelPosition: undefined,
    }),
  });
  expect(result.path).toStartWith('M140,');
  expect(result.labelPosition).toBeUndefined();
  for (const geometry of [
    { path: '', labelPosition: undefined },
    { path: 'M0,0', labelPosition: { x: NaN, y: 0 } },
  ]) {
    expect(() => resolveEdgeGeometry(graph, edge, { policy: () => geometry })).toThrow();
  }
});

async function renderPolicy(customDecoration: boolean, readOnly = false) {
  const state = { ...createEditor(graph, { readOnly }), selectedEdges: ['ab'] };
  const result = await Effect.runPromise(
    renderToString(
      {
        Flags: Schema.Struct({}),
        init: () => ({ model: state }),
        view: (model, h: HtmlBuilder<EditorEvent>) => ({
          title: 'Edge geometry',
          body: flowView(h, model, {
            id: 'geometry',
            label: 'Geometry',
            onEvent: (event) => event,
            edgeToolbar: true,
            edgeGeometry: () => ({
              path: 'M100,40 Q140,-60 300,140',
              labelPosition: { x: 170, y: 15 },
            }),
            edgeAppearance: () => ({ hitWidth: 26 }),
            renderEdge: (context, builder) => {
              if (!customDecoration) return undefined;
              return builder.path(
                [
                  builder.D(context.path),
                  builder.DataAttribute('custom-decoration', ''),
                  builder.Stroke('purple'),
                ],
                [],
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
  return window.document;
}

test('custom and built-in decoration share the resolved selection path and label/control anchor', async () => {
  for (const custom of [false, true]) {
    const document = await renderPolicy(custom);
    const hit = document.querySelector('[data-flow-edge="ab"]');
    expect(hit?.getAttribute('d')).toBe('M100,40 Q140,-60 300,140');
    expect(hit?.getAttribute('stroke-width')).toBe('26');
    const decoration = hit?.parentElement?.querySelector('g path');
    expect(decoration?.getAttribute('d')).toBe(hit?.getAttribute('d'));
    const label = document.querySelector(
      '[aria-label="Edit edge label Dependency for a:out → b:in"]',
    )?.parentElement;
    expect(label?.getAttribute('style')).toContain('left: 170px');
    expect(label?.getAttribute('style')).toContain('top: 15px');
    const toolbar = document.querySelector('[aria-label="Selected edge actions"]');
    expect(toolbar?.getAttribute('style')).toContain('42px');
  }
  const readOnly = await renderPolicy(true, true);
  expect(readOnly.querySelector('[aria-label="Selected edge actions"]')).toBeNull();
  expect(readOnly.querySelector('[data-flow-edge="ab"]')?.getAttribute('d')).toBe(
    'M100,40 Q140,-60 300,140',
  );
});
