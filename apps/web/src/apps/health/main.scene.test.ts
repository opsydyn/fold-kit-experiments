import { Scene } from 'foldkit';
import { describe, test } from 'vitest';

import { TickedFrame } from './message';
import type { Model } from './model';
import { update } from './update';
import { view } from './view';

const loaded: Model = {
  _tag: 'Loaded',
  data: {
    status: 'ok',
    uptimeSeconds: 12,
    startedAt: '2026-07-07T19:00:00.000Z',
    timestamp: '2026-07-07T19:00:12.000Z',
  },
  elapsedMs: 0,
  sinceLabel: '19:00:00',
};

describe('health scene', () => {
  test('renders a subscription-driven uptime tick', () => {
    Scene.scene(
      { update, view },
      Scene.given(loaded),
      Scene.expect(Scene.text('12.0s')).toExist(),
      Scene.Subscription.emit(TickedFrame({ deltaTimeMs: 500 })),
      Scene.expect(Scene.text('12.5s')).toExist(),
    );
  });
});
