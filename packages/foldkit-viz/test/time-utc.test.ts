import { describe, expect, it } from 'bun:test';

import { utcTickFormat, utcTicks } from '../src/math/time';

const day = 86_400_000;

describe('UTC time ticks', () => {
  it('steps whole UTC days from UTC midnight', () => {
    const ticks = utcTicks(
      [new Date(Date.UTC(2026, 0, 1, 7)), new Date(Date.UTC(2026, 0, 6, 3))],
      5,
    );
    expect(ticks.map((t) => t.toISOString().slice(0, 10))).toEqual([
      '2026-01-02',
      '2026-01-03',
      '2026-01-04',
      '2026-01-05',
      '2026-01-06',
    ]);
    for (const tick of ticks) expect(tick.getTime() % day).toBe(0);
  });

  it('steps UTC months from the first of the month', () => {
    const ticks = utcTicks([new Date(Date.UTC(2026, 0, 15)), new Date(Date.UTC(2026, 6, 2))], 6);
    expect(ticks.map((t) => t.toISOString().slice(0, 10))).toEqual([
      '2026-02-01',
      '2026-03-01',
      '2026-04-01',
      '2026-05-01',
      '2026-06-01',
      '2026-07-01',
    ]);
  });

  it('labels in UTC at the coarsest unit that changes', () => {
    expect(utcTickFormat(new Date(Date.UTC(2026, 10, 13, 14, 5)))).toBe('14:05');
    expect(utcTickFormat(new Date(Date.UTC(2026, 10, 13)))).toBe('13 Nov');
    expect(utcTickFormat(new Date(Date.UTC(2026, 10, 1)))).toBe('Nov');
    expect(utcTickFormat(new Date(Date.UTC(2026, 0, 1)))).toBe('2026');
    expect(utcTickFormat(new Date(Date.UTC(2026, 0, 1, 0, 0, 30)))).toBe(':30');
  });
});
