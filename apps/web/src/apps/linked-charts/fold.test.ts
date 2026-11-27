import { Option } from 'effect';
import { expect, it } from 'vitest';

import { Message, targetsOf } from '../../ui/plot-panel/core';
import { updateHistogram, updateScatter } from './fold';
import { init } from './model';

it('keeps the scatter as the inspection source when its sibling is highlighted', () => {
  const initial = init().model;
  const next = updateScatter(initial, Message.HoveredTarget({ index: 0 }));
  expect(next.histogram.active).toEqual(Option.some(0));
  expect(next.inspection).toEqual(Option.some({ _tag: 'Point', key: 'salary-1' }));
});

it('reports the histogram range without mutating the scatter model', () => {
  const initial = init().model;
  const next = updateHistogram(initial, Message.HoveredTarget({ index: 0 }));
  const [first] = targetsOf(initial.histogram);
  expect(next.scatter).toBe(initial.scatter);
  expect(next.inspection).toEqual(
    Option.some({
      _tag: 'Range',
      lower: first?.domain[0],
      upper: first?.domain[1],
      includeEnd: false,
    }),
  );
});
