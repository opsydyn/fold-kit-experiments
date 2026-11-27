/* oxlint-disable anti-slop/no-shape-in-symbol-names -- Node outline geometry is a domain contract. */
import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import { Html, HtmlServer } from '@effect/ui/html';
import { Effect, Schema } from 'effect';
import { Window } from 'happy-dom';

import {
  graphSurface,
  zlozDarkTheme,
  zlozLightTheme,
  type GraphSurfaceOptions,
  type NativeNotationContext,
  type NativeNotationParts,
} from '../src/effect-ui';
import {
  createArchitectureNode,
  createEditor,
  nodeShapeGeometry,
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
        'read-model',
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
  parts: NativeNotationParts<string> = {},
  view: Partial<GraphSurfaceOptions<string>> = {},
) {
  const component = Html.component({
    name: 'dddTest',
    model: Schema.Null,
    message: Schema.String,
  }).make({
    init: () => null,
    update: () => null,
    view: (h) =>
      graphSurface(h, state, {
        id: 'ddd',
        label: 'Domain model',
        onInput: (event) => event.type,
        onToggleGroup: (id) => id,
        resizeHandles: true,
        architectureNotation: true,
        notationParts: parts,
        ...view,
      }),
  });
  const result = await Effect.runPromise(HtmlServer.renderToHtml(component, {}, { static: true }));
  const window = new Window();
  window.document.body.innerHTML = result.html;
  return window.document;
}

test('all nine DDD roles retain native semantics, canonical geometry and family fallback', async () => {
  const document = await render();
  expect(document.querySelectorAll('[data-flow-ddd-node]')).toHaveLength(8);
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
  expect(
    document.querySelector('[data-flow-ddd-group="bounded-context-boundary"]')?.textContent,
  ).toContain('Supporting subdomain');
  expect(
    document.querySelector('[data-flow-node="read-model"] [data-flow-ddd-type]')?.textContent,
  ).toBe('Read Model');
  const repository = document.querySelector('[data-flow-node="repository"]');
  expect(repository?.querySelector('[data-flow-ddd-outline]')?.getAttribute('d')).toBe(
    nodeShapeGeometry(graph.nodes[5]!).outlinePath,
  );
  expect(repository?.querySelector('[data-flow-ddd-cap]')).not.toBeNull();
  expect(repository?.querySelector('[data-flow-port="out"]')?.getAttribute('style')).toContain(
    'top:8.888',
  );
  expect(repository?.querySelector('[data-flow-handle]')?.getAttribute('aria-label')).toBe(
    'Select Named repository',
  );
  expect(document.querySelector('[data-flow-ddd-group] button[aria-expanded]')).not.toBeNull();
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
        renderBadge: ({ architecture }, h) => h.span.children(`Custom ${architecture.role}`),
        renderName: ({ node }, h) => h.strong.children(`Custom ${node.label}`),
      },
      { theme, policy: { canConnectPort: () => 'Domain approval required' } },
    );
    expect(document.body.textContent).not.toContain('A domain responsibility');
    expect(document.body.textContent).not.toContain('Core subdomain');
    expect(document.body.textContent).toContain('Custom aggregate-root');
    expect(document.body.textContent).toContain('Custom Named entity');
    expect(document.querySelector('[data-flow-port]')?.getAttribute('title')).toBe(
      'Domain approval required',
    );
    expect(document.querySelector('[data-flow-port]')?.hasAttribute('disabled')).toBe(true);
    expect(document.getElementById('ddd-surface')?.getAttribute('style')).toContain(
      `color-scheme:${theme.colorScheme}`,
    );
    expect(document.querySelectorAll('[data-flow-ddd-type]')).toHaveLength(0);
    expect(
      document.querySelectorAll(
        '[data-flow-ddd-body] button, [data-flow-ddd-body] [data-flow-port]',
      ),
    ).toHaveLength(0);
  }
});

test('cached body inputs exclude source/read-only policies and retain live socket feedback', async () => {
  const inputs: NativeNotationContext[] = [];
  const options: NativeNotationParts<string> = {
    renderBody(context) {
      inputs.push(context);
    },
  };
  await render(initial, options);
  const before = inputs.splice(0);
  const document = await render(
    { ...initial, readOnly: true, connection: { node: 'entity', port: 'out' } },
    options,
  );
  expect(inputs).toEqual(before);
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
  const hideControls = () => ({ controls: false });
  const document = await render(
    initial,
    { renderBody: () => null },
    {
      renderNodeShell: hideControls,
      renderGroupShell: hideControls,
    },
  );
  expect(document.querySelector('[data-flow-ddd-type]')).toBeNull();
  expect(document.querySelector('[data-flow-node="entity"] [data-flow-port]')).not.toBeNull();
  expect(document.querySelector('[data-flow-handle="entity"]')?.getAttribute('aria-label')).toBe(
    'Select Named entity',
  );
  expect(document.querySelector('[data-flow-ddd-node="entity"]')?.getAttribute('style')).toContain(
    'height:180px',
  );
  expect(
    document.querySelectorAll(
      '[data-flow-ddd-node] [data-flow-resize], [data-flow-ddd-group] [data-flow-resize]',
    ),
  ).toHaveLength(0);
});

test('declared group header geometry composes custom content and keeps compact collapsed headings', async () => {
  const node = graph.nodes.find((n) => n.id === 'bounded-context-boundary');
  assert(node);
  const state = createEditor({ nodes: [node], edges: [] });
  const groupHeader = {
    id: node.id,
    size: { width: 600, height: 112 },
    padding: { top: 24, right: 24, bottom: 24, left: 24 },
    gap: 24,
  };
  const options: NativeNotationParts<string> = {
    renderBody: (_, h) =>
      h.span.attr('data-custom-group-heading', '').children('Custom architecture heading'),
  };
  const document = await render(state, options, { groupHeader: () => groupHeader });
  const header = document.querySelector('[data-zloz-group-header]');
  expect(header?.getAttribute('style')).toContain('width:600px');
  expect(header?.getAttribute('style')).toContain('height:112px');
  expect(header?.getAttribute('style')).toContain('left:24px');
  expect(header?.getAttribute('style')).toContain('top:24px');
  expect(header?.textContent).toContain('Custom architecture heading');
  const intrinsic = await render(state, options, {
    groupHeader: () => ({ ...groupHeader, sizing: 'intrinsic' }),
  });
  expect(intrinsic.querySelector('[data-zloz-group-header]')?.getAttribute('style')).toContain(
    'width:max-content',
  );
  expect(intrinsic.querySelector('[data-zloz-group-header]')?.getAttribute('style')).toContain(
    'height:max-content',
  );
  const collapsed = await render({ ...state, collapsedGroups: [node.id] }, options, {
    groupHeader: () => groupHeader,
  });
  expect(collapsed.querySelector('[data-zloz-group-header]')).toBeNull();
  expect(collapsed.querySelector('[data-custom-group-heading]')).not.toBeNull();
});
