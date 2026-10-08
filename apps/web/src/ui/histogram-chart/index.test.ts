import { Option } from 'effect';
import { expect, it } from 'vitest';

import { renderChart } from '../shared/render-chart.test-helper';
import { getBrushDomain, init, Message, update, view } from './index';

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
  const moved = update(stationary, Message.MovedHistogramBrush({ screenX: 1916.8 })).model;
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
