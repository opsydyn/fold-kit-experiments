/* oxlint-disable anti-slop/no-shape-in-symbol-names -- Geometric node shapes are domain concepts here, not structural placeholder names. */
import { expect, test } from 'bun:test';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
import { Window } from 'happy-dom';

import { flowView } from '../src/foldkit';
import {
  createEditor,
  portAnchor,
  portPosition,
  type EditorEvent,
  type FlowNode,
  type Point,
} from '../src/index';

test('native sockets, custom port contexts and anchor handles share the headless outline anchor', async () => {
  const node: FlowNode = {
    id: 'db',
    label: 'Database',
    position: { x: 10, y: 20 },
    size: { width: 200, height: 100 },
    ports: [
      { id: 'default', kind: 'output', side: 'top', offset: 0 },
      { id: 'authored', kind: 'output', side: 'right', anchor: { x: 0.8, y: 0.3 } },
    ],
    appearance: { shape: 'cylinder' },
    architecture: { family: 'c4', role: 'container' },
  };
  const contexts: Point[] = [],
    handles: Point[] = [];
  const state = { ...createEditor({ nodes: [node], edges: [] }), selectedNodes: ['db'] };
  const result = await Effect.runPromise(
    renderToString(
      {
        Flags: Schema.Struct({}),
        init: () => ({ model: state }),
        view: (model, h: HtmlBuilder<EditorEvent>) => ({
          title: 'Geometry contract',
          body: flowView(h, model, {
            id: 'shape-contract',
            label: 'Geometry contract',
            onEvent: (event) => event,
            portAnchorHandles: true,
            renderPort: ({ anchor }) => {
              contexts.push(anchor);
              return undefined;
            },
            renderPortAnchorHandle: ({ anchor }) => {
              handles.push(anchor);
              return undefined;
            },
          }),
        }),
      },
      { flags: {}, isHydratable: false },
    ),
  );
  expect(contexts).toEqual([
    { x: 0, y: 0.16 },
    { x: 0.8, y: 0.3 },
  ]);
  expect(handles).toEqual(contexts);
  const window = new Window();
  window.document.body.innerHTML = result.html;
  const port = window.document.querySelector('[data-flow-owner="db"][data-flow-port="default"]');
  expect(port?.getAttribute('style')).toContain('left: 0%');
  expect(port?.getAttribute('style')).toContain('top: 16%');
  expect(port?.getAttribute('aria-label')).toBe('Connect from Database: default');
  expect(portAnchor(node.ports[0]!)).toEqual({ x: 0, y: 0 });
  expect(portAnchor(node.ports[0]!, node)).toEqual({ x: 0, y: 0.16 });
  expect(portPosition(node, 'default')).toEqual({ x: 10, y: 36 });
});
