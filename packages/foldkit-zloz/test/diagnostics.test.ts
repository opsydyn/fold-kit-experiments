import { expect, mock, test } from 'bun:test';

import type { View } from '@effect/ui';
import { Html } from '@effect/ui/html';
import { Window } from 'happy-dom';

import {
  canvasHelpContext,
  canvasStatusContext,
  graphSurface,
  historyMinimap,
  presentVisibleGraph,
  resolveConnectionList,
  resolveZlozDiagnostics,
  visuallyHidden,
  type GraphSurfaceOptions,
  type ZlozCanvasHelpContext,
  type ZlozCanvasStatusContext,
} from '../src/effect-ui';
import { createEditor, serializeGraph, updateEditor, type EditorState } from '../src/index';
import { renderEffectUi } from './render-effect-ui';

const initial = {
  ...createEditor(
    {
      nodes: [
        {
          id: 'g',
          label: 'Group',
          kind: 'group',
          ports: [],
          position: { x: 100, y: 100 },
          size: { width: 400, height: 200 },
        },
        {
          id: 'a',
          label: 'Source',
          parentId: 'g',
          position: { x: 150, y: 150 },
          size: { width: 100, height: 80 },
          ports: [{ id: 'out', kind: 'output', side: 'right', offset: 0.5 }],
        },
        {
          id: 'b',
          label: 'Target',
          position: { x: 603, y: 150 },
          size: { width: 100, height: 80 },
          ports: [{ id: 'in', kind: 'input', side: 'left', offset: 0.5 }],
        },
      ],
      edges: [
        {
          id: 'ab',
          label: 'Dependency',
          source: { node: 'a', port: 'out' },
          target: { node: 'b', port: 'in' },
        },
      ],
    },
    { snapToAlignment: true },
  ),
  surface: { width: 800, height: 440 },
};

type Options = Partial<GraphSurfaceOptions<string>> &
  Parameters<typeof resolveZlozDiagnostics>[0] & {
    renderCanvasHelp?: (context: ZlozCanvasHelpContext, h: Html.H<string>) => View.Content<string>;
    renderCanvasStatus?: (
      context: ZlozCanvasStatusContext,
      h: Html.H<string>,
    ) => View.Content<string>;
  };

async function render(state: EditorState, options: Options = {}) {
  const diagnostic = resolveZlozDiagnostics(options);
  const help = canvasHelpContext(state, options, false, diagnostic.instructions);
  const status = canvasStatusContext(
    state.notice,
    state.graph.nodes.length,
    state.graph.edges.length,
    diagnostic.status,
  );
  const connections = resolveConnectionList(state, presentVisibleGraph(state).edges, {
    id: 'diag-test',
    compact: !diagnostic.connectionList,
    toolbarEdgeId: undefined,
  });
  const result = await renderEffectUi((h) =>
    h.div.children(
      h.div
        .id('diag-test-help')
        .attr('data-flow-help', '')
        .style(help.visible ? {} : visuallyHidden)
        .children(options.renderCanvasHelp?.(help, h) ?? help.defaultText),
      h.p
        .attr('data-flow-status', '')
        .attr('role', 'status')
        .attr('aria-live', 'polite')
        .style(status.visible ? {} : visuallyHidden)
        .children(options.renderCanvasStatus?.(status, h) ?? status.defaultText),
      diagnostic.zoomLevel
        ? h.span.attr('data-flow-zoom-level', '').children(String(state.viewport.zoom))
        : null,
      diagnostic.overview ? historyMinimap(h, state, ({ type }) => type) : null,
      h.button
        .attr('data-flow-connections-toggle', '')
        .attr('aria-expanded', String(state.connectionsExpanded ?? false))
        .children('Connections'),
      diagnostic.connectionList || state.connectionsExpanded
        ? h.div
            .attr('data-flow-connections', '')
            .children(
              ...connections.entries.map((entry) =>
                h.button.attr('aria-label', entry.label).children(entry.label),
              ),
            )
        : null,
      graphSurface(h, state, {
        id: 'diag-test',
        label: 'Editor',
        descriptionId: 'diag-test-help',
        onInput: ({ type }) => type,
        resizeHandles: true,
        contextActions: { measurements: diagnostic.measurements, onEvent: ({ type }) => type },
        ...options,
        resizeReadout: options.resizeReadout ?? diagnostic.measurements,
        alignmentGuides: options.alignmentGuides ?? diagnostic.alignmentGuides,
      }),
    ),
  );
  const window = new Window();
  window.document.body.innerHTML = result.html;
  return window.document;
}

