import { expect, test } from 'bun:test';

import { Html, HtmlServer } from '@effect/ui/html';
import { Effect, Schema } from 'effect';
import { Window } from 'happy-dom';

import {
  graphSurface,
  zlozDarkTheme,
  type GraphSurfaceOptions,
  type NativeNotationContext,
  type NativeNotationParts,
} from '../src/effect-ui';
import {
  createArchitecturePattern,
  parseGraph,
  createEditor,
  type EditorState,
} from '../src/index';
import workshopWire from './fixtures/workshop-v1.json';
const initial = createEditor(createArchitecturePattern('event-storming'));
async function render(
  state: EditorState = initial,
  parts: NativeNotationParts<string> = {},
  view: Partial<GraphSurfaceOptions<string>> = {},
) {
  const component = Html.component({
    name: 'workshopTest',
    model: Schema.Null,
    message: Schema.String,
  }).make({
    init: () => null,
    update: () => null,
    view: (h) =>
      graphSurface(h, state, {
        id: 'workshop',
        label: 'Workshop',
        onInput: (event) => event.type,
        onToggleGroup: (id) => id,
        resizeHandles: true,
        architectureNotation: true,
        notationParts: parts,
        theme: {
          ...zlozDarkTheme,
          tokens: { ...zlozDarkTheme.tokens, eventStormingCommand: 'var(--host-command)' },
        },
        ...view,
      }),
  });
  const result = await Effect.runPromise(HtmlServer.renderToHtml(component, {}, { static: true }));
  const window = new Window();
  window.document.body.innerHTML = result.html;
  return window.document;
}

test('notes show explicit roles and names, scoped theme tokens, authored dimensions and native sockets', async () => {
  const document = await render();
  expect(document.querySelectorAll('[data-zloz-event-storming-node]')).toHaveLength(5);
  expect(document.querySelectorAll('[data-zloz-event-storming-type]')).toHaveLength(5);
  expect(
    document.querySelector(
      '[data-zloz-event-storming-node]:has([data-zloz-event-storming-type="domain-event"])',
    )?.textContent,
  ).toContain('Domain Event');
  expect(
    document.querySelector(
      '[data-zloz-event-storming-node]:has([data-zloz-event-storming-type="domain-event"])',
    )?.textContent,
  ).toContain('Order placed');
  expect(document.querySelector('#workshop-surface')?.getAttribute('style')).toContain(
    '--flow-event-storming-command:var(--host-command)',
  );
  expect(
    document
      .querySelector(
        '[data-zloz-event-storming-node]:has([data-zloz-event-storming-type="policy"])',
      )
      ?.getAttribute('style'),
  ).toContain('height:160px');
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
    renderName: ({ architecture }, h) => h.strong.children(`Custom ${architecture.role}`),
    renderDescription: () => null,
  });
  expect(document.querySelector('[data-zloz-event-storming-type]')).toBeNull();
  expect(document.querySelector('[data-zloz-event-storming-node="note:0"]')?.textContent).toContain(
    'Custom actor',
  );
  expect(document.querySelectorAll('[data-flow-port]')).toHaveLength(8);
  const empty = await render(
    initial,
    { renderBody: () => null },
    { renderNodeShell: () => ({ controls: false }) },
  );
  expect(empty.querySelector('[data-zloz-event-storming-body]')).toBeNull();
  expect(empty.querySelector('[data-flow-handle="note:0"]')?.getAttribute('aria-label')).toBe(
    'Select Customer',
  );
  expect(empty.querySelectorAll('[data-flow-port]')).toHaveLength(8);
});

