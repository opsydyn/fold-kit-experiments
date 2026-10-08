import { Option } from 'effect';
import { expect, it } from 'vitest';

import { renderChart } from '../shared/render-chart.test-helper';
import { init, Message, update, view } from './index';

const initial = () => ({
  ...init({ data: [] }).model,
  bins: [
    { x0: 10, x1: 20, count: 1 },
    { x0: 20, x1: 30, count: 2 },
    { x0: 30, x1: 30, count: 1 },
  ],
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
