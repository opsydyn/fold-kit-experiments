import { expect, test } from 'bun:test';

import { Html, HtmlServer } from '@effect/ui/html';
import { Effect, Schema } from 'effect';
import { Window, type HTMLButtonElement, type HTMLDivElement, type HTMLElement } from 'happy-dom';

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

test('native edge editing presents protection and keeps read-only labels visible', async () => {
  const editor = createEditor({
    nodes: [
      {
        id: 'a',
        label: 'Orders',
        position: { x: 0, y: 0 },
        size: { width: 100, height: 80 },
        ports: [{ id: 'out', kind: 'output', side: 'right', offset: 0.5 }],
      },
      {
        id: 'b',
        label: 'Billing',
        position: { x: 250, y: 0 },
        size: { width: 100, height: 80 },
        ports: [{ id: 'in', kind: 'input', side: 'left', offset: 0.5 }],
      },
    ],
    edges: [
      {
        id: 'protected',
        label: 'Required link',
        source: { node: 'a', port: 'out' },
        target: { node: 'b', port: 'in' },
      },
    ],
  });
  const selected = updateEditor(editor, { type: 'EdgeSelected', id: 'protected', additive: false });
  const component = Html.component({
    name: 'NativeEdgePolicy',
    model: Schema.Null,
    message: Schema.String,
  }).make({
    init: () => null,
    update: ($) => $.model,
    view: (h) =>
      h.div(
        graphSurface(h, selected, {
          id: 'deletion-policy',
          label: 'Protected deletion',
          onInput: ({ type }) => type,
          edgeEditing: { toolbar: true, onEdit: ({ type }) => type },
          policy: { canDelete: () => 'Required link cannot be deleted.' },
        }),
        graphSurface(
          h,
          { ...selected, readOnly: true },
          {
            id: 'edge-inspection',
            label: 'Read-only inspection',
            onInput: ({ type }) => type,
            edgeEditing: { toolbar: true, onEdit: ({ type }) => type },
          },
        ),
      ),
  });
  const rendered = await Effect.runPromise(
    HtmlServer.renderToHtml(component, {}, { static: true }),
  );
  const { document } = new Window();
  document.body.innerHTML = rendered.html;
  const toolbar = document.querySelector(
    '#deletion-policy-surface [aria-label="Selected edge actions"]',
  );
  expect(toolbar?.querySelector('button[disabled]')?.textContent).toBe('Delete edge');
  expect(toolbar?.querySelector('small')?.textContent).toBe('Required link cannot be deleted.');
  expect(toolbar?.querySelector('button:not([disabled])')?.textContent).toBe('Rename');
  const inspection = document.querySelector('#edge-inspection-surface');
  expect(inspection?.querySelector('[data-zloz-edge-label]')?.textContent).toBe('Required link');
  expect(inspection?.querySelector('[data-zloz-edge-label] button')).toBeNull();
  expect(inspection?.querySelector('[aria-label="Selected edge actions"]')).toBeNull();
});

