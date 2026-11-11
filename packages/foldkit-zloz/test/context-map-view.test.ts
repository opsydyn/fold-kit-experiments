import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
import { Window } from 'happy-dom';

import {
  zlozView,
  zlozContextMapConnector,
  zlozContextMapLabel,
  type ZlozContextMapLabelOptions,
} from '../src/foldkit';
import {
  createContextMapPattern,
  createEditor,
  resolveContextMapRelationship,
  type EditorEvent,
} from '../src/index';
async function render({
  blank = false,
  readOnly = false,
  omit = false,
  fallback = false,
  protectedSelection = false,
  labelOptions = {},
}: {
  blank?: boolean;
  readOnly?: boolean;
  omit?: boolean;
  fallback?: boolean;
  protectedSelection?: boolean;
  labelOptions?: ZlozContextMapLabelOptions<EditorEvent>;
} = {}) {
  const graph = createContextMapPattern();
  const value = {
    ...graph,
    edges: graph.edges.map((edge) => (blank ? { ...edge, label: '' } : edge)),
  };
  const state = createEditor(value, { readOnly });
  const output = await Effect.runPromise(
    renderToString(
      {
        Flags: Schema.Struct({}),
        init: () => ({ model: state }),
        view: (model, h: HtmlBuilder<EditorEvent>) => ({
          title: 'Context map',
          body: zlozView(h, model, {
            id: 'context-map',
            label: 'Context map',
            onEvent: (e) => e,
            canSelectEdge: protectedSelection ? () => 'Managed selection' : undefined,
            renderEdge: (context, h) => {
              const relation = resolveContextMapRelationship(model.graph, context.edge);
              assert(relation);
              return zlozContextMapConnector(h, context, relation);
            },
            renderEdgeLabel: (context, h) => {
              const relation = resolveContextMapRelationship(model.graph, context.edge);
              assert(relation);
              return fallback
                ? undefined
                : omit
                  ? null
                  : zlozContextMapLabel(h, context, relation, (e) => e, labelOptions);
            },
          }),
        }),
      },
      { flags: {}, isHydratable: false },
    ),
  );
  const window = new Window();
  window.document.body.innerHTML = output.html;
  return window.document;
}
test('directed arrows, symmetric paths and core hit targets share the canonical paths', async () => {
  const dom = await render();
  expect(
    dom.querySelector('[data-zloz-context-map-edge="orders-billing"]')?.getAttribute('marker-end'),
  ).toContain('url(');
  expect(
    dom.querySelector('[data-zloz-context-map-edge="orders-catalog"]')?.hasAttribute('marker-end'),
  ).toBe(false);
  expect(
    dom
      .querySelector('[data-zloz-context-map-edge="catalog-inventory"]')
      ?.hasAttribute('marker-end'),
  ).toBe(false);
  const path = dom
    .querySelector('[data-zloz-context-map-edge="orders-billing"]')
    ?.getAttribute('d');
  expect(dom.querySelector('[data-flow-edge="orders-billing"]')?.getAttribute('d')).toBe(path);
  expect(dom.querySelectorAll('[data-zloz-context-map-label]')).toHaveLength(4);
  expect(dom.querySelector('[aria-label="Open host service"]')?.textContent).toBe('OHS');
  expect(dom.querySelector('[aria-label="Anti-corruption layer"]')?.textContent).toBe('ACL');
});
test('unlabeled unselected/read-only edges can show semantic content; fallback/null retain previous default visibility', async () => {
  const native = await render({ blank: true });
  expect(native.querySelectorAll('[data-zloz-context-map-label]')).toHaveLength(4);
  const readOnly = await render({ blank: true, readOnly: true });
  expect(readOnly.querySelectorAll('[data-zloz-context-map-label]')).toHaveLength(4);
  expect(readOnly.querySelectorAll('button[data-zloz-context-map-label]')).toHaveLength(0);
  const fallback = await render({ blank: true, fallback: true });
  expect(fallback.querySelectorAll('[data-zloz-context-map-label]')).toHaveLength(0);
  expect(fallback.querySelector('[data-flow-context-edge]')).toBeNull();
  const omitted = await render({ omit: true });
  expect(omitted.querySelectorAll('[data-zloz-context-map-label]')).toHaveLength(0);
  const protectedView = await render({ protectedSelection: true });
  expect(protectedView.querySelectorAll('button[data-zloz-context-map-label]')).toHaveLength(0);
  expect(protectedView.querySelector('[data-zloz-context-map-label]')?.getAttribute('title')).toBe(
    'Managed selection',
  );
});
test('nullable parts, custom badges and layout compose without removing the native edit action', async () => {
  const dom = await render({
    labelOptions: {
      renderName: () => null,
      renderSource: () => null,
      renderTarget: () => null,
      renderReason: () => null,
      renderPattern: (relation, h) => h.strong([], [`Custom ${relation.pattern}`]),
      renderLayout: (parts, _relation, h) => [h.span([], parts.pattern ? [parts.pattern] : [])],
    },
  });
  expect(dom.querySelector('[data-zloz-context-map-label]')?.textContent).toContain(
    'Custom Upstream',
  );
  expect(dom.querySelector('[aria-label="Open host service"]')).toBeNull();
  expect(dom.querySelector('[data-zloz-context-map-label]')?.tagName).toBe('BUTTON');
});
