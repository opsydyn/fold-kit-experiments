import { expect, it } from 'vitest';

import { cthulhuKnot } from './cthulhu';

it('reveals the deep-water plate only for a never effect that survived', () => {
  expect(cthulhuKnot('die', [{ outcome: 'missed' }])).toBeUndefined();
  expect(cthulhuKnot('never', [{ outcome: 'untested' }, { outcome: 'caught' }])).toBeUndefined();
});

it('remembers the last decisive observation when drawing the knot', () => {
  const survived = [{ outcome: 'missed' }];
  const caught = [...survived, { outcome: 'caught' }, { outcome: 'untested' }];
  expect(cthulhuKnot('never', survived)).toBe('knotted');
  expect(cthulhuKnot('never', caught)).toBe('open');
  expect(cthulhuKnot('never', [...caught, ...survived])).toBe('knotted');
});
