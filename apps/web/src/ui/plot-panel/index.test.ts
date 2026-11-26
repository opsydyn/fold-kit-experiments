import type { PlotSpec } from '@opsydyn/foldkit-viz/plot';
import { Option } from 'effect';
import { describe, expect, it } from 'vitest';

import { renderChart } from '../shared/render-chart.test-helper';
import { init, Message, targetsOf, update, view } from './index';

const points = [
  { id: 'a', years: 1, pay: 50 },
  { id: 'b', years: 4, pay: 70 },
  { id: 'c', years: 9, pay: 120 },
];
const scatterSpec: PlotSpec = {
  width: 400,
  height: 260,
  data: points,
  marks: [{ mark: 'dot', x: 'years', y: 'pay', key: 'id', title: 'id' }],
};
const histogramSpec: PlotSpec = {
  width: 400,
  height: 260,
  data: points,
  marks: [
    {
      mark: 'rect',
      x: 'pay',
      inset: 1,
      title: 'count',
      transform: { type: 'bin', thresholds: [75, 100] },
    },
  ],
};
const scatter = init({ spec: scatterSpec }).model;
const histogram = init({ spec: histogramSpec, brush: true }).model;

describe('plot panel targets', () => {
  it('keeps two independent target sets when panels share a spec', () => {
    const spec: PlotSpec = {
      ...scatterSpec,
      marks: [
        { mark: 'dot', x: 'years', y: 'pay', key: 'id', data: points.slice(0, 1) },
        { mark: 'dot', x: 'years', y: 'pay', key: 'id', data: points.slice(1) },
      ],
    };
    expect(targetsOf(init({ spec, mark: 0 }).model).map((target) => target.key)).toEqual(['a']);
    expect(targetsOf(init({ spec, mark: 1 }).model).map((target) => target.key)).toEqual([
      'b',
      'c',
    ]);
  });

  it('lists dots and bars in x order, with bars covering their bins exactly', () => {
    expect(targetsOf(scatter).map((t) => t.key)).toEqual(['a', 'b', 'c']);
    const bins = targetsOf(histogram);
    expect(bins.map((b) => b.domain)).toEqual([
      [50, 75],
      [75, 100],
      [100, 120],
    ]);
    expect(bins.map((b) => b.includeEnd)).toEqual([false, false, true]);
  });
});

describe('plot panel inspection', () => {
  it('reports the nearest dot with its row’s values, and clears off it', () => {
    const [, b] = targetsOf(scatter);
    const hovered = update(scatter, Message.MovedPointer({ x: (b?.cx ?? 0) + 3, y: b?.cy ?? 0 }));
    expect(hovered.outMessage).toEqual({ _tag: 'InspectedPoint', key: 'b', x: 4, y: 70 });
    expect(hovered.model.active).toEqual(Option.some(1));
    const away = update(hovered.model, Message.MovedPointer({ x: 0, y: 0 }));
    expect(away.outMessage).toEqual({ _tag: 'ClearedInspection' });
  });

  it('reports the bin under the pointer as a range', () => {
    const [, middle] = targetsOf(histogram);
    const hovered = update(histogram, Message.MovedPointer({ x: middle?.cx ?? 0, y: 10 }));
    expect(hovered.outMessage).toEqual({
      _tag: 'InspectedRange',
      domain: [75, 100],
      includeEnd: false,
    });
  });

  it('stays quiet when the pointer stays on the same target', () => {
    const [a] = targetsOf(scatter);
    const once = update(scatter, Message.MovedPointer({ x: a?.cx ?? 0, y: a?.cy ?? 0 })).model;
    expect(update(once, Message.MovedPointer({ x: a?.cx ?? 0, y: a?.cy ?? 0 })).outMessage).toBe(
      undefined,
    );
  });

  it('steps through targets with the arrow keys, wrapping round', () => {
    const first = update(scatter, Message.PressedKeyNav({ command: { _tag: 'Step', by: 1 } }));
    expect(first.outMessage).toMatchObject({ _tag: 'InspectedPoint', key: 'a' });
    const back = update(first.model, Message.PressedKeyNav({ command: { _tag: 'Step', by: -1 } }));
    expect(back.outMessage).toMatchObject({ _tag: 'InspectedPoint', key: 'c' });
  });
});

