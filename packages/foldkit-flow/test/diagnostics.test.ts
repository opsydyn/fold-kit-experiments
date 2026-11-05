import { expect, test } from 'bun:test';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
import { Window } from 'happy-dom';

import { flowView, resolveFlowDiagnostics, type FlowDiagnosticOptions } from '../src/foldkit';
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

async function render(state: EditorState, options: FlowDiagnosticOptions = {}) {
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
