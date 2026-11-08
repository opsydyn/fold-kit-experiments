/* oxlint-disable anti-slop/no-shape-in-symbol-names -- Node outline geometry is a domain contract. */
import { expect, test } from 'bun:test';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
import { Window } from 'happy-dom';

import {
  zlozDddNode,
  zlozDddGroup,
  zlozView,
  zlozLightTheme,
  zlozDarkTheme,
  type ZlozDddNodeOptions,
  type ZlozNodeBodyCache,
  type ZlozViewOptions,
} from '../src/foldkit';
import {
  createArchitectureNode,
  createEditor,
  nodeShapeGeometry,
  type EditorEvent,
  type EditorState,
  type ZlozGraph,
} from '../src/index';

const graph: ZlozGraph = {
  nodes: [
    ...(
      [
        'entity',
        'value-object',
        'aggregate-root',
        'domain-event',
        'domain-service',
        'repository',
        'bounded-context',
      ] as const
    ).map((role, index) =>
      createArchitectureNode({
        id: role,
        label: `Named ${role}`,
        position: { x: index * 250, y: 60 },
        size: { width: 220, height: 180 },
        ports: [{ id: 'out', kind: 'output', side: 'top', offset: 0 }],
        architecture:
          role === 'bounded-context'
            ? { family: 'ddd', role, subdomain: 'core', description: 'Owns its language' }
            : { family: 'ddd', role, description: 'A domain responsibility' },
        appearance: { shape: role === 'repository' ? 'cylinder' : 'rounded-rectangle' },
      }),
    ),
    ...(['aggregate', 'bounded-context'] as const).map((role) =>
      createArchitectureNode({
        id: `${role}-boundary`,
        kind: 'group',
        label: `Boundary ${role}`,
        position: { x: 0, y: 350 },
        size: { width: 500, height: 320 },
        ports: [],
        architecture:
          role === 'bounded-context'
            ? { family: 'ddd', role, subdomain: 'supporting' }
            : { family: 'ddd', role },
      }),
    ),
    {
      id: 'plain',
      label: 'Plain node',
      position: { x: 0, y: 750 },
      size: { width: 180, height: 100 },
      ports: [],
    },
    createArchitectureNode({
      id: 'system',
      label: 'C4 system',
      position: { x: 250, y: 750 },
      size: { width: 180, height: 100 },
      ports: [],
      architecture: { family: 'c4', role: 'software-system' },
    }),
  ],
  edges: [],
};
const initial = createEditor(graph);
async function render(
  state: EditorState = initial,
  options: ZlozDddNodeOptions<EditorEvent> = {},
  view: Partial<ZlozViewOptions<EditorEvent>> = {},
) {
  const result = await Effect.runPromise(
    renderToString(
      {
        Flags: Schema.Struct({}),
        init: () => ({ model: state }),
        view: (model, h: HtmlBuilder<EditorEvent>) => ({
          title: 'DDD',
          body: zlozView(h, model, {
            id: 'ddd',
            label: 'Domain model',
            onEvent: (event) => event,
            resizeHandles: true,
            renderNodeShell: (context, builder) => zlozDddNode(context, builder, options),
            renderGroupShell: (context, builder) => zlozDddGroup(context, builder, options),
            ...view,
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

test('all eight DDD roles retain native semantics, canonical geometry and family fallback', async () => {
  const document = await render();
  expect(document.querySelectorAll('[data-flow-ddd-node]')).toHaveLength(7);
  expect(document.querySelectorAll('[data-flow-ddd-group]')).toHaveLength(2);
  for (const label of [
    'Entity',
    'Value Object',
    'Aggregate Root',
    'Aggregate',
    'Domain Event',
    'Domain Service',
    'Repository',
    'Bounded Context',
  ])
    expect(document.body.textContent).toContain(label);
  expect(document.querySelector('[data-flow-node="plain"]')?.textContent).toContain('Plain node');
  expect(document.querySelector('[data-flow-node="system"] [data-flow-ddd-body]')).toBeNull();
  expect(document.querySelector('[data-flow-node="bounded-context"]')?.textContent).toContain(
    'Core subdomain',
  );
  expect(document.querySelector('[data-flow-ddd-group="bounded-context"]')?.textContent).toContain(
    'Supporting subdomain',
  );
  const repository = document.querySelector('[data-flow-node="repository"]');
  expect(repository?.querySelector('[data-flow-ddd-outline]')?.getAttribute('d')).toBe(
    nodeShapeGeometry(graph.nodes[5]!).outlinePath,
  );
  expect(repository?.querySelector('[data-flow-ddd-cap]')).not.toBeNull();
  expect(repository?.querySelector('[data-flow-port="out"]')?.getAttribute('style')).toContain(
    'top: 8.888',
  );
  expect(repository?.querySelector('[data-flow-handle]')?.getAttribute('aria-label')).toBe(
    'Select Named repository',
  );
  expect(
    document.querySelector('[data-flow-ddd-boundary-controls] button[aria-expanded]'),
  ).not.toBeNull();
  expect(document.querySelectorAll('[data-flow-ddd-group] [data-flow-port]')).toHaveLength(0);
  expect(document.querySelectorAll('button button')).toHaveLength(0);
});

test('slots omit or replace inert parts; live controls stay outside the drag button in both themes and minimal mode', async () => {
  for (const theme of [zlozLightTheme, zlozDarkTheme]) {
    const document = await render(
      initial,
      {
        renderType: () => null,
        renderSubdomain: () => null,
        renderDescription: () => null,
        renderBadge: ({ architecture }, h) => h.span([], [`Custom ${architecture.role}`]),
        renderName: ({ node }, h) => h.strong([], [`Custom ${node.label}`]),
      },
      { theme, minimalMode: true, canConnectPort: () => 'Domain approval required' },
    );
    expect(document.body.textContent).not.toContain('A domain responsibility');
    expect(document.body.textContent).not.toContain('Core subdomain');
    expect(document.body.textContent).toContain('Custom aggregate-root');
    expect(document.body.textContent).toContain('Custom Named entity');
    expect(document.querySelector('[data-flow-port]')?.getAttribute('title')).toBe(
      'Domain approval required',
    );
    expect(document.querySelector('[data-flow-port]')?.hasAttribute('disabled')).toBe(true);
    expect(document.getElementById('ddd')?.getAttribute('style')).toContain(
      `color-scheme: ${theme.colorScheme}`,
    );
    expect(document.querySelector('[data-flow-ddd-outline]')?.getAttribute('fill')).toBe(
      'var(--flow-node-background, #fff)',
    );
    expect(
      document.querySelectorAll(
        '[data-flow-ddd-body] button, [data-flow-ddd-body] [data-flow-port]',
      ),
    ).toHaveLength(0);
  }
});

test('cached body inputs exclude source/read-only policies and retain live socket feedback', async () => {
  const mutable: unknown[][] = [];
  const cache: ZlozNodeBodyCache = (_node, view, args) => {
    mutable.push(args.slice(1));
    return view(...args);
  };
  const options: ZlozDddNodeOptions<EditorEvent> = { bodyCache: cache };
  await render(initial, options);
  const before = mutable.slice();
  mutable.length = 0;
  const document = await render(
    { ...initial, readOnly: true, connection: { node: 'entity', port: 'out' } },
    options,
  );
  expect(mutable).toEqual(before);
  expect(
    document
      .querySelector('[data-flow-owner="entity"][data-flow-port]')
      ?.getAttribute('aria-pressed'),
  ).toBe('true');
  expect(document.querySelector('[data-flow-port]')?.hasAttribute('disabled')).toBe(true);
  expect(
    document.querySelectorAll(
      '[data-flow-ddd-node] [data-flow-resize], [data-flow-ddd-group] [data-flow-resize]',
    ),
  ).toHaveLength(0);
});

test('custom body and controls can be omitted without losing ports, dimensions or accessible names', async () => {
  const document = await render(initial, {
    attributes: [],
    renderBody: () => null,
    renderControls: () => [],
  });
  expect(document.querySelector('[data-flow-ddd-type]')).toBeNull();
  expect(document.querySelector('[data-flow-node="entity"] [data-flow-port]')).not.toBeNull();
  expect(document.querySelector('[data-flow-handle="entity"]')?.getAttribute('aria-label')).toBe(
    'Select Named entity',
  );
  expect(document.querySelector('[data-flow-ddd-node="entity"]')?.getAttribute('style')).toContain(
    'height: 180px',
  );
  expect(
    document.querySelectorAll(
      '[data-flow-ddd-node] [data-flow-resize], [data-flow-ddd-group] [data-flow-resize]',
    ),
  ).toHaveLength(0);
});
