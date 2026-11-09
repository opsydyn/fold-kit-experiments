import { expect, test } from 'bun:test';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
import { Window } from 'happy-dom';

import {
  zlozView,
  zlozEventStormingNode,
  zlozDarkTheme,
  type ZlozEventStormingNodeOptions,
  type ZlozNodeBodyCache,
} from '../src/foldkit';
import {
  createArchitecturePattern,
  createEditor,
  type EditorEvent,
  type EditorState,
} from '../src/index';
const initial = createEditor(createArchitecturePattern('event-storming'));
async function render(
  state: EditorState = initial,
  options: ZlozEventStormingNodeOptions<EditorEvent> = {},
) {
  const result = await Effect.runPromise(
    renderToString(
      {
        Flags: Schema.Struct({}),
        init: () => ({ model: state }),
        view: (model, h: HtmlBuilder<EditorEvent>) => ({
          title: 'Workshop',
          body: zlozView(h, model, {
            id: 'workshop',
            label: 'Workshop',
            onEvent: (event) => event,
            theme: {
              ...zlozDarkTheme,
              tokens: { ...zlozDarkTheme.tokens, eventStormingCommand: 'var(--host-command)' },
            },
            renderNodeShell: (context, builder) => zlozEventStormingNode(context, builder, options),
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

test('notes show explicit roles and names, scoped theme tokens, authored dimensions and native sockets', async () => {
  const document = await render();
  expect(document.querySelectorAll('[data-zloz-event-storming-node]')).toHaveLength(5);
  expect(document.querySelectorAll('[data-zloz-event-storming-type]')).toHaveLength(5);
  expect(
    document.querySelector('[data-zloz-event-storming-node="domain-event"]')?.textContent,
  ).toContain('Domain Event');
  expect(
    document.querySelector('[data-zloz-event-storming-node="domain-event"]')?.textContent,
  ).toContain('Order placed');
  expect(document.querySelector('#workshop')?.getAttribute('style')).toContain(
    '--flow-event-storming-command: var(--host-command)',
  );
  expect(
    document.querySelector('[data-zloz-event-storming-node="policy"]')?.getAttribute('style'),
  ).toContain('height: 160px');
  expect(document.querySelector('[data-flow-handle="note:0"]')?.getAttribute('aria-label')).toBe(
    'Select Customer',
  );
  expect(
    document
      .querySelector('[data-flow-owner="note:0"][data-flow-port="out"]')
      ?.getAttribute('aria-label'),
  ).toBe('Connect from Customer: out');
});

test('custom content and controls can replace/omit parts while sockets and accessible handles survive', async () => {
  const document = await render(initial, {
    renderType: () => null,
    renderName: ({ architecture }, h) => h.strong([], [`Custom ${architecture.role}`]),
    renderDescription: () => null,
    renderControls: () => [],
  });
  expect(document.querySelector('[data-zloz-event-storming-type]')).toBeNull();
  expect(document.querySelector('[data-zloz-event-storming-node="actor"]')?.textContent).toContain(
    'Custom actor',
  );
  expect(document.querySelectorAll('[data-flow-port]')).toHaveLength(8);
  const empty = await render(initial, { renderBody: () => null, renderControls: () => [] });
  expect(empty.querySelector('[data-zloz-event-storming-body]')?.textContent).toBe('');
  expect(empty.querySelector('[data-flow-handle="note:0"]')?.getAttribute('aria-label')).toBe(
    'Select Customer',
  );
  expect(empty.querySelectorAll('[data-flow-port]')).toHaveLength(8);
});

test('artwork cache inputs exclude live read-only and source-port feedback', async () => {
  const inputs: unknown[][] = [];
  const bodyCache: ZlozNodeBodyCache = (_node, view, args) => {
    inputs.push(args.slice(1));
    return view(...args);
  };
  const options = { bodyCache };
  await render(initial, options);
  const before = inputs.slice();
  inputs.length = 0;
  const document = await render(
    { ...initial, readOnly: true, connection: { node: 'note:0', port: 'out' } },
    options,
  );
  expect(inputs).toEqual(before);
  const port = document.querySelector('[data-flow-owner="note:0"][data-flow-port="out"]');
  expect(port?.hasAttribute('disabled')).toBe(true);
  expect(port?.getAttribute('aria-pressed')).toBe('true');
});
