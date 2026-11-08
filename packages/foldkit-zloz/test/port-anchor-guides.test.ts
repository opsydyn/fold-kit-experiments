import { expect, test } from 'bun:test';

import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
import { Window } from 'happy-dom';

import { zlozView, type ZlozViewOptions } from '../src/foldkit';
import * as Zloz from '../src/index';
import type { EditorEvent, EditorState } from '../src/index';

const initial = () => ({
  ...Zloz.createEditor({
    nodes: [
      {
        id: 'n',
        label: 'N',
        position: { x: 20, y: 30 },
        size: { width: 200, height: 100 },
        ports: [{ id: 'p', kind: 'input', side: 'left', offset: 0.5 }],
      },
    ],
    edges: [],
  }),
  selectedNodes: ['n'],
});
const start: EditorEvent = {
  type: 'PortAnchorDragStarted',
  endpoint: { node: 'n', port: 'p' },
  pointer: 1,
  point: { x: 0, y: 0 },
};
const begun = () =>
  Zloz.updateEditor(initial(), start, {
    portAnchorSnap: () => ({
      distance: 12,
      cornerDistance: 12,
      midpointDistance: 18,
      allowedEdges: [],
      allowedCorners: [],
      allowedMidpoints: ['left', 'right'],
    }),
  });