test('artwork cache inputs exclude live read-only and source-port feedback', async () => {
  const inputs: NativeNotationContext[] = [];
  const options: NativeNotationParts<string> = {
    renderBody(context) {
      inputs.push(context);
    },
  };
  await render(initial, options);
  const before = inputs.splice(0);
  const document = await render(
    { ...initial, readOnly: true, connection: { node: 'note:0', port: 'out' } },
    options,
  );
  expect(inputs).toEqual(before);
  const port = document.querySelector('[data-flow-owner="note:0"][data-flow-port="out"]');
  expect(port?.hasAttribute('disabled')).toBe(true);
  expect(port?.getAttribute('aria-pressed')).toBe('true');
});

test('workshop artwork renders external systems, semantic hotspot status and native lane frames without inventing sockets', async () => {
  const graph = parseGraph(JSON.stringify(workshopWire));
  const document = await render(createEditor(graph));
  expect(document.querySelectorAll('[data-zloz-event-storming-node]')).toHaveLength(5);
  expect(
    document.querySelector('[data-zloz-event-storming-type="external-system"]'),
  ).not.toBeNull();
  expect(document.querySelector('[data-zloz-hotspot-status="open"]')?.textContent).toBe(
    'Open question',
  );
  const handle = document.querySelector('[data-flow-handle="hotspot"]');
  expect(handle?.getAttribute('aria-description')).toContain('Hotspot. Open question');
  expect(document.querySelector('[data-zloz-event-storming-group="lane"]')).not.toBeNull();
  expect(
    document
      .querySelector('[data-zloz-event-storming-node="hotspot"]')
      ?.querySelectorAll('[data-flow-port]'),
  ).toHaveLength(0);
  const collapsed = await render({ ...createEditor(graph), collapsedGroups: ['lane'] });
  expect(collapsed.querySelectorAll('[data-zloz-hotspot-status]')).toHaveLength(0);
  expect(collapsed.querySelector('[data-zloz-event-storming-group="lane"]')?.textContent).toContain(
    'Payments workshop',
  );
});
test('custom/omitted status, body and controls compose in native workshop shells and shared headers', async () => {
  const state = createEditor(parseGraph(JSON.stringify(workshopWire)));
  const custom = await render(
    state,
    {
      describeMeaning: ({ architecture }) =>
        architecture.role === 'hotspot' ? 'Custom hotspot meaning' : null,
      renderStatus: ({ architecture }, h) =>
        architecture.role === 'hotspot'
          ? h.span.attr('data-custom-status', '').children(`Review · ${architecture.status}`)
          : null,
    },
    {
      groupHeader: (node) =>
        node.id === 'lane'
          ? {
              id: node.id,
              sizing: 'intrinsic',
              padding: { top: 8, left: 12, right: 140, bottom: 8 },
              gap: 0,
            }
          : undefined,
    },
  );
  expect(
    custom.querySelector('[data-flow-handle="hotspot"]')?.getAttribute('aria-description'),
  ).toBe('Custom hotspot meaning');
  expect(
    custom.querySelector('[data-flow-handle="system"]')?.hasAttribute('aria-description'),
  ).toBe(false);
  expect(custom.querySelector('[data-custom-status]')?.textContent).toBe('Review · open');
  expect(custom.querySelector('[data-zloz-group-header="lane"]')).not.toBeNull();
  const omitted = await render(state, {
    renderStatus: () => null,
    renderDescription: () => null,
  });
  expect(omitted.querySelector('[data-zloz-hotspot-status]')).toBeNull();
  expect(
    omitted.querySelector(
      '[data-zloz-event-storming-node]:has([data-zloz-event-storming-type="external-system"])',
    )?.textContent,
  ).toContain('Payment provider');
});

test('semantic hotspot status remains visible in read-only views without numeric diagnostics', async () => {
  const state = createEditor(parseGraph(JSON.stringify(workshopWire)));
  const dom = await render({ ...state, readOnly: true });
  expect(dom.querySelector('[data-zloz-hotspot-status]')?.textContent).toBe('Open question');
  expect(dom.querySelector('[data-zloz-event-storming-group]')?.textContent).toContain(
    'Payments workshop',
  );
});
