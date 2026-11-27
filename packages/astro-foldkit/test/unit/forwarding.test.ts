import { expect, test } from 'bun:test';

import effectUi from '@opsydyn/astro-effect-ui';
import { astroComponent } from '@opsydyn/astro-effect-ui/component';

import { astroComponent as forwardedComponent } from '../../src/component';
import forwarded, { effectUi as named } from '../../src/index';

test('the existing package forwards the exact standalone integration and component adapter', () => {
  expect(forwarded).toBe(effectUi);
  expect(named).toBe(effectUi);
  expect(forwardedComponent).toBe(astroComponent);
  expect(forwarded({ interaction: false }).name).toBe('astro-effect-ui');
});
