import { expect, test } from 'bun:test';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
import { Window } from 'happy-dom';

import {
  flowConnectionCreationField,
  flowEdgeEndpointField,
  flowEndpointSearchInput,
  flowEndpointSearchClear,
  flowEndpointSearchFeedback,
} from '../src/foldkit';
import {
  createEditor,
  resolveConnectionCreation,
  resolveEdgeReconnection,
  resolveEndpointChoices,
  updateEditor,
  type EditorEvent,
  type FlowGraph,
} from '../src/index';

const graph: FlowGraph = {
  nodes: ['a', 'b', 'node-c'].map((id, i) => ({
    id,
    label: i === 0 ? 'Origin [1]' : 'Same label',
    position: { x: i * 200, y: 0 },
    size: { width: 160, height: 100 },
    ports: [
      { id: 'out', label: 'Send', kind: 'output' as const, side: 'right' as const, offset: 0.5 },
      { id: 'in', label: 'Receive', kind: 'input' as const, side: 'left' as const, offset: 0.5 },
    ],
  })),
  edges: [{ id: 'ab', source: { node: 'a', port: 'out' }, target: { node: 'b', port: 'in' } }],
};
const initial = () => createEditor(graph);

test('search matches case-insensitive tokens in labels and endpoint IDs without interpreting patterns', () => {
  const context = resolveConnectionCreation(initial());
  expect(
    resolveEndpointChoices(context.source.entries, { query: '  ORIGIN   send ' }).entries.map(
      ({ endpoint }) => endpoint.node,
    ),
  ).toEqual(['a']);
  expect(
    resolveEndpointChoices(context.source.entries, { query: 'node-c out' }).entries.map(
      ({ endpoint }) => endpoint.node,
    ),
  ).toEqual(['node-c']);
  expect(
    resolveEndpointChoices(context.source.entries, { query: '[1]' }).entries.map(
      ({ endpoint }) => endpoint.node,
    ),
  ).toEqual(['a']);
  expect(resolveEndpointChoices(context.source.entries, { query: '  ' }).entries).toEqual(
    context.source.entries,
  );
  expect(resolveEndpointChoices(context.source.entries, { query: 'missing' }).emptyReason).toBe(
    'No ports match this search.',
  );
  expect(resolveEndpointChoices(context.source.entries, { query: 'missing' }).entries).toHaveLength(
    0,
  );
});

test('a nonmatching protected current selection is retained with its original event, value and reason', () => {
  const context = resolveEdgeReconnection(initial(), 'ab', 'target', {
    canReconnect: () => 'Managed connection.',
  })!;
  const current = context.entries.find(({ current }) => current)!;
  const result = resolveEndpointChoices(context.entries, { query: 'not-present' });
  expect(result.entries).toEqual([current]);
  expect(result.entries[0]).toBe(current);
  expect(result.matchCount).toBe(0);
  expect(result.emptyReason).toBe('No ports match this search. Current selection is retained.');
  expect(result.entries[0]?.reason).toBe('Managed connection.');
  expect(context.entries).toHaveLength(3);
});

test('groups use node identity, preserve order and keep equal labels separate', () => {
  const context = resolveConnectionCreation(initial());
  const entries = [...context.source.entries, ...context.target.entries];
  Object.freeze(entries);
  const result = resolveEndpointChoices(entries);
  expect(result.groups.map(({ id, label }) => [id, label])).toEqual([
    ['a', 'Origin [1]'],
    ['b', 'Same label'],
    ['node-c', 'Same label'],
  ]);
  expect(result.groups.map(({ entries }) => entries.map(({ endpoint }) => endpoint.port))).toEqual([
    ['out', 'in'],
    ['out', 'in'],
    ['out', 'in'],
  ]);
  expect(result.matchCount).toBe(6);
  const oldEntry = { endpoint: { node: 'old-id', port: 'in' }, label: 'Legacy', current: false };
  expect(resolveEndpointChoices([oldEntry]).groups[0]?.label).toBe('old-id');
});

