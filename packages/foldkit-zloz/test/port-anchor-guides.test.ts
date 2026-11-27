import { expect, test } from 'bun:test';

import { Html } from '@effect/ui/html';
import { Window } from 'happy-dom';

import type { GraphSurfaceOptions } from '../src/effect-ui';
import * as Zloz from '../src/index';
import type { EditorEvent, EditorState } from '../src/index';
import { renderCanvas } from './render-effect-ui';

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
async function render(state: EditorState, options: Partial<GraphSurfaceOptions<string>> = {}) {
  const result = await renderCanvas(state, options);
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
    (await render(initial(), { portAnchors: { guides: true } })).querySelector(
      '[data-flow-anchor-guides]',
    ),
  ).toBeNull();
  const document = await render(state, { portAnchors: { guides: true } });
  expect(document.querySelectorAll('[data-flow-anchor-guide]')).toHaveLength(2);
  const layer = document.querySelector('[data-flow-anchor-guides]');
  expect(layer?.getAttribute('aria-hidden')).toBe('true');
  expect(layer?.hasAttribute('inert')).toBe(true);
  expect(layer?.classList.contains('zloz-ui-anchor-guides')).toBe(true);
  const left = document.querySelector('[data-flow-anchor-guide-target="left"] circle');
  expect(left?.getAttribute('cx')).toBe('20');
  expect(left?.getAttribute('cy')).toBe('80');
  expect(Zloz.serializeGraph(state.graph)).toBe(graph);
  expect(state.past).toHaveLength(0);
  expect(
    (
      await render(Zloz.updateEditor(state, { type: 'PointerReleased', pointer: 1 }), {
        portAnchors: { guides: true },
      })
    ).querySelector('[data-flow-anchor-guides]'),
  ).toBeNull();
});

test('guide opt-in, read-only, edit protection and bypass gate rendering before custom hooks', async () => {
  const state = begun();
  let calls = 0;
  for (const policy of [undefined, { canEditPort: () => 'Managed' }]) {
    const document = await render(state, {
      policy,
      portAnchors: {
        guides: policy !== undefined,
        renderGuide: () => {
          calls++;
          return undefined;
        },
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
    (await render(bypassed, { portAnchors: { guides: true } })).querySelector(
      '[data-flow-anchor-guides]',
    ),
  ).toBeNull();
  expect(
    (await render({ ...state, readOnly: true }, { portAnchors: { guides: true } })).querySelector(
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
    (await render(resumed, { portAnchors: { guides: true } })).querySelectorAll(
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
    portAnchors: {
      guides: true,
      renderGuide: (context) => {
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
          return new Html.Element<string>('circle')
            .class('custom-guide')
            .attr('cx', String(context.start.x))
            .attr('cy', String(context.start.y))
            .attr('r', '3')
            .children();
        }
        expect(context.active).toBe(false);
        // oxlint-disable-next-line linteffect/no-return-null -- Null is the public renderer's explicit omission contract.
        return null;
      },
    },
  });
  expect(document.querySelectorAll('[data-flow-anchor-guide]')).toHaveLength(1);
  expect(
    document.querySelector('[data-flow-anchor-guide-active="true"] .custom-guide'),
  ).not.toBeNull();
  expect(document.querySelector('[data-flow-anchor-guides]')?.hasAttribute('inert')).toBe(true);
  const native = await render(snapped, { portAnchors: { guides: true } });
  expect(
    native.querySelector('[data-flow-anchor-guide-target="left"] circle')?.getAttribute('r'),
  ).toBe('3');
  expect(
    native
      .querySelector('[data-flow-anchor-guide-target="left"] circle')
      ?.getAttribute('vector-effect'),
  ).toBe('non-scaling-stroke');
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
    portAnchors: { guides: true },
    resizeReadout: false,
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
  expect(line?.getAttribute('vector-effect')).toBe('non-scaling-stroke');
  const cancelled = Zloz.updateEditor(preview, { type: 'GestureCancelled' });
  expect(cancelled.graph).toEqual(state.graph);
  expect(
    (await render(cancelled, { portAnchors: { guides: true } })).querySelector(
      '[data-flow-anchor-guides]',
    ),
  ).toBeNull();
});
