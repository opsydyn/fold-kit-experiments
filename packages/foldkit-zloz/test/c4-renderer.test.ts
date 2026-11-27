/* oxlint-disable anti-slop/no-shape-in-symbol-names -- Geometric node shapes are domain concepts here, not structural placeholders. */
import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import { Html, HtmlServer } from '@effect/ui/html';
import { Effect, Schema } from 'effect';
import { Window } from 'happy-dom';

import {
  graphSurface,
  zlozLightTheme,
  zlozDarkTheme,
  type GraphSurfaceOptions,
  type NativeNotationContext,
  type NativeNotationParts,
} from '../src/effect-ui';
import {
  createEditor,
  createArchitectureNode,
  nodeShapeGeometry,
  type ZlozGraph,
  type EditorState,
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
  parts: NativeNotationParts<string> = {},
  view: Partial<GraphSurfaceOptions<string>> = {},
) {
  const component = Html.component({
    name: 'C4Test',
    model: Schema.Null,
    message: Schema.String,
  }).make({
    init: () => null,
    update: () => null,
    view: (h) =>
      graphSurface(h, state, {
        id: 'c4',
        label: 'C4 diagram',
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
  expect(document.querySelector('[data-flow-c4-group] button[aria-expanded]')).not.toBeNull();
  expect(container?.querySelector('[data-flow-port="out"]')?.getAttribute('style')).toMatch(
    /top:\s*8%/u,
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
        renderName: ({ node }, h) => h.strong.children(`Custom ${node.label}`),
      },
      { theme, policy: { canConnectPort: () => 'Awaiting approval' } },
    );
    expect(document.body.textContent).not.toContain('TypeScript');
    expect(document.body.textContent).not.toContain('A useful responsibility');
    expect(document.querySelector('[data-flow-c4-person]')).toBeNull();
    expect(document.body.textContent).toContain('Custom Named container');
    expect(document.querySelector('[data-flow-port]')?.hasAttribute('disabled')).toBe(true);
    expect(document.querySelector('[data-flow-port]')?.getAttribute('title')).toBe(
      'Awaiting approval',
    );
    expect(document.getElementById('c4-surface')?.getAttribute('style')).toContain(
      `color-scheme:${theme.colorScheme}`,
    );
    expect(document.querySelector('[data-flow-c4-outline]')?.getAttribute('stroke-dasharray')).toBe(
      '6 4',
    );
  }
});

test('C4 artwork receives authored context while source and read-only feedback stay live', async () => {
  const calls: NativeNotationContext[] = [];
  const parts: NativeNotationParts<string> = {
    renderBody(context) {
      calls.push(context);
    },
  };
  await render(initial, parts);
  const before = calls.splice(0);
  const document = await render(
    { ...initial, readOnly: true, connection: { node: 'container', port: 'out' } },
    parts,
  );
  expect(calls).toEqual(before);
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
    { ...initial, connection: { node: 'container', port: 'out' } },
    { renderBody: () => null },
    {
      nodeContextAction: () => 'Open node actions',
      renderNodeShell: () => ({
        className: 'bespoke-c4',
        style: { color: 'rebeccapurple', height: '1px' },
        controls: false,
      }),
    },
  );
  const node = document.querySelector('[data-flow-node="container"]');
  expect(node?.getAttribute('style')).toContain('height:200px');
  expect(node?.getAttribute('style')).toContain('color:rebeccapurple');
  expect(node?.querySelector('[data-flow-resize]')).toBeNull();
  expect(node?.querySelector('[data-flow-port]')?.getAttribute('aria-pressed')).toBe('true');
  expect(node?.querySelector('[aria-label="More actions for Named container"]')).toBeNull();
  expect(node?.querySelector('[data-flow-handle]')?.getAttribute('aria-label')).toBe(
    'Select Named container',
  );
  expect(node?.querySelector('[data-flow-c4-outline]')).not.toBeNull();
  expect(node?.classList.contains('bespoke-c4')).toBe(true);
  expect(node?.querySelector('[data-flow-c4-body]')).toBeNull();
});

test('declared group header geometry composes custom content and keeps compact collapsed headings', async () => {
  const node = graph.nodes.find((n) => n.id === 'boundary');
  assert(node);
  const state = createEditor({ nodes: [node], edges: [] });
  const groupHeader = {
    id: node.id,
    size: { width: 600, height: 112 },
    padding: { top: 24, right: 24, bottom: 24, left: 24 },
    gap: 24,
  };
  const parts: NativeNotationParts<string> = {
    renderBody: (_, h) =>
      h.span.attr('data-custom-group-heading', '').children('Custom architecture heading'),
  };
  const document = await render(state, parts, { groupHeader: () => groupHeader });
  const header = document.querySelector('[data-zloz-group-header]');
  expect(header?.getAttribute('style')).toContain('width:600px');
  expect(header?.getAttribute('style')).toContain('height:112px');
  expect(header?.getAttribute('style')).toContain('left:24px');
  expect(header?.getAttribute('style')).toContain('top:24px');
  expect(header?.textContent).toContain('Custom architecture heading');
  const intrinsic = await render(state, parts, {
    groupHeader: () => ({ ...groupHeader, sizing: 'intrinsic' }),
  });
  expect(intrinsic.querySelector('[data-zloz-group-header]')?.getAttribute('style')).toContain(
    'width:max-content',
  );
  expect(intrinsic.querySelector('[data-zloz-group-header]')?.getAttribute('style')).toContain(
    'height:max-content',
  );
  const collapsed = await render({ ...state, collapsedGroups: [node.id] }, parts, {
    groupHeader: () => groupHeader,
  });
  expect(collapsed.querySelector('[data-zloz-group-header]')).toBeNull();
  expect(collapsed.querySelector('[data-custom-group-heading]')).not.toBeNull();
});
