/* oxlint-disable anti-slop/no-shape-in-symbol-names -- Geometric node shapes are domain concepts here, not structural placeholders. */
import { expect, test } from 'bun:test';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
import { Window } from 'happy-dom';

import {
  zlozC4Node,
  zlozC4Group,
  zlozView,
  zlozLightTheme,
  zlozDarkTheme,
  type ZlozC4NodeOptions,
  type ZlozNodeBodyCache,
  type ZlozViewOptions,
} from '../src/foldkit';
import {
  createEditor,
  createArchitectureNode,
  nodeShapeGeometry,
  type ZlozGraph,
  type EditorState,
  type EditorEvent,
} from '../src/index';

const graph: ZlozGraph = {
  nodes: [
    ...(['person', 'software-system', 'container', 'component'] as const).map((role, index) =>
      createArchitectureNode({
        id: role,
        label: `Named ${role}`,
        position: { x: index * 260, y: 60 },
        size: { width: 220, height: 200 },
        ports: [{ id: 'out', kind: 'output', side: 'top', offset: 0 }],
        architecture:
          role === 'container' || role === 'component'
            ? {
                family: 'c4',
                role,
                description: 'A useful responsibility',
                technology: 'TypeScript',
                scope: 'internal',
              }
            : { family: 'c4', role, description: 'A useful responsibility', scope: 'external' },
        appearance: { shape: role === 'container' ? 'cylinder' : 'rounded-rectangle' },
      }),
    ),
    createArchitectureNode({
      id: 'boundary',
      kind: 'group',
      label: 'Boundary',
      position: { x: 0, y: 0 },
      size: { width: 1100, height: 350 },
      ports: [],
      architecture: { family: 'c4', role: 'software-system' },
    }),
    {
      id: 'plain',
      label: 'Legacy node',
      position: { x: 0, y: 420 },
      size: { width: 160, height: 100 },
      ports: [],
    },
  ],
  edges: [],
};
const initial = createEditor(graph);