test('filtering preserves policy denial and cannot authorize a stale creation or reconnection', () => {
  const staged = updateEditor(initial(), {
    type: 'PortActivated',
    endpoint: { node: 'a', port: 'out' },
  });
  const creation = resolveConnectionCreation(staged, {
    canConnectPort: ({ node }) => (node === 'node-c' ? 'Input locked.' : null),
  });
  const selected = resolveEndpointChoices(creation.target.entries, { query: 'node-c in' })
    .entries[0]!;
  expect(selected.reason).toBe('Input locked.');
  const denied = updateEditor(staged, selected.event, { canConnect: () => 'Rule changed.' });
  expect(denied.graph).toBe(staged.graph);
  expect(denied.past).toBe(staged.past);
  const reconnect = resolveEdgeReconnection(initial(), 'ab', 'target')!;
  const replacement = resolveEndpointChoices(reconnect.entries, {
    query: 'node-c in',
  }).entries.find(({ current }) => !current)!;
  const refused = updateEditor(initial(), replacement.event, { canReconnect: () => 'New lock.' });
  expect(refused.graph).toEqual(graph);
  expect(refused.past).toHaveLength(0);
});

test('native grouped fields preserve current/placeholder selection and expose no-results descriptions', async () => {
  const results = [];
  for (const grouped of [true, false])
    results.push(
      await Effect.runPromise(
        renderToString(
          {
            Flags: Schema.Struct({}),
            init: () => ({ model: initial() }),
            view: (model, h: HtmlBuilder<EditorEvent>) => ({
              title: 'Search',
              body: h.div(
                [],
                [
                  flowConnectionCreationField(
                    h,
                    resolveConnectionCreation(model).target,
                    (event) => event,
                    { idPrefix: 'create-search', query: 'missing', groupByNode: grouped },
                  ),
                  flowEdgeEndpointField(
                    h,
                    resolveEdgeReconnection(model, 'ab', 'target')!,
                    (event) => event,
                    {
                      idPrefix: 'reconnect-search',
                      query: 'node-c in',
                      groupByNode: grouped,
                      groupLabel: ({ id, label }) => `${label} (${id})`,
                    },
                  ),
                ],
              ),
            }),
          },
          { flags: {}, isHydratable: false },
        ),
      ),
    );
  const window = new Window();
  window.document.body.innerHTML = results[0]!.html;
  const target = window.document.querySelector('#create-search-target-select')!;
  expect(target.querySelectorAll('option')).toHaveLength(1);
  expect(target.querySelector('option[selected]')?.getAttribute('value')).toBe('');
  expect(
    window.document.getElementById(target.getAttribute('aria-describedby')!)?.textContent,
  ).toContain('No ports match this search.');
  const reconnect = window.document.querySelector('#reconnect-search-ab-target-select')!;
  expect(
    [...reconnect.querySelectorAll('optgroup')].map((group) => group.getAttribute('label')),
  ).toEqual(['Same label (b)', 'Same label (node-c)']);
  expect(reconnect.querySelector('option[selected]')?.getAttribute('value')).toBe(
    JSON.stringify(['b', 'in']),
  );
  window.document.body.innerHTML = results[1]!.html;
  expect(window.document.querySelectorAll('optgroup')).toHaveLength(0);
});

test('search controls are model-owned, named and associated with visible no-results feedback', async () => {
  const query = 'Missing';
  const search = resolveEndpointChoices([], { query });
  const result = await Effect.runPromise(
    renderToString(
      {
        Flags: Schema.Struct({}),
        init: () => ({ model: query }),
        view: (_model, h: HtmlBuilder<string>) => ({
          title: 'Search controls',
          body: h.div(
            [],
            [
              flowEndpointSearchInput(h, search, (query) => query, [], {
                idPrefix: 'ports',
                label: 'Search outputs',
              }),
              flowEndpointSearchClear(h, (query) => query, [], ['Clear search']),
              flowEndpointSearchFeedback(h, search, [], { idPrefix: 'ports' }),
            ],
          ),
        }),
      },
      { flags: {}, isHydratable: false },
    ),
  );
  const window = new Window();
  window.document.body.innerHTML = result.html;
  const input = window.document.querySelector('input')!;
  expect(input.getAttribute('type')).toBe('search');
  expect(input.getAttribute('value')).toBe(query);
  expect(input.getAttribute('aria-label')).toBe('Search outputs');
  expect(window.document.getElementById(input.getAttribute('aria-describedby')!)?.textContent).toBe(
    'No ports match this search.',
  );
  expect(window.document.querySelector('button')?.hasAttribute('disabled')).toBe(false);
});
