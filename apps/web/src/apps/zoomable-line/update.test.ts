import { compilePlot } from '@opsydyn/foldkit-viz/plot';
import { describe, expect, it } from 'vitest';

import { fullDomain } from './data';
import { Message } from './message';
import { init } from './model';
import { priceSpec } from './spec';
import { update } from './update';

const model = init;
const span = (domain: readonly [number, number] | null) => {
  const [lo, hi] = domain ?? fullDomain;
  return hi - lo;
};

describe('zoomable line', () => {
  it('zooms about the middle and pans within the year', () => {
    const zoomed = update(model, Message.ZoomedIn());
    expect(span(zoomed.domain)).toBeCloseTo(span(null) / 2, -3);
    const earlier = update(zoomed, Message.PannedEarlier());
    expect(earlier.domain?.[0]).toBeLessThan(zoomed.domain?.[0] ?? 0);
    expect(earlier.domain?.[0]).toBeGreaterThanOrEqual(fullDomain[0]);
    expect(update(earlier, Message.ResetView()).domain).toBeNull();
  });

  it('draws the zoomed dates on the axis and clips the line to the plot', () => {
    const zoomed = update(model, Message.ZoomedIn());
    const plot = compilePlot(priceSpec(zoomed.domain));
    expect(plot.clip).toBe(true);
    expect(plot.facets[0]?.x?.domain).toEqual(zoomed.domain);
  });
});
