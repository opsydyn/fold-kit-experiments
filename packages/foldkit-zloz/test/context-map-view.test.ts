import { expect, test } from 'bun:test';

import { Html, HtmlServer } from '@effect/ui/html';
import { Effect, Schema } from 'effect';
import { Window } from 'happy-dom';

import {
  contextMapConnector,
  graphSurface,
  type ZlozContextMapLabelOptions,
} from '../src/effect-ui';
import { createContextMapPattern, createEditor, resolveContextMapRelationship } from '../src/index';
async function render({
  blank = false,
  readOnly = false,
  omit = false,
  omitConnector = false,
  fallback = false,
  protectedSelection = false,
  labelOptions = {},
}: {
  blank?: boolean;
  readOnly?: boolean;
  omit?: boolean;
  omitConnector?: boolean;
  fallback?: boolean;
  protectedSelection?: boolean;
  labelOptions?: ZlozContextMapLabelOptions<string>;
} = {}) {
  const graph = createContextMapPattern();
  const value = {
    ...graph,
    edges: graph.edges.map((edge) => (blank ? { ...edge, label: '' } : edge)),
  };
  const state = createEditor(value, { readOnly });
  const ContextMap = Html.component({
    name: 'ContextMap',
    model: Schema.Null,
    message: Schema.String,
  }).make({
    init: () => null,
    update: () => null,
    view: (h) =>
      graphSurface(h, state, {
        id: 'context-map',
        label: 'Context map',
        onInput: (event) => event.type,
        policy: protectedSelection ? { canSelectEdge: () => 'Managed selection' } : undefined,
        contextMapPresentation: !fallback,
        renderEdge: omitConnector
          ? (edge, h) => {
              const relationship = resolveContextMapRelationship(state.graph, edge.edge);
              return relationship
                ? contextMapConnector(h, edge, relationship, { renderPath: () => null })
                : undefined;
            }
          : undefined,
        contextMapLabelOptions: labelOptions,
        edgeEditing: {
          onEdit: (event) => event.type,
          renderLabel: omit ? () => null : undefined,
        },
      }),
  });
  const output = await Effect.runPromise(HtmlServer.renderToHtml(ContextMap, {}, { static: true }));
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
  const emptyArtwork = await render({ omitConnector: true });
  expect(emptyArtwork.querySelectorAll('[data-zloz-context-map-edge]')).toHaveLength(0);
  expect(emptyArtwork.querySelector('[data-flow-edge="orders-billing"]')?.getAttribute('d')).toBe(
    path,
  );
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
      renderPattern: (relation, h) => h.strong(`Custom ${relation.pattern}`),
      renderLayout: (parts, _relation, h) => [h.span(parts.pattern)],
    },
  });
  expect(dom.querySelector('[data-zloz-context-map-label]')?.textContent).toContain(
    'Custom Upstream',
  );
  expect(dom.querySelector('[aria-label="Open host service"]')).toBeNull();
  expect(dom.querySelector('[data-zloz-context-map-label]')?.tagName).toBe('BUTTON');
});