test('diagnostic defaults, individual flags and global minimal precedence are explicit', () => {
  const defaults = resolveZlozDiagnostics({});
  expect(Object.values(defaults).every(Boolean)).toBe(true);
  for (const key of Object.keys(defaults)) {
    const flags = resolveZlozDiagnostics({ diagnostics: { [key]: false } });
    expect(
      Object.entries(flags)
        .filter(([, value]) => !value)
        .map(([name]) => name),
    ).toEqual([key]);
  }
  expect(
    Object.values(resolveZlozDiagnostics({ diagnostics: false })).every((value) => !value),
  ).toBe(true);
  expect(
    Object.values(resolveZlozDiagnostics({ minimalMode: true, diagnostics: defaults })).every(
      (value) => !value,
    ),
  ).toBe(true);
});

test('minimal mode removes overlays and numbers while retaining accessible help and editing', async () => {
  const start = updateEditor(initial, {
    type: 'NodeResizeStarted',
    id: 'g',
    handle: 'right',
    pointer: 1,
    point: { x: 0, y: 0 },
  });
  const active = updateEditor(start, { type: 'PointerMoved', pointer: 1, point: { x: 101, y: 0 } });
  const before = serializeGraph(active.graph);
  const full = await render(active);
  for (const selector of [
    '[data-flow-resize-readout]',
    '[data-flow-alignment-guide]',
    '[data-flow-zoom-level]',
    '[data-flow-minimap]',
    '[data-flow-connections]',
  ])
    expect(full.querySelector(selector)).not.toBeNull();
  for (const options of [{ minimalMode: true }, { diagnostics: false }] as const) {
    const quiet = await render(active, options);
    for (const selector of [
      '[data-flow-resize-readout]',
      '[data-flow-alignment-guide]',
      '[data-flow-zoom-level]',
      '[data-flow-minimap]',
      '[data-flow-connections]',
    ])
      expect(quiet.querySelector(selector)).toBeNull();
    expect(quiet.querySelector('[data-flow-help]')?.getAttribute('style')).toContain(
      'position:absolute',
    );
    expect(quiet.querySelector('[data-flow-status]')?.getAttribute('aria-live')).toBe('polite');
    expect(quiet.querySelector('[data-flow-status]')?.getAttribute('style')).toContain(
      'position:absolute',
    );
    expect(quiet.querySelectorAll('[data-flow-group-resize]')).toHaveLength(8);
    expect(
      quiet.querySelector('[data-flow-connections-toggle]')?.getAttribute('aria-expanded'),
    ).toBe('false');
  }
  expect(serializeGraph(active.graph)).toBe(before);
  const individual = await render(active, { diagnostics: { measurements: false } });
  expect(individual.querySelector('[data-flow-resize-readout]')).toBeNull();
  expect(individual.querySelector('[data-flow-zoom-level]')).not.toBeNull();
  const opened = updateEditor(initial, {
    type: 'ContextOpened',
    context: { kind: 'node', id: 'g', point: { x: 0, y: 0 } },
  });
  expect((await render(opened)).querySelector('input[aria-label="Width of Group"]')).not.toBeNull();
  expect(
    (await render(opened, { minimalMode: true })).querySelector(
      'input[aria-label="Width of Group"]',
    ),
  ).toBeNull();
});

