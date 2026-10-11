import { expect, test } from 'bun:test';

import { Effect, Schema } from 'effect';
import { defineMessageUnion } from 'foldkit/message';
import { define } from 'foldkit/mount';

import { scatterGeometry } from '../src/chart/cartesian';
import { lightTheme } from '../src/chart/theme';
import { chartFrame, type ChartFrameOptions } from '../src/foldkit/frame';
import { renderChart } from './render-chart';
const Message = defineMessageUnion({ Recorded: { width: Schema.Number } });
const MountFrame = define('MountFrame', {
  messages: [Message.Recorded],
  execute: ({ element }) =>
    Effect.sync(() => Message.Recorded({ width: element.getBoundingClientRect().width })),
});
test('optional Mount is attached to the actual frame SVG without changing legacy markup', async () => {
  const geometry = scatterGeometry(
    [0],
    { x: (d) => d, y: (d) => d, datumKey: () => 'a', seriesKey: () => 'a' },
    { frame: { width: 200, height: 100, margins: { top: 0, right: 0, bottom: 0, left: 0 } } },
  );
  const options: ChartFrameOptions<typeof Message.Type> = {
    layout: geometry.layout,
    title: 'Test',
    description: 'Frame',
    theme: lightTheme,
    onMount: MountFrame(),
  };
  const mounted = await renderChart<typeof Message.Type>((h) => {
    const node = chartFrame(h, options, []);
    if (node === null) throw new RangeError('Missing SVG');
    expect(node.sel).toBe('svg');
    expect(node.data?.['foldkitMount']).toEqual({ name: 'MountFrame' });
    return node;
  });
  const legacy = await renderChart<typeof Message.Type>((h) => {
    const { onMount: _mount, ...plain } = options;
    const node = chartFrame(h, plain, []);
    if (node === null) throw new RangeError('Missing SVG');
    expect(node.data?.['foldkitMount']).toBeUndefined();
    return node;
  });
  expect(mounted).toBe(legacy);
});