async function render(
  state: EditorState = initial,
  options: ZlozC4NodeOptions<EditorEvent> = {},
  view: Partial<ZlozViewOptions<EditorEvent>> = {},
) {
  const result = await Effect.runPromise(
    renderToString(
      {
        Flags: Schema.Struct({}),
        init: () => ({ model: state }),
        view: (model, h: HtmlBuilder<EditorEvent>) => ({
          title: 'C4',
          body: zlozView(h, model, {
            id: 'c4',
            label: 'C4 diagram',
            onEvent: (event) => event,
            resizeHandles: true,
            renderNodeShell: (ctx, builder) => zlozC4Node(ctx, builder, options),
            renderGroupShell: (ctx, builder) => zlozC4Group(ctx, builder, options),
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

test('C4 presets render all four roles with core outlines, native controls and plain-node fallback', async () => {
  const document = await render();
  expect(document.querySelectorAll('[data-flow-c4-node]')).toHaveLength(4);
  expect(document.querySelectorAll('[data-flow-c4-group]')).toHaveLength(1);
  expect(document.querySelector('[data-flow-node="plain"]')?.textContent).toContain('Legacy node');
  expect(document.querySelector('[data-flow-c4-person]')).not.toBeNull();
  expect(document.querySelector('[data-flow-node="person"]')?.textContent).toContain(
    'Person · external',
  );
  expect(document.querySelector('[data-flow-node="component"]')?.textContent).toContain(
    'TypeScript',
  );
  const container = document.querySelector('[data-flow-node="container"]');
  expect(container?.querySelector('[data-flow-c4-outline]')?.getAttribute('d')).toBe(
    nodeShapeGeometry(graph.nodes[2]!).outlinePath,
  );
  expect(container?.querySelector('[data-flow-c4-cap]')).not.toBeNull();
  expect(container?.querySelector('[data-flow-c4-cap]')?.getAttribute('d')).toBe(
    nodeShapeGeometry(graph.nodes[2]!).decorationPaths[0],
  );
  expect(
    document.querySelector('[data-flow-c4-boundary-controls] button[aria-expanded]'),
  ).not.toBeNull();
  expect(container?.querySelector('[data-flow-port="out"]')?.getAttribute('style')).toContain(
    'top: 8%',
  );
  expect(container?.querySelector('[data-flow-handle]')?.getAttribute('aria-label')).toBe(
    'Select Named container',
  );
  expect(document.querySelectorAll('button button')).toHaveLength(0);
  expect(document.querySelectorAll('[data-flow-c4-body] [data-flow-port]')).toHaveLength(0);
});

test('C4 slots can omit or replace content while native control policies remain live and theme values remain scoped', async () => {
  for (const theme of [zlozLightTheme, zlozDarkTheme]) {
    const document = await render(
      initial,
      {
        renderTechnology: () => null,
        renderDescription: () => null,
        renderIcon: () => null,
        renderName: ({ node }, h) => h.strong([], [`Custom ${node.label}`]),
      },
      { theme, minimalMode: true, canConnectPort: () => 'Awaiting approval' },
    );
    expect(document.body.textContent).not.toContain('TypeScript');
    expect(document.body.textContent).not.toContain('A useful responsibility');
    expect(document.querySelector('[data-flow-c4-person]')).toBeNull();
    expect(document.body.textContent).toContain('Custom Named container');
    expect(document.querySelector('[data-flow-port]')?.hasAttribute('disabled')).toBe(true);
    expect(document.querySelector('[data-flow-port]')?.getAttribute('title')).toBe(
      'Awaiting approval',
    );
    expect(document.getElementById('c4')?.getAttribute('style')).toContain(
      `color-scheme: ${theme.colorScheme}`,
    );
    expect(document.querySelector('[data-flow-c4-outline]')?.getAttribute('fill')).toBe(
      'var(--flow-node-background, #fff)',
    );
  }
});

test('C4 body caching excludes ports and controls while source and read-only feedback stays live', async () => {
  const mutable: unknown[][] = [];
  const cache: ZlozNodeBodyCache = (_node, view, args) => {
    mutable.push(args.slice(1));
    return view(...args);
  };
  const options: ZlozC4NodeOptions<EditorEvent> = { bodyCache: cache };
  await render(initial, options);
  const before = mutable.slice();
  mutable.length = 0;
  const document = await render(
    { ...initial, readOnly: true, connection: { node: 'container', port: 'out' } },
    options,
  );
  expect(mutable).toEqual(before);
  expect(
    document
      .querySelector('[data-flow-owner="container"][data-flow-port]')
      ?.getAttribute('aria-pressed'),
  ).toBe('true');
  expect(document.querySelector('[data-flow-port]')?.hasAttribute('disabled')).toBe(true);
  expect(document.querySelector('[data-flow-resize]')).toBeNull();
  expect(document.querySelectorAll('[data-flow-c4-body] button')).toHaveLength(0);
});

test('preset chrome and content can be omitted while authored dimensions and native selection remain available', async () => {
  const document = await render(
    initial,
    {},
    {
      renderGroupShell: (context, h) => zlozC4Group({ ...context, dropTarget: true }, h),
      renderNodeShell: (context, h) =>
        zlozC4Node(context, h, {
          attributes: [h.Class('bespoke-c4'), h.Style({ color: 'rebeccapurple', height: '1px' })],
          renderBody: () => null,
          renderControls: () => [],
        }),
    },
  );
  const node = document.querySelector('[data-flow-node="container"]');
  expect(node?.querySelector('.bespoke-c4')?.getAttribute('style')).toContain('height: 200px');
  expect(node?.querySelector('.bespoke-c4')?.getAttribute('style')).toContain(
    'color: rebeccapurple',
  );
  expect(node?.querySelector('[data-flow-resize]')).toBeNull();
  expect(node?.querySelector('[data-flow-port]')).not.toBeNull();
  expect(node?.querySelector('[data-flow-handle]')?.getAttribute('aria-label')).toBe(
    'Select Named container',
  );
  expect(node?.querySelector('[data-flow-c4-outline]')).not.toBeNull();
  expect(document.querySelector('[data-flow-c4-group]')?.getAttribute('style')).toContain(
    '2px solid var(--flow-valid-target, #0f766e)',
  );
});