async function render(state: EditorState, options: Partial<ZlozViewOptions<EditorEvent>> = {}) {
  const result = await Effect.runPromise(
    renderToString(
      {
        Flags: Schema.Struct({}),
        init: () => ({ model: state }),
        view: (model, h: HtmlBuilder<EditorEvent>) => ({
          title: 'Guides',
          body: zlozView(h, model, {
            id: 'guides',
            label: 'Guides',
            onEvent: (event) => event,
            portAnchorHandles: true,
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

test('guide enumeration shares canonical targets and includes only allowed kinds with positive radii', () => {
  expect(Zloz.portAnchorSnapGuideTargets({})).toEqual([]);
  expect(
    Zloz.portAnchorSnapGuideTargets({ distance: 12, cornerDistance: 12, midpointDistance: 12 }),
  ).toHaveLength(12);
  expect(
    Zloz.portAnchorSnapGuideTargets({
      distance: 12,
      cornerDistance: 12,
      midpointDistance: 18,
      allowedEdges: [],
      allowedCorners: [],
      allowedMidpoints: ['left', 'right'],
    }),
  ).toEqual([
    { type: 'midpoint', side: 'left', point: { x: 0, y: 0.5 } },
    { type: 'midpoint', side: 'right', point: { x: 1, y: 0.5 } },
  ]);
  expect(Zloz.portAnchorSnapGuideTargets({ distance: 12, allowedEdges: ['top'] })).toEqual([
    { type: 'edge', side: 'top', start: { x: 0, y: 0 }, end: { x: 1, y: 0 } },
  ]);
  expect(
    Zloz.portAnchorSnapGuideTargets({ cornerDistance: 12, allowedCorners: ['bottom-right'] }),
  ).toEqual([{ type: 'corner', corner: 'bottom-right', point: { x: 1, y: 1 } }]);
});

test('guides are opt-in, transient, noninteractive and use captured settings without changing the document', async () => {
  const state = begun();
  const graph = Zloz.serializeGraph(state.graph);
  expect((await render(state)).querySelector('[data-flow-anchor-guides]')).toBeNull();
  expect(
    (await render(initial(), { portAnchorGuides: true })).querySelector(
      '[data-flow-anchor-guides]',
    ),
  ).toBeNull();
  const document = await render(state, { portAnchorGuides: true });
  expect(document.querySelectorAll('[data-flow-anchor-guide]')).toHaveLength(2);
  const layer = document.querySelector('[data-flow-anchor-guides]');
  expect(layer?.getAttribute('aria-hidden')).toBe('true');
  expect(layer?.hasAttribute('inert')).toBe(true);
  expect(layer?.getAttribute('style')).toContain('pointer-events: none');
  const left = document.querySelector('[data-flow-anchor-guide-target="left"] circle');
  expect(left?.getAttribute('cx')).toBe('20');
  expect(left?.getAttribute('cy')).toBe('80');
  expect(Zloz.serializeGraph(state.graph)).toBe(graph);
  expect(state.past).toHaveLength(0);
  expect(
    (
      await render(Zloz.updateEditor(state, { type: 'PointerReleased', pointer: 1 }), {
        portAnchorGuides: true,
      })
    ).querySelector('[data-flow-anchor-guides]'),
  ).toBeNull();
});

test('diagnostic controls, read-only, edit protection and bypass gate rendering before custom hooks', async () => {
  const state = begun();
  let calls = 0;
  for (const options of [
    { minimalMode: true },
    { diagnostics: false },
    { diagnostics: { alignmentGuides: false } },
    { portAnchorGuides: false },
    { canEditPort: () => 'Managed' },
  ]) {
    const document = await render(state, {
      portAnchorGuides: true,
      ...options,
      renderPortAnchorGuide: () => {
        calls++;
        return undefined;
      },
    });
    expect(document.querySelector('[data-flow-anchor-guides]')).toBeNull();
  }
  const bypassed = Zloz.updateEditor(state, {
    type: 'PortAnchorSnapBypassChanged',
    pointer: 1,
    bypassed: true,
  });
  expect(
    (await render(bypassed, { portAnchorGuides: true })).querySelector('[data-flow-anchor-guides]'),
  ).toBeNull();
  expect(
    (await render({ ...state, readOnly: true }, { portAnchorGuides: true })).querySelector(
      '[data-flow-anchor-guides]',
    ),
  ).toBeNull();
  expect(calls).toBe(0);
  const resumed = Zloz.updateEditor(bypassed, {
    type: 'PortAnchorSnapBypassChanged',
    pointer: 1,
    bypassed: false,
  });
  expect(
    (await render(resumed, { portAnchorGuides: true })).querySelectorAll(
      '[data-flow-anchor-guide]',
    ),
  ).toHaveLength(2);
});

test('custom SVG receives resolved world endpoints, active feedback, viewport and detached settings', async () => {
  const state = { ...begun(), viewport: { x: 10, y: 5, zoom: 2 } };
  const snapped = Zloz.updateEditor(state, {
    type: 'PointerMoved',
    pointer: 1,
    point: { x: 7, y: 0 },
  });
  const document = await render(snapped, {
    portAnchorGuides: true,
    renderPortAnchorGuide: (context, h) => {
      expect(context.node.id).toBe('n');
      expect(context.port.id).toBe('p');
      expect(context.viewport).toEqual(state.viewport);
      expect(context.settings.allowedMidpoints).toEqual(['left', 'right']);
      if (snapped.gesture.type === 'port-anchor-drag')
        expect(context.settings.allowedMidpoints).not.toBe(
          snapped.gesture.snapSettings?.allowedMidpoints,
        );
      expect(context.start).toEqual(context.end);
      if (context.target.type === 'midpoint' && context.target.side === 'left') {
        expect(context.start).toEqual({ x: 20, y: 80 });
        expect(context.active).toBe(true);
        return h.circle(
          [
            h.Class('custom-guide'),
            h.Cx(String(context.start.x)),
            h.Cy(String(context.start.y)),
            h.R('3'),
          ],
          [],
        );
      }
      expect(context.active).toBe(false);
      // oxlint-disable-next-line linteffect/no-return-null -- Null is the public renderer's explicit omission contract.
      return null;
    },
  });
  expect(document.querySelectorAll('[data-flow-anchor-guide]')).toHaveLength(1);
  expect(
    document.querySelector('[data-flow-anchor-guide-active="true"] .custom-guide'),
  ).not.toBeNull();
  expect(document.querySelector('[data-flow-anchor-guides]')?.hasAttribute('inert')).toBe(true);
  const native = await render(snapped, { portAnchorGuides: true });
  expect(
    native.querySelector('[data-flow-anchor-guide-target="left"] circle')?.getAttribute('r'),
  ).toBe('3');
  expect(
    native
      .querySelector('[data-flow-anchor-guide-target="left"] circle')
      ?.getAttribute('stroke-width'),
  ).toBe('1');
});

test('native edge guides resolve the current frame and remain independent of measurement readouts', async () => {
  const state = Zloz.updateEditor(initial(), start, {
    portAnchorSnap: () => ({ distance: 12, cornerDistance: 12, midpointDistance: 12 }),
  });
  const preview = Zloz.updateEditor(state, {
    type: 'PointerMoved',
    pointer: 1,
    point: { x: 40, y: -43 },
  });
  const document = await render(preview, {
    portAnchorGuides: true,
    diagnostics: { measurements: false },
  });
  expect(document.querySelectorAll('[data-flow-anchor-guide]')).toHaveLength(12);
  const top = document.querySelector(
    '[data-flow-anchor-guide="edge"][data-flow-anchor-guide-target="top"]',
  );
  expect(top?.getAttribute('data-flow-anchor-guide-active')).toBe('true');
  const line = top?.querySelector('line');
  expect([
    line?.getAttribute('x1'),
    line?.getAttribute('y1'),
    line?.getAttribute('x2'),
    line?.getAttribute('y2'),
  ]).toEqual(['20', '30', '220', '30']);
  expect(line?.getAttribute('style')).toContain('non-scaling-stroke');
  const cancelled = Zloz.updateEditor(preview, { type: 'GestureCancelled' });
  expect(cancelled.graph).toEqual(state.graph);
  expect(
    (await render(cancelled, { portAnchorGuides: true })).querySelector(
      '[data-flow-anchor-guides]',
    ),
  ).toBeNull();
});
