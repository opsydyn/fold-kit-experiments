import { describe, expect, it } from 'vitest';

import { initChartModels } from './model';

describe('linked charts initialization', () => {
  it('composes both chart child models into the parent model', () => {
    const result = initChartModels();

    expect(result.model.scatter.points).toHaveLength(30);
    expect(result.model.histogram.totalCount).toBe(30);
    expect(result.commands).toHaveLength(0);
  });
});