test('custom canvas copy keeps its accessible bindings when diagnostics hide it', async () => {
  const state = { ...initial, selectionMode: true, notice: 'Custom notice' };
  const options = {
    renderCanvasHelp: (context, h) => h.div.class('help-content').children(context.defaultText),
    renderCanvasStatus: (context, h) =>
      h.span.class('status-content').children(context.notice ?? context.defaultText),
  } satisfies Options;
  const visible = await render(state, options);
  const help = visible.querySelector('[data-flow-help]');
  expect(help?.querySelector('.help-content')?.textContent).toContain(
    'Drag the background to select nodes.',
  );
  expect(visible.querySelector('[data-flow-surface]')?.getAttribute('aria-describedby')).toBe(
    help?.id,
  );
  expect(visible.querySelector('[data-flow-handle="a"]')?.getAttribute('aria-describedby')).toBe(
    help?.id,
  );
  const quiet = await render(state, { ...options, minimalMode: true });
  const quietHelp = quiet.querySelector('[data-flow-help]');
  const quietStatus = quiet.querySelector('[data-flow-status]');
  expect(quietHelp?.id).toBe(help?.id ?? '');
  expect(quietHelp?.getAttribute('style')).toContain('position:absolute');
  expect(quietHelp?.querySelector('.help-content')?.textContent).toBe(help?.textContent ?? '');
  expect(quietStatus?.getAttribute('style')).toContain('position:absolute');
  expect(quietStatus?.getAttribute('role')).toBe('status');
  expect(quietStatus?.getAttribute('aria-live')).toBe('polite');
  expect(quietStatus?.querySelector('.status-content')?.textContent).toBe('Custom notice');
});

test('marquee preview highlights pending nodes without announcing them as selected', async () => {
  const state = { ...initial, boxSelectionMatch: 'partial', selectedNodes: ['b'] } as const;
  const start = updateEditor(state, {
    type: 'BoxSelectionStarted',
    pointer: 1,
    point: { x: 180, y: 170 },
  });
  const active = updateEditor(start, {
    type: 'PointerMoved',
    pointer: 1,
    point: { x: 140, y: 140 },
  });
  const options = {
    renderSelectionMarquee: (context, h) =>
      h.div.class('preview-ids').children(context.previewNodeIds.join(',')),
  } satisfies Options;
  const preview = await render(active, options);
  expect(
    preview.querySelector('[data-flow-node="a"]')?.getAttribute('data-flow-selection-preview'),
  ).toBe('true');
  expect(
    preview.querySelector('[data-flow-group="g"]')?.hasAttribute('data-flow-selection-preview'),
  ).toBe(false);
  expect(preview.querySelector('[data-flow-handle="a"]')?.getAttribute('aria-pressed')).toBe(
    'false',
  );
  expect(preview.querySelector('[data-flow-handle="b"]')?.getAttribute('aria-pressed')).toBe(
    'true',
  );
  expect(preview.querySelector('.preview-ids')?.textContent).toBe('a');
  const released = updateEditor(active, { type: 'PointerReleased', pointer: 1 });
  expect(released.selectedNodes).toEqual(['a']);
  expect(released.past).toBe(state.past);
  const committed = await render(released);
  expect(committed.querySelector('[data-flow-selection-preview]')).toBeNull();
  const hidden = await render(active, { ...options, selectionPreviewHighlights: false });
  expect(hidden.querySelector('[data-flow-selection-preview]')).toBeNull();
  expect(hidden.querySelector('.preview-ids')?.textContent).toBe('a');
  const cancelled = updateEditor(active, { type: 'GestureCancelled' });
  expect(cancelled.selectedNodes).toEqual(['b']);
  expect((await render(cancelled)).querySelector('[data-flow-selection-preview]')).toBeNull();
});

