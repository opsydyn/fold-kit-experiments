import { expect, it } from 'bun:test';

import * as Viz from '../src/index';

it('exposes pure bar geometry without importing the optional FoldKit paint adapter', () => {
  expect(Viz).toHaveProperty('barGeometry');
  expect(Viz).not.toHaveProperty('dotPattern');
});
