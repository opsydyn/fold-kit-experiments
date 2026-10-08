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
