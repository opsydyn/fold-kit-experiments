import { Option } from 'effect';
import { describe, expect, it } from 'vitest';

import { linkFor, sessionFrom } from './share';

describe('session links', () => {
  const session = {
    specimen: 'checkout',
    events: ['{"_tag":"AddedItem"}', '{"_tag":"Café ✦"}'],
    at: 1,
  };

  it('round-trips a session, unicode included, through a link', () => {
    const link = linkFor('https://example.test/stateflow?keep=1', session);

    expect(link).toContain('keep=1');
    expect(new URL(link).searchParams.get('session')).toMatch(/^[\w-]+$/);
    expect(sessionFrom(link)).toEqual(Option.some(session));
  });

  it('finds no session in a plain address or a damaged one', () => {
    expect(sessionFrom('https://example.test/stateflow')).toEqual(Option.none());
    expect(sessionFrom('https://example.test/stateflow?session=%%%')).toEqual(Option.none());
    expect(sessionFrom('https://example.test/stateflow?session=e30')).toEqual(Option.none());
  });
});
