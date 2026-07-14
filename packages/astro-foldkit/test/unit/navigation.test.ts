import { describe, expect, it } from 'bun:test';

import { normalizeNavigationEvent } from '../../src/navigation';

describe('normalizeNavigationEvent', () => {
  it('normalizes a pathname and previous pathname', () => {
    expect(
      normalizeNavigationEvent('stayed', new URL('https://example.test/repo/a').href, '/repo'),
    ).toEqual({ phase: 'stayed', path: '/repo/a', previousPath: '/repo' });
  });

  it('uses null when there is no previous URL', () => {
    expect(normalizeNavigationEvent('coldLoad', 'https://example.test/', null)).toEqual({
      phase: 'coldLoad',
      path: '/',
      previousPath: null,
    });
  });
});