test('native port presentation keeps canonical anchors and input semantics', async () => {
  const node = {
    id: 'publish',
    label: 'Publish',
    position: { x: 30, y: 40 },
    size: { width: 100, height: 80 },
    ports: [
      { id: 'out', kind: 'output', side: 'right', offset: 0.25, label: 'Public' },
      { id: 'in', kind: 'input', side: 'left', offset: 0.5, label: 'Private' },
    ],
  } as const;
  const state = updateEditor(createEditor({ nodes: [node], edges: [] }), {
    type: 'NodeSelected',
    id: node.id,
    additive: false,
  });
  const component = Html.component({
    name: 'NativePortPresentation',
    model: Schema.Null,
    message: Schema.String,
  }).make({
    init: () => null,
    update: ($) => $.model,
    view: (h) =>
      graphSurface(h, state, {
        id: 'port-presentation',
        label: 'Native port presentation',
        renderPort: (context, h) =>
          context.port.id === 'out'
            ? {
                className: 'custom-socket',
                content: h.span.children(context.connectionEnd),
                style: { borderRadius: '5px' },
              }
            : undefined,
        portLabels: { offset: 22 },
        renderPortLabel: ({ port, label }, h) =>
          port.id === 'in' ? null : h.strong.children(label),
        portAnchors: {
          keyboardTargets: true,
          snapBypass: 'Alt',
          renderHandle: ({ port, anchor }) =>
            port.id === 'out' ? { content: String(anchor.y) } : undefined,
        },
        policy: {
          canEditPort: ({ port }) => (port.id === 'out' ? 'Port placement is protected.' : null),
          canConnectPort: ({ port }) => (port === 'in' ? 'Connection requires approval.' : null),
        },
        onInput: ({ type }) => type,
      }),
  });
  const rendered = await Effect.runPromise(
    HtmlServer.renderToHtml(component, {}, { static: true }),
  );
  const { document } = new Window();
  document.body.innerHTML = rendered.html;
  const socket = document.querySelector<HTMLButtonElement>('.custom-socket');
  expect(socket?.getAttribute('data-flow-port')).toBe('out');
  expect(socket?.getAttribute('data-flow-connection-end')).toBe('source');
  expect(socket?.style.left).toBe('100px');
  expect(socket?.style.top).toBe('20px');
  expect(socket?.textContent).toBe('source');
  expect(socket?.disabled).toBe(false);
  expect(document.querySelector('[data-flow-port="in"]')?.getAttribute('title')).toBe(
    'Connection requires approval.',
  );
  const label = document.querySelector<HTMLElement>('[data-flow-port-label="out"]');
  expect(label?.getAttribute('aria-hidden')).toBe('true');
  expect(label?.style.pointerEvents).toBe('none');
  expect(label?.style.left).toBe('152px');
  expect(label?.style.top).toBe('60px');
  expect(label?.querySelector('strong')?.textContent).toBe('Public');
  expect(document.querySelector('[data-flow-port-label="in"]')).toBeNull();
  const handle = document.querySelector<HTMLButtonElement>('[data-flow-anchor-port="out"]');
  expect(handle?.disabled).toBe(true);
  expect(handle?.textContent).toBe('0.25');
  expect(handle?.getAttribute('title')).toBe('Port placement is protected.');
  expect(handle?.getAttribute('aria-keyshortcuts')).toBe('PageDown PageUp Home End');
  expect(document.querySelector('[data-flow-anchor-port="in"]')?.getAttribute('title')).toContain(
    'Hold Alt to bypass snapping. Arrow keys move 1%',
  );
});

test('native custom guides receive only the editor’s acquired snap targets', async () => {
  const state = updateEditor(
    createEditor({
      nodes: [
        {
          id: 'draft',
          label: 'Draft',
          position: { x: 30, y: 40 },
          size: { width: 100, height: 80 },
          ports: [{ id: 'out', kind: 'output', side: 'right', offset: 0.5 }],
        },
      ],
      edges: [],
    }),
    {
      type: 'PortAnchorDragStarted',
      endpoint: { node: 'draft', port: 'out' },
      pointer: 1,
      point: { x: 148, y: 62 },
    },
    {
      portAnchorSnap: () => ({
        allowedEdges: [],
        allowedCorners: [],
        allowedMidpoints: ['right'],
        midpointDistance: 18,
      }),
    },
  );
  const component = Html.component({
    name: 'NativeGuidePresentation',
    model: Schema.Null,
    message: Schema.String,
  }).make({
    init: () => null,
    update: ($) => $.model,
    view: (h) =>
      graphSurface(h, state, {
        id: 'guide-presentation',
        label: 'Native guide presentation',
        portAnchors: {
          guides: true,
          renderGuide: ({ start }) =>
            new Html.Element<string>('circle')
              .attr('data-custom-guide', '')
              .attr('cx', String(start.x))
              .attr('cy', String(start.y))
              .attr('r', '3')
              .children(),
        },
        onInput: ({ type }) => type,
      }),
  });
  const rendered = await Effect.runPromise(
    HtmlServer.renderToHtml(component, {}, { static: true }),
  );
  const { document } = new Window();
  document.body.innerHTML = rendered.html;
  expect(document.querySelectorAll('[data-flow-anchor-guide]')).toHaveLength(1);
  const mark = document.querySelector(
    '[data-flow-anchor-guide-target="right"] [data-custom-guide]',
  );
  expect(mark?.namespaceURI).toBe('http://www.w3.org/2000/svg');
  expect(mark?.getAttribute('cx')).toBe('130');
  expect(mark?.getAttribute('cy')).toBe('80');
  expect(document.querySelector('[data-flow-anchor-guides]')?.getAttribute('aria-hidden')).toBe(
    'true',
  );
});