describe('plot panel keys', () => {
  const press = (model: typeof scatter, key: string) =>
    update(
      model,
      Message.PressedKeyNav({ command: { _tag: 'Jump', to: key === 'End' ? 'last' : 'first' } }),
    );

  it('jumps to either end and clears on Escape', () => {
    expect(press(scatter, 'End').outMessage).toMatchObject({ _tag: 'InspectedPoint', key: 'c' });
    const first = press(scatter, 'Home');
    expect(first.outMessage).toMatchObject({ _tag: 'InspectedPoint', key: 'a' });
    const cleared = update(first.model, Message.PressedKeyNav({ command: { _tag: 'Clear' } }));
    expect(cleared.outMessage).toEqual({ _tag: 'ClearedInspection' });
  });
});

describe('plot panel brushing', () => {
  const [low, , high] = targetsOf(histogram);
  const drag = (from: number, to: number) => {
    const pressed = update(histogram, Message.PressedPointer({ x: from, y: 100 })).model;
    const moved = update(pressed, Message.MovedPointer({ x: to, y: 100 })).model;
    return update(moved, Message.ReleasedPointer());
  };

  it('selects the dragged range in data units', () => {
    const released = drag(low?.left ?? 0, high?.right ?? 0);
    expect(released.outMessage?._tag).toBe('SelectedRange');
    const domain = released.outMessage?._tag === 'SelectedRange' ? released.outMessage.domain : [];
    expect(domain[0]).toBeCloseTo(50, 5);
    expect(domain[1]).toBeCloseTo(120, 5);
    expect(Option.isSome(released.model.band)).toBe(true);
  });

  it('clears the selection on a click, and ignores presses without a brush', () => {
    expect(drag(100, 101).outMessage).toEqual({ _tag: 'ClearedSelection' });
    expect(update(scatter, Message.PressedPointer({ x: 100, y: 100 })).model.drag).toEqual(
      Option.none(),
    );
  });
});

describe('plot panel data and view', () => {
  it('swaps in new rows and drops the active target', () => {
    const active = update(scatter, Message.HoveredTarget({ index: 0 })).model;
    const replaced = update(active, Message.ReplacedRows({ rows: points.slice(0, 2) })).model;
    expect(targetsOf(replaced)).toHaveLength(2);
    expect(replaced.active).toEqual(Option.none());
  });

  it('makes displayed histogram bins and counts available in its table', async () => {
    const node = document.createElement('div');
    node.innerHTML = await renderChart((h) =>
      view({ model: histogram, toParentMessage: (m) => m, ariaLabel: 'Pay distribution' }, h),
    );
    expect([...node.querySelectorAll('thead th')].map((cell) => cell.textContent)).toEqual([
      'pay start',
      'pay end',
      'Count',
    ]);
    expect(
      [...node.querySelectorAll('tbody tr')].map((row) =>
        [...row.children].map((cell) => cell.textContent),
      ),
    ).toEqual([
      ['50', '75', '2'],
      ['75', '100', '0'],
      ['100', '120', '1'],
    ]);
  });

  it('renders a focusable chart with a live region and a data table', async () => {
    const active = update(scatter, Message.HoveredTarget({ index: 2 })).model;
    const node = document.createElement('div');
    node.innerHTML = await renderChart((h) =>
      view({ model: active, toParentMessage: (m) => m, ariaLabel: 'Pay by years' }, h),
    );
    const panel = node.querySelector('.plot-panel');
    expect(panel?.getAttribute('tabindex')).toBe('0');
    expect(panel?.getAttribute('aria-label')).toBe('Pay by years');
    expect(node.querySelector('[aria-live="polite"]')?.textContent).toBe('c');
    expect(node.querySelectorAll('tbody tr')).toHaveLength(3);
    expect(node.querySelectorAll('.plot-overlay circle')).toHaveLength(1);
  });

  it('dims all but the emphasised targets, and applies a data highlight', async () => {
    const render = (config: Parameters<typeof view>[0]) => {
      const node = document.createElement('div');
      return renderChart((h) => view(config, h)).then((html) => {
        node.innerHTML = html;
        return [...node.querySelectorAll('.plot-mark circle, .plot-mark rect')].map((el) =>
          Number(el.getAttribute('opacity') ?? 1),
        );
      });
    };
    const base = { model: histogram, toParentMessage: (m: Message) => m, ariaLabel: 'Pay' };
    expect(await render({ ...base, emphasis: [1] })).toEqual([0.35, 1, 0.35]);
    const highlighted = await render({
      model: scatter,
      toParentMessage: (m: Message) => m,
      ariaLabel: 'Pay',
      highlight: { field: 'pay', range: [60, 130] },
    });
    expect(highlighted.filter((o) => o < 1)).toHaveLength(1);
  });
});
