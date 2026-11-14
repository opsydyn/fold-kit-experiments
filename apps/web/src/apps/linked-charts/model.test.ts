import { Option } from 'effect';
import { describe, expect, it } from 'vitest';

import { targetsOf } from '../../ui/plot-panel';
import { initChartModels, POINTS } from './model';

describe('linked charts initialization', () => {
  it('composes both chart panels into the parent model', () => {
    const result = initChartModels();

    expect(targetsOf(result.model.scatter)).toHaveLength(30);
    const bins = targetsOf(result.model.histogram);
    expect(bins.length).toBeGreaterThan(3);
    expect(bins[0]?.domain[0]).toBe(55000);
    expect(bins.at(-1)?.domain[1]).toBe(175000);
    expect(result.commands).toHaveLength(0);
    expect(result.model.inspection).toEqual(Option.none());
    const ids = POINTS.map((point) => point.id);
    expect(new Set(ids).size).toBe(30);
  });
});
