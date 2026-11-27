import { HtmlServer } from '@effect/ui/html';
import { Effect } from 'effect';
import { expect, test } from 'vitest';

import { AnimatedBar } from './main';
import { Message } from './message';
import { init } from './model';
import { update } from './update';

test('server rendering includes the resting bars and their hydration state', async () => {
  const { html, state } = await Effect.runPromise(HtmlServer.renderToHtml(AnimatedBar, {}));
  expect(html.match(/<rect[^>]*height="0"[^>]*>/g)).toHaveLength(6);
  expect(html).toContain('aria-label="Q1: 42"');
  expect(state['~deferred'] ?? []).not.toContain('/AnimatedBar');
  expect(state['/AnimatedBar']).toBeDefined();
});

test('frames preserve the stagger and stop advancing once all bars finish', () => {
  const tick = Message.Ticked({ dt: 60 });
  const first = update(init, tick);
  expect(first.tweens[0]?.progress).toBeGreaterThan(0);
  expect(first.tweens[1]?.progress).toBe(0);
  const second = update(first, tick);
  expect(second.tweens[1]?.progress).toBeGreaterThan(0);
  const finished = Array.from({ length: 25 }, () => tick).reduce(update, second);
  expect(finished.tweens.every(({ progress }) => progress === 1)).toBe(true);
  expect(update(finished, tick)).toBe(finished);
});