test('native custom edge artwork shares geometry with its hit area and label', async () => {
  const state = createEditor({
    nodes: [
      {
        id: 'a',
        label: 'A',
        position: { x: 10, y: 10 },
        size: { width: 100, height: 80 },
        ports: [{ id: 'out', kind: 'output', side: 'right', offset: 0.5 }],
      },
      {
        id: 'b',
        label: 'B',
        position: { x: 310, y: 10 },
        size: { width: 100, height: 80 },
        ports: [{ id: 'in', kind: 'input', side: 'left', offset: 0.5 }],
      },
    ],
    edges: [
      {
        id: 'link',
        label: 'Link',
        source: { node: 'a', port: 'out' },
        target: { node: 'b', port: 'in' },
      },
    ],
  });
  const dragging = updateEditor(
    updateEditor(state, {
      type: 'ConnectionDragStarted',
      endpoint: { node: 'a', port: 'out' },
      pointer: 1,
      point: { x: 110, y: 50 },
    }),
    {
      type: 'PointerMoved',
      pointer: 1,
      point: { x: 310, y: 50 },
      target: { node: 'b', port: 'in' },
    },
  );
  const component = Html.component({
    name: 'NativeEdgeArtwork',
    model: Schema.Null,
    message: Schema.String,
  }).make({
    init: () => null,
    update: ($) => $.model,
    view: (h) =>
      graphSurface(h, dragging, {
        id: 'edge-artwork',
        label: 'Edge artwork',
        dropRadius: 24,
        reconnectionDropRadius: 0,
        edgeGeometry: ({ source, target }) => ({
          path: `M${source.x},${source.y} Q210,-50 ${target.x},${target.y}`,
          labelPosition: { x: 210, y: 0 },
        }),
        edgeAppearance: () => ({ hitWidth: 18, dashArray: '6 2' }),
        renderEdge: ({ path, dashArray }) =>
          new Html.Element<string>('path')
            .attr('data-custom-edge', '')
            .attr('d', path)
            .attr('stroke-dasharray', dashArray)
            .children(),
        connectionGeometry: ({ source, target }) => ({
          path: `M${source.x},${source.y} L${target.x},${target.y}`,
          labelPosition: undefined,
        }),
        renderConnection: ({ path, feedback }) =>
          new Html.Element<string>('path')
            .attr('data-custom-preview', feedback.type)
            .attr('d', path)
            .children(),
        onInput: ({ type }) => type,
      }),
  });
  const rendered = await Effect.runPromise(
    HtmlServer.renderToHtml(component, {}, { static: true }),
  );
  const { document } = new Window();
  document.body.innerHTML = rendered.html;
  const surface = document.querySelector('[data-flow-surface]');
  expect(surface?.getAttribute('data-flow-connection-drop-radius')).toBe('24');
  expect(surface?.getAttribute('data-flow-reconnection-drop-radius')).toBe('0');
  const path = 'M110,50 Q210,-50 310,50';
  const painted = document.querySelector('[data-custom-edge]');
  const hit = document.querySelector('[data-flow-edge="link"]');
  expect(painted?.getAttribute('d')).toBe(path);
  expect(painted?.getAttribute('stroke-dasharray')).toBe('6 2');
  expect(hit?.getAttribute('d')).toBe(path);
  expect(hit?.getAttribute('stroke-width')).toBe('18');
  expect(hit?.getAttribute('stroke')).toBe('transparent');
  expect(document.querySelector<HTMLDivElement>('.zloz-ui-edge-label')?.style.top).toBe('0px');
  const preview = document.querySelector('[data-flow-connection-preview]');
  expect(preview?.getAttribute('aria-hidden')).toBe('true');
  expect(preview?.getAttribute('data-flow-connection-state')).toBe('invalid');
  expect(preview?.querySelector('[data-custom-preview="invalid"]')?.getAttribute('d')).toBe(
    'M110,50 L310,50',
  );
});

