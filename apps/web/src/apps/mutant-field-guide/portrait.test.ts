import { expect, it } from 'vitest';

import { portrait } from './portrait';
import { exploreSpecimens } from './specimens';

it('draws six curved SVG legs for the palette specimen', () => {
  const { legs } = portrait(exploreSpecimens[0]);
  expect(legs).toHaveLength(6);
  for (const leg of legs) {
    expect(leg).toMatch(/^M[\d.,-]+L[\d.,-]+C/);
  }
});
