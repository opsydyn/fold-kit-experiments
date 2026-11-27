import { HtmlServer } from '@effect/ui/html';
import { Effect } from 'effect';
import { expect, test } from 'vitest';

import { init, Message, update } from '../../ui/phyllotaxis-chart';
import { Phyllotaxis } from './main';

test('renders the spiral and minimap without serializing static dots into their model', async () => {
  const { html, state } = await Effect.runPromise(HtmlServer.renderToHtml(Phyllotaxis, {}));
  expect(html.match(/<circle /g)).toHaveLength(2000);
  expect(state['~deferred'] ?? []).not.toContain('/Phyllotaxis');
  expect(state['/Phyllotaxis']).toEqual({ matrix: init.matrix, drag: null, showMiniMap: true });
});

test('only the pointer that starts a drag can move or end it', () => {
  const active = update(init, Message.StartedDrag({ pointerId: 7, x: 50, y: 40 }));
  expect(update(active, Message.StartedDrag({ pointerId: 9, x: 60, y: 30 }))).toBe(active);
  expect(update(active, Message.MovedDrag({ pointerId: 9, x: 60, y: 30 }))).toBe(active);
  expect(update(active, Message.EndedDrag({ pointerId: 9 }))).toBe(active);

  const moved = update(active, Message.MovedDrag({ pointerId: 7, x: 60, y: 56 }));
  expect(moved.matrix.translateX).toBeCloseTo(init.matrix.translateX + 10);
  expect(moved.matrix.translateY).toBeCloseTo(init.matrix.translateY + 16);
  const ended = update(moved, Message.EndedDrag({ pointerId: 7 }));
  expect(ended.drag).toBeNull();
  expect(update(ended, Message.MovedDrag({ pointerId: 7, x: 70, y: 65 }))).toBe(ended);
});
