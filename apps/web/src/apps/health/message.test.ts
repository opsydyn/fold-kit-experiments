import { describe, expect, test } from 'vitest';

import { Message } from './message';

describe('health Message namespace', () => {
  test('constructs and matches every message through the FoldKit union', () => {
    const message = Message.FetchedHealth({
      status: 'ok',
      uptimeSeconds: 12.5,
      startedAt: '2026-07-07T19:00:00.000Z',
      timestamp: '2026-07-07T19:00:12.500Z',
    });

    expect(
      Message.match(message, {
        FetchedHealth: () => 'fetched',
        FetchFailed: () => 'failed',
        TickedFrame: () => 'ticked',
      }),
    ).toBe('fetched');
  });
});
