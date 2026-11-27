import { expect, test } from 'bun:test';

import { Html, HtmlServer } from '@effect/ui/html';
import { Effect, Schema } from 'effect';
import { Window } from 'happy-dom';

import { createEditor, updateEditor } from '../src/editor';
import { graphSurface } from '../src/effect-ui';

test('native resize handles follow live resize and selection policy', async () => {
  const editor = createEditor({
    nodes: [
      {
        id: 'open',
        label: 'Open',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 80 },
        ports: [],
      },
      {
        id: 'locked',
        label: 'Locked',
        position: { x: 200, y: 0 },
        size: { width: 100, height: 80 },
        ports: [],
      },
      {
        id: 'group',
        kind: 'group',
        label: 'Group',
        position: { x: 400, y: 0 },
        size: { width: 150, height: 120 },
        ports: [],
      },
    ],
    edges: [],
  });
  const selected = updateEditor(editor, { type: 'NodeSelected', id: 'group', additive: false });
  const component = Html.component({
    name: 'NativeResizePolicy',
    model: Schema.Null,
    message: Schema.String,
  }).make({
    init: () => null,
    update: ($) => $.model,
    view: (h) =>
      graphSurface(h, selected, {
        id: 'native-resize-policy',
        label: 'Resize policy',
        resizeHandles: true,
        onInput: ({ type }) => type,
        policy: {
          canResizeNode: ({ id }) => (id === 'locked' ? 'Size is protected.' : null),
          canSelectNode: ({ id }) => (id === 'group' ? 'The selection was revoked.' : null),
        },
      }),
  });
  const rendered = await Effect.runPromise(
    HtmlServer.renderToHtml(component, {}, { static: true }),
  );
  const { document } = new Window();
  document.body.innerHTML = rendered.html;
  expect(document.querySelector('[data-flow-resize="open"]')?.getAttribute('aria-label')).toBe(
    'Resize Open',
  );
  expect(document.querySelector('[data-flow-resize="locked"]')).toBeNull();
  expect(document.querySelector('[data-flow-resize="group"]')).toBeNull();
});

test('native geometry controls expose protection without disabling the connection socket', async () => {
  const editor = createEditor({
    nodes: [
      {
        id: 'published',
        label: 'Published',
        position: { x: 10, y: 10 },
        size: { width: 100, height: 80 },
        ports: [{ id: 'out', kind: 'output', side: 'right', offset: 0.5 }],
      },
      {
        id: 'consumer',
        label: 'Consumer',
        position: { x: 250, y: 10 },
        size: { width: 100, height: 80 },
        ports: [{ id: 'in', kind: 'input', side: 'left', offset: 0.5 }],
      },
    ],
    edges: [
      {
        id: 'connection',
        source: { node: 'published', port: 'out' },
        target: { node: 'consumer', port: 'in' },
        waypoints: [{ id: 'bend', position: { x: 160, y: 70 } }],
      },
    ],
  });
  const nodeSelected = updateEditor(editor, {
    type: 'NodeSelected',
    id: 'published',
    additive: false,
  });
  const selected = updateEditor(nodeSelected, {
    type: 'EdgeSelected',
    id: 'connection',
    additive: true,
  });
  const component = Html.component({
    name: 'NativeGeometryPolicy',
    model: Schema.Null,
    message: Schema.String,
  }).make({
    init: () => null,
    update: ($) => $.model,
    view: (h) =>
      graphSurface(h, selected, {
        id: 'geometry-policy',
        label: 'Geometry policy',
        portAnchors: {},
        edgeWaypoints: { onEdit: ({ type }) => type },
        onInput: ({ type }) => type,
        policy: {
          canEditPort: () => 'Published port position is protected.',
          canChangeEdgeWaypoints: () => 'Routing is protected.',
        },
      }),
  });
  const rendered = await Effect.runPromise(
    HtmlServer.renderToHtml(component, {}, { static: true }),
  );
  const { document } = new Window();
  document.body.innerHTML = rendered.html;
  const anchor = document.querySelector('[data-flow-anchor-port="out"]');
  expect(anchor?.hasAttribute('disabled')).toBe(true);
  expect(anchor?.getAttribute('title')).toBe('Published port position is protected.');
  expect(document.querySelector('[data-flow-port="out"]')?.hasAttribute('disabled')).toBe(false);
  const handle = document.querySelector('[data-flow-waypoint="bend"]');
  expect(handle?.hasAttribute('disabled')).toBe(true);
  expect(handle?.getAttribute('title')).toBe('Routing is protected.');
  expect(document.querySelector('[data-flow-waypoint-actions] [role="status"]')?.textContent).toBe(
    'Routing is protected.',
  );
  expect(document.querySelectorAll('[data-flow-waypoint-actions] button:disabled')).toHaveLength(3);
});

test('native marquee customization receives world geometry and keeps highlight policy independent', async () => {
  const editor = createEditor(
    {
      nodes: [
        {
          id: 'selected',
          label: 'Selected',
          position: { x: 30, y: 40 },
          size: { width: 50, height: 60 },
          ports: [],
        },
      ],
      edges: [],
    },
    { viewport: { x: 20, y: 30, zoom: 2 } },
  );
  const started = updateEditor(editor, {
    type: 'BoxSelectionStarted',
    pointer: 1,
    point: { x: 220, y: 250 },
  });
  const dragging = updateEditor(started, {
    type: 'PointerMoved',
    pointer: 1,
    point: { x: 40, y: 70 },
  });
  const component = Html.component({
    name: 'NativeCustomMarquee',
    model: Schema.Null,
    message: Schema.String,
  }).make({
    init: () => null,
    update: ($) => $.model,
    view: (h) =>
      h.div(
        graphSurface(h, dragging, {
          id: 'custom-marquee',
          label: 'Custom marquee',
          selectionPreviewHighlights: false,
          renderSelectionMarquee: ({ bounds, previewNodeIds, viewport }, builder) =>
            builder.span.children(
              `${bounds.left},${bounds.top},${bounds.right},${bounds.bottom}@${viewport.zoom}: ${previewNodeIds.join(',')}`,
            ),
          onInput: ({ type }) => type,
        }),
        graphSurface(h, dragging, {
          id: 'hidden-marquee',
          label: 'Hidden marquee',
          renderSelectionMarquee: () => null,
          onInput: ({ type }) => type,
        }),
      ),
  });
  const rendered = await Effect.runPromise(
    HtmlServer.renderToHtml(component, {}, { static: true }),
  );
  const { document } = new Window();
  document.body.innerHTML = rendered.html;
  const custom = document.querySelector('#custom-marquee-surface');
  const hidden = document.querySelector('#hidden-marquee-surface');
  expect(custom?.querySelector('[data-flow-selection-box]')?.textContent).toBe(
    '10,20,100,110@2: selected',
  );
  expect(custom?.querySelector('[data-selection-preview="true"]')).toBeNull();
  expect(hidden?.querySelector('[data-flow-selection-box]')).toBeNull();
  expect(
    hidden?.querySelector('[data-selection-preview="true"]')?.getAttribute('data-flow-node'),
  ).toBe('selected');
});
