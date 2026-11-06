import { expect, mock, test } from 'bun:test';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
import { Window } from 'happy-dom';

import { flowView, resolveFlowDiagnostics, type FlowViewOptions } from '../src/foldkit';
import {
  createEditor,
  serializeGraph,
  updateEditor,
  type EditorEvent,
  type EditorState,
} from '../src/index';

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

async function render(state: EditorState, options: Partial<FlowViewOptions<EditorEvent>> = {}) {
  const result = await Effect.runPromise(
    renderToString(
      {
        Flags: Schema.Struct({}),
        init: () => ({ model: state }),
        view: (model, h: HtmlBuilder<EditorEvent>) => ({
          title: 'Diagnostics',
          body: flowView(h, model, {
            id: 'diag-test',
            label: 'Editor',
            onEvent: (event) => event,
            resizeHandles: true,
            contextActions: true,
            minimap: true,
            viewportControls: true,
            ...options,
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

test('diagnostic defaults, individual flags and global minimal precedence are explicit', () => {
  const defaults = resolveFlowDiagnostics({});
  expect(Object.values(defaults).every(Boolean)).toBe(true);
  for (const key of Object.keys(defaults)) {
    const flags = resolveFlowDiagnostics({ diagnostics: { [key]: false } });
    expect(
      Object.entries(flags)
        .filter(([, value]) => !value)
        .map(([name]) => name),
    ).toEqual([key]);
  }
  expect(
    Object.values(resolveFlowDiagnostics({ diagnostics: false })).every((value) => !value),
  ).toBe(true);
  expect(
    Object.values(resolveFlowDiagnostics({ minimalMode: true, diagnostics: defaults })).every(
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
      'position: absolute',
    );
    expect(quiet.querySelector('[data-flow-status]')?.getAttribute('aria-live')).toBe('polite');
    expect(quiet.querySelector('[data-flow-status]')?.getAttribute('style')).toContain(
      'position: absolute',
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
    renderCanvasHelp: (context, h) => h.div([h.Class('help-content')], [context.defaultText]),
    renderCanvasStatus: (context, h) =>
      h.span([h.Class('status-content')], [context.notice ?? context.defaultText]),
  } satisfies Partial<FlowViewOptions<EditorEvent>>;
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
  expect(quietHelp?.getAttribute('style')).toContain('position: absolute');
  expect(quietHelp?.querySelector('.help-content')?.textContent).toBe(help?.textContent ?? '');
  expect(quietStatus?.getAttribute('style')).toContain('position: absolute');
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
      h.div([h.Class('preview-ids')], [context.previewNodeIds.join(',')]),
  } satisfies Partial<FlowViewOptions<EditorEvent>>;
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
  const renderer = mock<NonNullable<FlowViewOptions<EditorEvent>['renderSelectionMarquee']>>(
    ({ bounds, viewport }, h) =>
      h.div(
        [h.Class('custom-marquee')],
        [`${bounds.left},${bounds.top} → ${bounds.right},${bounds.bottom} at ${viewport.zoom}×`],
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
  expect(marquee?.getAttribute('style')).toContain('width: 130px');
  expect(marquee?.getAttribute('style')).toContain('height: 140px');
  expect(marquee?.getAttribute('style')).toContain('pointer-events: none');
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
  const renderer = mock<NonNullable<FlowViewOptions<EditorEvent>['renderAlignmentGuide']>>(
    ({ phase, start, end }, h) =>
      h.line(
        [
          h.DataAttribute('guide-phase', phase),
          h.X1(String(start.x)),
          h.Y1(String(start.y)),
          h.X2(String(end.x)),
          h.Y2(String(end.y)),
        ],
        [],
      ),
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
      h.span(
        [h.Class('custom-readout')],
        [context.phase, context.widthText + ' by ' + context.heightText],
      ),
  } satisfies Partial<FlowViewOptions<EditorEvent>>;
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
