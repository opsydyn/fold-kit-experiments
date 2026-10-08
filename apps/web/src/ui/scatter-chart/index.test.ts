import { Option } from 'effect';
import { expect, it } from 'vitest';

import { points as salaryPoints } from '../../apps/comparison/data';
import { renderChart } from '../shared/render-chart.test-helper';
import { init, Message, update, view } from './index';

const points = [
  { id: 'a', x: 1, y: 10, label: 'same' },
  { id: 'b', x: 1, y: 10, label: 'same' },
  { id: 'c', x: 3, y: 30, label: 'third' },
];

it('renders two linked marks while retaining the independent active point and tooltip', async () => {
  const model = update(init({ points }).model, Message.HoveredPoint({ index: 2 })).model;
  const node = document.createElement('div');
  node.innerHTML = await renderChart((h) =>
    view(
      {
        model,
        highlightedKeys: ['a', 'b'],
        toParentMessage: (message) => message,
      },
      h,
    ),
  );
  const marks = node.querySelectorAll('circle[data-linked-highlight="true"]');
  expect(marks).toHaveLength(2);
  expect(Array.from(marks).every((mark) => mark.getAttribute('stroke-dasharray') !== null)).toBe(
    true,
  );
  expect(node.querySelectorAll(`circle[fill="${model.config.activeColor}"]`)).toHaveLength(1);
  expect(node.textContent).toContain('third (3, 30)');
  expect(model.activeIndex).toEqual(Option.some(2));
});

it('uses the stable ID for point inspection', () => {
  expect(update(init({ points }).model, Message.HoveredPoint({ index: 1 })).outMessage).toEqual({
    _tag: 'InspectedPoint',
    key: 'b',
    x: 1,
    y: 10,
  });
});

it('preserves legacy label keys and a single active point without an overlay', async () => {
  const legacy = points.map(({ x, y, label }) => ({ x, y, label }));
  const result = update(init({ points: legacy }).model, Message.HoveredPoint({ index: 1 }));
  expect(result.outMessage).toEqual({ _tag: 'InspectedPoint', key: 'same', x: 1, y: 10 });
  const config = { model: result.model, toParentMessage: (message: Message) => message };
  const markup = await renderChart((h) => view(config, h));
  expect(await renderChart((h) => view({ ...config, highlightedKeys: [] }, h))).toBe(markup);
  const node = document.createElement('div');
  node.innerHTML = markup;
  expect(node.querySelectorAll('[data-linked-highlight]')).toHaveLength(0);
  expect(node.querySelectorAll('circle')).toHaveLength(3);
  expect(node.querySelectorAll(`circle[fill="${result.model.config.activeColor}"]`)).toHaveLength(
    1,
  );
  expect(node.textContent).toContain('same (1, 10)');
});

it('ignores empty keyboard navigation without emitting an inspection', () => {
  const model = init({ points: [] }).model;
  expect(update(model, Message.PressedKeyNav({ direction: 'next' }))).toEqual({ model });
});

it('uses current client geometry and layout for nearest-point inspection', () => {
  const model = init({ points }).model;
  const first = update(
    model,
    Message.MovedPlotPointer({
      clientX: 410,
      clientY: 200,
      left: 400,
      top: 190,
      width: 408,
      height: 184,
    }),
  );
  const moved = update(
    model,
    Message.MovedPlotPointer({
      clientX: 410,
      clientY: 200,
      left: 0,
      top: 190,
      width: 408,
      height: 184,
    }),
  );
  expect(first.outMessage).toMatchObject({ key: 'a' });
  expect(moved.outMessage).toMatchObject({ key: 'c' });
});

it('retains inspection and finite dimensions across hidden and positive width measurements', () => {
  const active = update(init({ points }).model, Message.HoveredPoint({ index: 2 })).model;
  for (const width of [0, -1, NaN, Infinity]) {
    expect(update(active, Message.RecordedChartWidth({ width }))).toEqual({ model: active });
  }
  const resized = update(active, Message.RecordedChartWidth({ width: 300 }));
  expect(resized.model.layout.dims.width).toBe(300);
  expect(resized.model.layout.pw).toBe(176);
  expect(resized.model.activeIndex).toEqual(Option.some(2));
  expect(resized.outMessage).toBeUndefined();
});

it.each([380, 342])(
  'reserves a separate salary tick and title gutter at chart width %s',
  async (width) => {
    const model = init({
      points: salaryPoints,
      dims: { width },
      config: { yLabel: 'Salary ($)' },
    }).model;
    const node = document.createElement('div');
    node.innerHTML = await renderChart((h) =>
      view({ model, toParentMessage: (message) => message }, h),
    );
    const texts = [...node.querySelectorAll('text')];
    const tick = texts.find((text) => text.textContent === '100000');
    const title = texts.find((text) => text.textContent === 'Salary ($)');
    expect(tick).toBeDefined();
    expect(title?.getAttribute('transform')).toBe(
      `translate(${-model.layout.margins.left + 12},${model.layout.ph / 2}) rotate(-90)`,
    );
    expect(tick?.style.fontSize).toBe('0.7rem');
    expect(title?.style.fontSize).toBe('0.7rem');
    // Layout allocation, not measured glyph bounds: 24 title + 8 gap + 64 six-digit tick + 8 tick gap.
    expect(model.layout.margins.left + Number(tick?.getAttribute('x'))).toBeGreaterThanOrEqual(96);
    expect(node.querySelector('svg > g')?.getAttribute('transform')).toBe(
      `translate(${model.layout.margins.left},24)`,
    );
    expect(node.querySelector('rect[fill="transparent"]')?.getAttribute('width')).toBe(
      String(model.layout.pw),
    );
    expect(model.layout.pw).toBeGreaterThan(0);
  },
);

it('keeps the last usable scatter geometry for non-positive plots and recovers with inspection intact', () => {
  const active = update(init({ points }).model, Message.HoveredPoint({ index: 2 })).model;
  const marginSum = active.layout.margins.left + active.layout.margins.right;
  for (const width of [1, marginSum - 1, marginSum])
    expect(update(active, Message.RecordedChartWidth({ width }))).toEqual({ model: active });
  const recovered = update(active, Message.RecordedChartWidth({ width: marginSum + 100 }));
  expect(recovered.model.layout.pw).toBe(100);
  expect(recovered.model.activeIndex).toEqual(Option.some(2));
  expect(recovered.outMessage).toBeUndefined();
});