test('custom selection marquees use normalized world bounds in minimal mode', async () => {
  const state = { ...initial, viewport: { x: 20, y: 30, zoom: 2 } };
  const start = updateEditor(state, {
    type: 'BoxSelectionStarted',
    pointer: 1,
    point: { x: 320, y: 350 },
  });
  const active = updateEditor(start, { type: 'PointerMoved', pointer: 1, point: { x: 60, y: 70 } });
  const renderer = mock<NonNullable<GraphSurfaceOptions<string>['renderSelectionMarquee']>>(
    ({ bounds, viewport }, h) =>
      h.div
        .class('custom-marquee')
        .children(
          `${bounds.left},${bounds.top} → ${bounds.right},${bounds.bottom} at ${viewport.zoom}×`,
        ),
  );
  const options = {
    minimalMode: true,
    diagnostics: false,
    renderSelectionMarquee: renderer,
  } as const;
  const selector = '[data-flow-selection-box]';
  const marquee = (await render(active, options)).querySelector(selector);
  expect(marquee?.querySelector('.custom-marquee')?.textContent).toBe('20,20 → 150,160 at 2×');
  expect(marquee?.getAttribute('aria-hidden')).toBe('true');
  expect(marquee?.getAttribute('style')).toContain('width:130px');
  expect(marquee?.getAttribute('style')).toContain('height:140px');
  expect(marquee?.classList.contains('zloz-ui-marquee')).toBe(true);
  renderer.mockClear();
  expect((await render(state, options)).querySelector(selector)).toBeNull();
  expect(renderer).not.toHaveBeenCalled();
  expect(
    (await render(active, { renderSelectionMarquee: () => null })).querySelector(selector),
  ).toBeNull();
});

test('custom alignment guides receive resolved resize endpoints and respect diagnostics', async () => {
  const start = updateEditor(initial, {
    type: 'NodeResizeStarted',
    id: 'g',
    handle: 'right',
    pointer: 1,
    point: { x: 0, y: 0 },
  });
  const active = updateEditor(start, { type: 'PointerMoved', pointer: 1, point: { x: 101, y: 0 } });
  const renderer = mock<NonNullable<GraphSurfaceOptions<string>['renderAlignmentGuide']>>(
    ({ phase, start, end }) =>
      new Html.Element<string>('line')
        .attr('data-guide-phase', phase)
        .attr('x1', String(start.x))
        .attr('y1', String(start.y))
        .attr('x2', String(end.x))
        .attr('y2', String(end.y))
        .children(),
  );
  const document = await render(active, { renderAlignmentGuide: renderer });
  const line = document.querySelector(
    '[data-flow-alignment-guide="x"] [data-guide-phase="resize"]',
  );
  expect(line?.getAttribute('x1')).toBe('603');
  expect(line?.getAttribute('x2')).toBe('603');
  expect(line?.getAttribute('y1')).toBe('100');
  expect(line?.getAttribute('y2')).toBe('300');
  expect(line?.closest('svg')?.getAttribute('aria-hidden')).toBe('true');
  for (const flags of [
    { diagnostics: { alignmentGuides: false } },
    { diagnostics: false },
    { minimalMode: true },
  ] as const) {
    renderer.mockClear();
    const quiet = await render(active, { ...flags, renderAlignmentGuide: renderer });
    expect(quiet.querySelector('[data-flow-alignment-guide]')).toBeNull();
    expect(renderer).not.toHaveBeenCalled();
  }
  const omitted = await render(active, { renderAlignmentGuide: () => null });
  expect(omitted.querySelector('[data-flow-alignment-guide]')).toBeNull();
});

test('custom resize readouts receive Model dimensions and stay behind the diagnostics gates', async () => {
  const selected = updateEditor(initial, { type: 'NodeSelected', id: 'g', additive: false });
  const active = updateEditor(selected, {
    type: 'NodeResizeStarted',
    id: 'g',
    handle: 'right',
    pointer: 1,
    point: { x: 0, y: 0 },
  });
  const options = {
    renderResizeReadout: (context, h) =>
      h.span
        .class('custom-readout')
        .children(context.phase, context.widthText + ' by ' + context.heightText),
  } satisfies Options;
  const selector = '[data-flow-resize-readout="g"]';
  const activeReadout = (await render(active, options)).querySelector(selector);
  expect(activeReadout?.getAttribute('aria-live')).toBe('polite');
  expect(activeReadout?.querySelector('.custom-readout')?.textContent).toBe('resizing400 by 200');
  expect((await render(selected, options)).querySelector(selector)?.textContent).toBe(
    'selected-group400 by 200',
  );
  for (const flags of [
    { diagnostics: { measurements: false } },
    { diagnostics: false },
    { minimalMode: true },
    { resizeReadout: false },
  ] as const) {
    const renderResizeReadout = mock(options.renderResizeReadout);
    const document = await render(selected, { ...flags, renderResizeReadout });
    expect(document.querySelector(selector)).toBeNull();
    expect(renderResizeReadout).not.toHaveBeenCalled();
  }
  expect(
    (await render({ ...selected, readOnly: true }, options)).querySelector(selector),
  ).toBeNull();
  expect(
    (await render(selected, { renderResizeReadout: () => null })).querySelector(selector),
  ).toBeNull();
});