test('native node shells retain core controls and keep focused nodes through culling', async () => {
  const createNode = (id: string, x: number) => ({
    id,
    label: id,
    position: { x, y: 40 },
    size: { width: 100, height: 80 },
    ports: [{ id: 'out', kind: 'output' as const, side: 'right' as const, offset: 0.5 }],
  });
  const state = updateEditor(
    createEditor({
      nodes: [
        { ...createNode('Locked', 160), parentId: 'Group' },
        { ...createNode('Group', 160), kind: 'group', ports: [] },
        createNode('Focused', 400),
        createNode('Offscreen', 600),
        createNode('Unselectable', 280),
      ],
      edges: [],
    }),
    { type: 'SurfaceMeasured', size: { width: 360, height: 200 } },
  );
  const focused = updateEditor(state, { type: 'NodeFocusChanged', id: 'Focused' });
  const component = Html.component({
    name: 'NativeCustomShell',
    model: Schema.Null,
    message: Schema.String,
  }).make({
    init: () => null,
    update: ($) => $.model,
    view: (h) =>
      graphSurface(h, focused, {
        id: 'node-shells',
        label: 'Node shells',
        viewportCulling: { overscan: 0 },
        onInput: ({ type }) => type,
        onToggleGroup: () => 'collapse',
        renderNodeShell: ({ node }, h) => ({
          className: 'custom-node',
          style: { left: '0px', padding: '0px' },
          title: { content: h.strong.children(node.label) },
        }),
        renderGroupShell: ({ collapsed }, h) => ({
          className: 'custom-group',
          body: h.span.children(collapsed ? 'Collapsed artwork' : 'Expanded artwork'),
        }),
        policy: {
          canMoveNode: ({ id }) => (id === 'Locked' ? 'Movement is protected.' : null),
          canSelectNode: ({ id }) => (id === 'Unselectable' ? 'Selection is protected.' : null),
        },
      }),
  });
  const rendered = await Effect.runPromise(
    HtmlServer.renderToHtml(component, {}, { static: true }),
  );
  const { document } = new Window();
  document.body.innerHTML = rendered.html;
  expect(document.querySelector('[data-flow-node="Offscreen"]')).toBeNull();
  const focusedFrame = document.querySelector<HTMLDivElement>('[data-flow-node="Focused"]');
  expect(focusedFrame?.classList.contains('custom-node')).toBe(true);
  expect(focusedFrame?.style.left).toBe('400px');
  expect(focusedFrame?.querySelector('[data-flow-handle] strong')?.textContent).toBe('Focused');
  const locked = document.querySelector<HTMLButtonElement>('[data-flow-handle="Locked"]');
  expect(locked?.disabled).toBe(false);
  expect(locked?.hasAttribute('data-flow-move-locked')).toBe(true);
  expect(locked?.getAttribute('title')).toBe('Movement is protected.');
  expect(
    document.querySelector<HTMLButtonElement>('[data-flow-handle="Unselectable"]')?.disabled,
  ).toBe(true);
  const lockedGroup = document.querySelector<HTMLButtonElement>('[data-flow-handle="Group"]');
  expect(lockedGroup?.disabled).toBe(false);
  expect(lockedGroup?.getAttribute('title')).toBe('Movement is protected.');
  expect(
    document.querySelector('[data-flow-node="Group"]')?.classList.contains('custom-group'),
  ).toBe(true);
  expect(document.querySelector('[data-flow-node="Group"]')?.textContent).toContain(
    'Expanded artwork',
  );
  expect(
    document.querySelector('[aria-label="Collapse Group"]')?.getAttribute('aria-expanded'),
  ).toBe('true');
  expect(
    focusedFrame?.querySelector('[data-flow-port="out"]')?.getAttribute('data-flow-owner'),
  ).toBe('Focused');
});
