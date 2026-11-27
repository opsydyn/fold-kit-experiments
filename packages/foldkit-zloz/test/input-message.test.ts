import { expect, test } from 'bun:test';

import { Schema } from 'effect';

import { BrowserInput } from '../src/browser-input';

test('native browser input decoding retains explicit chooser intent', () => {
  const event = {
    type: 'PortActivated',
    endpoint: { node: 'a', port: 'p' },
    end: 'source',
  } as const;
  expect(Schema.decodeUnknownSync(BrowserInput)(event)).toEqual(event);
  expect(() => Schema.decodeUnknownSync(BrowserInput)({ ...event, end: 'future' })).toThrow();
});