test('compact connection disclosure stays model-owned and available read-only without history', async () => {
  const state = { ...initial, readOnly: true };
  const expanded = updateEditor(state, { type: 'ConnectionListToggled' });
  expect(expanded.connectionsExpanded).toBe(true);
  expect(expanded.graph).toBe(state.graph);
  expect(expanded.past).toBe(state.past);
  expect(expanded.revision).toBe(state.revision);
  const doc = await render(expanded, { minimalMode: true });
  expect(doc.querySelector('[data-flow-connections-toggle]')?.getAttribute('aria-expanded')).toBe(
    'true',
  );
  expect(doc.querySelector('[data-flow-connections]')?.textContent).toContain('Dependency');
});

test('viewport culling preserves crossing edges and leaves the overview and connections complete', async () => {
  const state = {
    ...initial,
    graph: {
      ...initial.graph,
      edges: initial.graph.edges.map(({ label: _label, ...edge }) => edge),
    },
    surface: { width: 100, height: 100 },
    viewport: { x: -375, y: -140, zoom: 1 },
  };
  const document = await render(state, { viewportCulling: { overscan: 0 } });
  expect(document.querySelectorAll('[data-flow-node]:not([data-flow-group])')).toHaveLength(0);
  expect(document.querySelector('[data-flow-edge="ab"]')).not.toBeNull();
  expect(
    document.querySelectorAll('[data-flow-minimap] rect:not([data-flow-minimap-viewport])'),
  ).toHaveLength(3);
  expect(
    document.querySelector('[data-flow-connections] button[aria-label="a:out → b:in"]'),
  ).not.toBeNull();

  const away = { ...state, viewport: { x: 800, y: 800, zoom: 1 } };
  const unmeasured = await render({ ...away, surface: null }, { viewportCulling: true });
  expect(unmeasured.querySelectorAll('[data-flow-node]:not([data-flow-group])')).toHaveLength(2);
  const routed = await render(
    {
      ...away,
      routes: [
        {
          id: 'ab',
          points: [
            { x: 250, y: 190 },
            { x: -750, y: -750 },
            { x: 603, y: 190 },
          ],
        },
      ],
    },
    { viewportCulling: true },
  );
  expect(routed.querySelector('[data-flow-edge="ab"]')).not.toBeNull();
  const culled = await render(away, { viewportCulling: true });
  expect(culled.querySelector('[data-flow-edge="ab"]')).toBeNull();
  const focused = await render(
    { ...away, focusedNodeId: 'a', selectedEdges: ['ab'] },
    { viewportCulling: true },
  );
  expect(focused.querySelector('[data-flow-node="a"]')).not.toBeNull();
  expect(focused.querySelector('[data-flow-edge="ab"]')).not.toBeNull();

  const custom = await render(away, { viewportCulling: true, edgeGeometry: () => undefined });
  expect(custom.querySelector('[data-flow-edge="ab"]')).not.toBeNull();
});

test('viewport changes preserve visible membership until the camera crosses its bounds', async () => {
  const state = {
    ...initial,
    surface: { width: 180, height: 180 },
    viewport: { x: -100, y: -100, zoom: 1 },
  };
  const options = { viewportCulling: { overscan: 0 } };
  const first = await render(state, options);
  const nearby = await render({ ...state, viewport: { ...state.viewport, x: -110 } }, options);
  const shifted = await render({ ...state, viewport: { ...state.viewport, x: -560 } }, options);
  const membership = (document: typeof first) =>
    [...document.querySelectorAll('[data-flow-node]')].map((node) =>
      node.getAttribute('data-flow-node'),
    );
  expect(membership(first)).toContain('a');
  expect(membership(first)).not.toContain('b');
  expect(membership(nearby)).toEqual(membership(first));
  expect(membership(shifted)).not.toContain('a');
  expect(membership(shifted)).toContain('b');
});
