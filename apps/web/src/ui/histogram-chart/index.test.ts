import { Option, Schema } from 'effect';
import { Runtime } from 'foldkit';
import { assert, expect, it, onTestFinished, vi } from 'vitest';

import { renderChart } from '../shared/render-chart.test-helper';
import { getBrushDomain, init, Message, update, view } from './index';
import type { Model } from './index';

async function responsiveBrushScene(order: 'bounds-first' | 'width-first') {
  const container = document.createElement('div');
  container.id = 'responsive-histogram-scene';
  const host = document.createElement('div');
  host.append(container);
  document.body.append(host);
  let clientLeft = 100;
  let containerWidth = 960;
  const initial = {
    ...init({ data: [], enableBrush: true }).model,
    bins: [{ x0: 0, x1: 100, count: 2 }],
  };
  // Deliver the width fact before mounting to exercise the opposite measurement ordering.
  let latest =
    order === 'width-first'
      ? update(initial, Message.RecordedChartWidth({ width: 960 })).model
      : initial;
  let notifyWidth = (_width: number) => {};
  const messages: Message[] = [];
  class Observer implements ResizeObserver {
    constructor(readonly callback: ResizeObserverCallback) {}
    observe(element: Element) {
      notifyWidth = (width) => {
        containerWidth = width;
        this.callback(
          [
            {
              target: element,
              contentRect: new DOMRect(0, 0, width, 265),
              borderBoxSize: [],
              contentBoxSize: [],
              devicePixelContentBoxSize: [],
            },
          ],
          this,
        );
      };
    }
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', Observer);
  function measuredRect(this: Element) {
    if (this.localName !== 'rect') return new DOMRect(100, 0, 0, 0);
    const svg = this.closest('svg');
    const width = Number(svg?.getAttribute('viewBox')?.split(' ')[2]);
    const scale = containerWidth / width;
    return new DOMRect(clientLeft + 44 * scale, 0, (width - 64) * scale, 193 * scale);
  }
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(measuredRect);
  const handle = Runtime.embed(
    Runtime.makeApplication({
      Model: Schema.declare<Model>(
        (value): value is Model => typeof value === 'object' && value !== null && 'brush' in value,
      ),
      init: () => ({ model: latest }),
      update: (model: Model, message: Message) => {
        messages.push(message);
        const result = update(model, message);
        latest = result.model;
        return { model: latest, commands: result.commands };
      },
      view: (model, h) => ({
        title: 'Histogram brush',
        body: view({ model, toParentMessage: (message) => message }, h),
      }),
      container,
      devTools: false,
    }),
  );
  onTestFinished(() => {
    handle.dispose();
    host.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });
  await vi.waitFor(() => expect(Option.isSome(latest.svgBounds)).toBe(true));
  const captured = Option.getOrThrow(latest.svgBounds);
  expect(captured).toEqual(
    order === 'bounds-first'
      ? { clientLeft: 188, renderedPW: 832 }
      : { clientLeft: 144, renderedPW: 896 },
  );
  notifyWidth(960);
  await vi.waitFor(() =>
    expect(host.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 960 265'),
  );
  const overlay = host.querySelector('rect[fill="transparent"]');
  assert(overlay !== null);
  return {
    overlay,
    messages,
    dispose: () => handle.dispose(),
    model: () => latest,
    pointer: (type: string, clientX: number, screenX: number) =>
      overlay.dispatchEvent(new PointerEvent(type, { clientX, screenX, bubbles: true })),
    move: (left: number) => {
      clientLeft = left;
    },
    renderWidth: (width: number) => {
      containerWidth = width;
    },
    resize: async (width: number) => {
      notifyWidth(width);
      await vi.waitFor(() =>
        expect(host.querySelector('svg')?.getAttribute('viewBox')).toBe(`0 0 ${width} 265`),
      );
    },
  };
}

it.each(['bounds-first', 'width-first'] as const)(
  'maps a physical brush after initial responsive measurement ordering: %s',
  async (order) => {
    const scene = await responsiveBrushScene(order);
    scene.pointer('pointerdown', 368, 2000);
    await vi.waitFor(() => expect(scene.model().brush.active).toBe(true));
    scene.pointer('pointerup', 592, 2224);
    await vi.waitFor(() => expect(scene.model().brush.active).toBe(false));
    const selected = Option.getOrThrow(getBrushDomain(scene.model()));
    expect(selected[0]).toBeCloseTo(25);
    expect(selected[1]).toBeCloseTo(50);
    // A new gesture must use the moved rectangle, not the initial Mount capture.
    scene.move(300);
    scene.pointer('pointerdown', 568, 3000);
    await vi.waitFor(() => expect(scene.model().brush.active).toBe(true));
    scene.pointer('pointerup', 792, 3224);
    await vi.waitFor(() => expect(scene.model().brush.active).toBe(false));
    expect(Option.getOrThrow(getBrushDomain(scene.model()))[0]).toBeCloseTo(25);
    expect(Option.getOrThrow(getBrushDomain(scene.model()))[1]).toBeCloseTo(50);
    scene.pointer('pointerdown', 568, 4000);
    await vi.waitFor(() => expect(scene.model().brush.active).toBe(true));
    scene.pointer('pointermove', 792, 4224);
    await vi.waitFor(() =>
      expect(Option.getOrThrow(getBrushDomain(scene.model()))[1]).toBeCloseTo(50),
    );
    await scene.resize(1856);
    expect(Option.getOrThrow(getBrushDomain(scene.model()))).toEqual([25, 50]);
    scene.pointer('pointermove', 792, 4224);
    await vi.waitFor(() =>
      expect(Option.getOrThrow(scene.model().svgBounds).renderedPW).toBe(1792),
    );
    expect(Option.getOrThrow(getBrushDomain(scene.model()))).toEqual([25, 50]);
    scene.pointer('pointermove', 971.2, 4403.2);
    await vi.waitFor(() =>
      expect(Option.getOrThrow(getBrushDomain(scene.model()))[1]).toBeCloseTo(60),
    );
    scene.pointer('pointerup', 1150.4, 4582.4);
    await vi.waitFor(() => expect(scene.model().brush.active).toBe(false));
    expect(Option.getOrThrow(getBrushDomain(scene.model()))[1]).toBeCloseTo(70);
  },
);

it('retains the original drag anchor while clamped unless measured geometry changes', async () => {
  const scene = await responsiveBrushScene('width-first');
  scene.pointer('pointerdown', 368, 2000);
  await vi.waitFor(() => expect(scene.model().brush.active).toBe(true));
  scene.pointer('pointermove', 2368, 4000);
  await vi.waitFor(() => expect(Option.getOrThrow(getBrushDomain(scene.model()))[1]).toBe(100));
  scene.pointer('pointermove', 1368, 3000);
  await vi.waitFor(() =>
    expect(Option.getOrThrow(scene.model().brushDragStart).lastScreenX).toBe(3000),
  );
  expect(Option.getOrThrow(getBrushDomain(scene.model()))).toEqual([25, 100]);
});

it('samples every pointer phase and removes all brush listeners on runtime disposal', async () => {
  const scene = await responsiveBrushScene('width-first');
  const measured = vi.spyOn(scene.overlay, 'getBoundingClientRect');
  measured.mockClear();
  const removed = vi.spyOn(scene.overlay, 'removeEventListener');
  // Back-to-back events must retain their order through the scoped stream.
  scene.pointer('pointerdown', 368, 2000);
  scene.pointer('pointermove', 480, 2112);
  scene.pointer('pointerup', 592, 2224);
  await vi.waitFor(() => expect(getBrushDomain(scene.model())).toEqual(Option.some([25, 50])));
  expect(scene.model().brush.active).toBe(false);
  expect(measured).toHaveBeenCalledTimes(3);
  scene.dispose();
  await vi.waitFor(() =>
    expect(removed.mock.calls.map(([type]) => type).sort()).toEqual([
      'pointerdown',
      'pointermove',
      'pointerup',
    ]),
  );
  scene.pointer('pointerdown', 592, 3000);
  scene.pointer('pointermove', 700, 3108);
  scene.pointer('pointerup', 800, 3208);
  expect(measured).toHaveBeenCalledTimes(3);
  expect(getBrushDomain(scene.model())).toEqual(Option.some([25, 50]));
});

it('ignores hidden event geometry and recovers without using the previous rectangle', async () => {
  const scene = await responsiveBrushScene('width-first');
  scene.renderWidth(0);
  scene.pointer('pointerdown', 368, 2000);
  scene.renderWidth(960);
  scene.pointer('pointermove', 592, 2224);
  scene.pointer('pointerup', 592, 2224);
  await vi.waitFor(() => expect(scene.messages.at(-1)?._tag).toBe('EndedHistogramBrush'));
  expect(scene.model().brush.active).toBe(false);
  expect(getBrushDomain(scene.model())).toEqual(Option.none());
  scene.pointer('pointerdown', 368, 3000);
  await vi.waitFor(() =>
    expect(Option.getOrThrow(scene.model().brushDragStart).lastScreenX).toBe(3000),
  );
  expect(getBrushDomain(scene.model())).toEqual(Option.none());
  scene.pointer('pointerup', 592, 3224);
  await vi.waitFor(() => expect(getBrushDomain(scene.model())).toEqual(Option.some([25, 50])));
});

const initial = () => ({
  ...init({ data: [] }).model,
  bins: [
    { x0: 10, x1: 20, count: 1 },
    { x0: 20, x1: 30, count: 2 },
    { x0: 30, x1: 30, count: 1 },
  ],
});

const brushFixture = () =>
  update(
    {
      ...init({ data: [], enableBrush: true }).model,
      bins: [{ x0: 0, x1: 100, count: 2 }],
    },
    Message.RecordedSvgBounds({ clientLeft: 100, renderedPW: 416 }),
  ).model;

it.each([
  [204, 1000, 1104],
  [308, 1104, 1000],
])(
  'preserves a completed brush domain through growth and shrink (client start %s)',
  (clientX, screenX, endScreenX) => {
    const started = update(
      brushFixture(),
      Message.StartedHistogramBrush({ clientX, screenX }),
    ).model;
    const selected = update(started, Message.EndedHistogramBrush({ screenX: endScreenX })).model;
    expect(getBrushDomain(selected)).toEqual(Option.some([25, 50]));
    let model = selected;
    for (const width of [896, 272, 480]) {
      const result = update(model, Message.RecordedChartWidth({ width }));
      model = result.model;
      expect(getBrushDomain(model)).toEqual(Option.some([25, 50]));
      expect(model.brush.active).toBe(false);
      expect(model.brushDragStart).toEqual(Option.none());
      expect(result.outMessage).toBeUndefined();
    }
  },
);

it('rebases an active drag on resize and fresh bounds without a stationary-pointer jump', () => {
  const started = update(
    brushFixture(),
    Message.StartedHistogramBrush({ clientX: 204, screenX: 1000 }),
  ).model;
  const dragged = update(started, Message.MovedHistogramBrush({ screenX: 1104 })).model;
  const resized = update(dragged, Message.RecordedChartWidth({ width: 896 })).model;
  expect(resized.brush).toEqual({ anchor: 208, extent: 416, active: true });
  expect(getBrushDomain(resized)).toEqual(Option.some([25, 50]));
  const stationary = update(resized, Message.MovedHistogramBrush({ screenX: 1104 })).model;
  expect(getBrushDomain(stationary)).toEqual(Option.some([25, 50]));
  const remeasured = update(
    stationary,
    Message.RecordedSvgBounds({ clientLeft: 500, renderedPW: 832 }),
  ).model;
  const moved = update(remeasured, Message.MovedHistogramBrush({ screenX: 1187.2 })).model;
  const domain = Option.getOrThrow(getBrushDomain(moved));
  expect(domain[0]).toBeCloseTo(25);
  expect(domain[1]).toBeCloseTo(60);
  const ended = update(moved, Message.EndedHistogramBrush({ screenX: 1270.4 })).model;
  expect(Option.getOrThrow(getBrushDomain(ended))[1]).toBeCloseTo(70);
  expect(ended.brush.active).toBe(false);
  expect(ended.brushDragStart).toEqual(Option.none());
});

it('uses the last actual pointer position when resizing a drag clamped beyond the plot', () => {
  const started = update(
    brushFixture(),
    Message.StartedHistogramBrush({ clientX: 204, screenX: 1000 }),
  ).model;
  const dragged = update(started, Message.MovedHistogramBrush({ screenX: 2000 })).model;
  const resized = update(dragged, Message.RecordedChartWidth({ width: 896 })).model;
  expect(getBrushDomain(resized)).toEqual(Option.some([25, 100]));
  const stationary = update(resized, Message.MovedHistogramBrush({ screenX: 2000 })).model;
  expect(getBrushDomain(stationary)).toEqual(Option.some([25, 100]));
  const moved = update(
    stationary,
    Message.MovedHistogramBrush({ screenX: 1916.8, bounds: { clientLeft: 100, renderedPW: 832 } }),
  ).model;
  expect(Option.getOrThrow(getBrushDomain(moved))[1]).toBeCloseTo(90);
});

it('does not reclassify a completed selection or sub-threshold gesture solely because of resize', () => {
  for (const delta of [1, 4]) {
    const started = update(
      brushFixture(),
      Message.StartedHistogramBrush({ clientX: 204, screenX: 1000 }),
    ).model;
    const selected = update(started, Message.EndedHistogramBrush({ screenX: 1000 + delta })).model;
    const domain = getBrushDomain(selected);
    expect(Option.isSome(domain)).toBe(delta === 4);
    for (const width of [168, 1728, 480]) {
      const resized = update(selected, Message.RecordedChartWidth({ width })).model;
      expect(getBrushDomain(resized)).toEqual(domain);
    }
  }
});

it('keeps selected domain and drag anchors through hidden, invalid and non-positive plot widths', () => {
  const started = update(
    brushFixture(),
    Message.StartedHistogramBrush({ clientX: 204, screenX: 1000 }),
  ).model;
  const model = update(started, Message.MovedHistogramBrush({ screenX: 1104 })).model;
  for (const width of [0, -1, NaN, Infinity, 64, 1]) {
    expect(update(model, Message.RecordedChartWidth({ width })).model).toBe(model);
  }
  for (const renderedPW of [0, -1, NaN, Infinity]) {
    expect(update(model, Message.RecordedSvgBounds({ clientLeft: 100, renderedPW })).model).toBe(
      model,
    );
  }
  const recovered = update(model, Message.RecordedChartWidth({ width: 896 })).model;
  expect(getBrushDomain(recovered)).toEqual(Option.some([25, 50]));
  expect(recovered.brush.active).toBe(true);
});

it('keyboard inspection emits the same intervals as pointer inspection, including the final endpoint', () => {
  const model = { ...initial(), bins: initial().bins.slice(0, 2) };
  const first = update(model, Message.PressedKeyNav({ direction: 'next' }));
  expect(first.model.activeBin).toEqual(Option.some(0));
  expect(first.outMessage).toEqual({ _tag: 'InspectedRange', domain: [10, 20], includeEnd: false });
  const second = update(first.model, Message.PressedKeyNav({ direction: 'next' }));
  expect(second.model.activeBin).toEqual(Option.some(1));
  expect(second.outMessage).toEqual({ _tag: 'InspectedRange', domain: [20, 30], includeEnd: true });
  expect(second.outMessage).toEqual(update(model, Message.HoveredBin({ index: 1 })).outMessage);
});

it('empty keyboard navigation is a complete no-op', () => {
  const model = { ...initial(), bins: [] };
  expect(update(model, Message.PressedKeyNav({ direction: 'next' }))).toEqual({ model });
});

it.each([
  [1, 'next', 0],
  [1, 'prev', 0],
  [2, 'next', 0],
  [2, 'prev', 1],
  [3, 'next', 0],
  [3, 'prev', 2],
] as const)(
  'first navigation across %s bins in direction %s inspects bin %s',
  (count, direction, expected) => {
    const model = { ...initial(), bins: initial().bins.slice(0, count) };
    const result = update(model, Message.PressedKeyNav({ direction }));
    expect(result.model.activeBin).toEqual(Option.some(expected));
    expect(result.outMessage).toEqual(
      update(model, Message.HoveredBin({ index: expected })).outMessage,
    );
  },
);

it('resizes without resetting inspection and ignores hidden or invalid widths', () => {
  const model = { ...initial(), activeBin: Option.some(1) };
  for (const width of [0, -1, NaN, Infinity]) {
    expect(update(model, Message.RecordedChartWidth({ width }))).toEqual({ model });
  }
  const resized = update(model, Message.RecordedChartWidth({ width: 300 }));
  expect(resized.model.layout.dims.width).toBe(300);
  expect(resized.model.activeBin).toEqual(Option.some(1));
  expect(resized.outMessage).toBeUndefined();
});

it('offers a keyboard target and a data alternative including empty charts', async () => {
  for (const model of [initial(), { ...initial(), bins: [] }]) {
    const node = document.createElement('div');
    node.innerHTML = await renderChart((h) => view({ model, toParentMessage: (m) => m }, h));
    expect(node.querySelector('svg[tabindex="0"]')).not.toBeNull();
    expect(node.querySelector('table')).not.toBeNull();
    expect(node.querySelectorAll('tbody tr')).toHaveLength(model.bins.length);
  }
});

it('preserves brush client-anchor and screen-delta behaviour', () => {
  const model = { ...initial(), enableBrush: true };
  const measured = update(
    model,
    Message.RecordedSvgBounds({ clientLeft: 100, renderedPW: model.layout.pw }),
  ).model;
  const started = update(
    measured,
    Message.StartedHistogramBrush({ clientX: 120, screenX: 920 }),
  ).model;
  const moved = update(started, Message.MovedHistogramBrush({ screenX: 970 })).model;
  expect(moved.brush.anchor).toBe(20);
  expect(moved.brush.extent).toBe(70);
  const ended = update(moved, Message.EndedHistogramBrush({ screenX: 990 })).model;
  expect(ended.brush.active).toBe(false);
  expect(ended.brush.extent).toBe(90);
  expect(ended.brushDragStart).toEqual(Option.none());
});

it('emits endpoint inclusion from the actual bin index, not a shared upper bound', () => {
  expect(update(initial(), Message.HoveredBin({ index: 1 })).outMessage).toEqual({
    _tag: 'InspectedRange',
    domain: [20, 30],
    includeEnd: false,
  });
  expect(update(initial(), Message.HoveredBin({ index: 2 })).outMessage).toEqual({
    _tag: 'InspectedRange',
    domain: [30, 30],
    includeEnd: true,
  });
});

it('renders linked bin outlines independently of the local active bin and tooltip', async () => {
  const model = { ...initial(), activeBin: Option.some(2) };
  const node = document.createElement('div');
  node.innerHTML = await renderChart((h) =>
    view(
      {
        model,
        highlightedBins: [0, 1],
        toParentMessage: (message) => message,
        renderTooltip: (_datum, _x, _y) => h.text([], ['local tooltip']),
      },
      h,
    ),
  );
  expect(node.querySelectorAll('rect[data-linked-highlight="true"]')).toHaveLength(2);
  expect(node.textContent).toContain('local tooltip');
  expect(model.activeBin).toEqual(Option.some(2));
  const config = { model, toParentMessage: (message: Message) => message };
  expect(await renderChart((h) => view(config, h))).toBe(
    await renderChart((h) => view({ ...config, highlightedBins: [] }, h)),
  );
});
