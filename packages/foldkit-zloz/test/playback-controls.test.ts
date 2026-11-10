import { expect, test } from 'bun:test';

import {
  createEditionPlayback,
  updateEditionPlayback,
  resolveEditionPlaybackControls,
} from '../src/index';

test('transport actions derive bounds and state without changing the cursor', () => {
  const cursor = createEditionPlayback(['a', 'b'], { reducedMotion: false });
  const context = resolveEditionPlaybackControls(cursor, { editionLabel: 'Original' });
  expect(context.statusText).toBe('Paused · Original');
  expect(context.editionId).toBe('a');
  expect(context.actions.play.disabled).toBe(false);
  expect(context.actions.pause.disabled).toBe(true);
  expect(context.actions.previous.reason).toContain('first');
  expect(context.actions.rewind.disabled).toBe(false);
  expect(context.actions.next.event).toEqual({ type: 'NextClicked' });
  const last = resolveEditionPlaybackControls(
    updateEditionPlayback(cursor, context.actions.next.event),
  );
  expect(last.actions.next.disabled).toBe(true);
  expect(last.actions.previous.disabled).toBe(false);
  expect(last.actions.play.disabled).toBe(false);
  const playing = resolveEditionPlaybackControls(
    updateEditionPlayback(cursor, context.actions.play.event),
  );
  expect(playing.actions.play.disabled).toBe(true);
  expect(playing.actions.pause.disabled).toBe(false);
  expect(cursor.status).toBe('paused');
});
test('host restrictions never remove core reduced-motion guards or disable an active Pause', () => {
  const reduced = createEditionPlayback(['a', 'b']);
  const context = resolveEditionPlaybackControls(reduced, { automaticReason: null });
  expect(context.actions.play.reason).toContain('reduced motion');
  expect(context.actions.next.disabled).toBe(false);
  const blocked = resolveEditionPlaybackControls(reduced, { blockedReason: 'Finish the import.' });
  expect(blocked.actions.play.reason).toBe('Finish the import.');
  expect(blocked.actions.next.reason).toBe('Finish the import.');
  const playing = updateEditionPlayback(
    createEditionPlayback(['a', 'b'], { reducedMotion: false }),
    { type: 'PlayClicked' },
  );
  const busy = resolveEditionPlaybackControls(playing, { blockedReason: 'Finish the import.' });
  expect(busy.actions.pause.disabled).toBe(false);
  expect(busy.actions.rewind.disabled).toBe(true);
  const blank = resolveEditionPlaybackControls(playing, { blockedReason: '   ' });
  expect(blank.reason?.length).toBeGreaterThan(0);
  expect(blank.actions.next.disabled).toBe(true);
});
test('empty/single collections and labels have explicit, nonempty availability contracts', () => {
  const empty = resolveEditionPlaybackControls(createEditionPlayback([]));
  expect(Object.values(empty.actions).every((action) => action.disabled && action.reason)).toBe(
    true,
  );
  expect(empty.editionId).toBeNull();
  expect(empty.statusText).toBe('No editions');
  const single = resolveEditionPlaybackControls(
    createEditionPlayback(['a'], { reducedMotion: false }),
    { labels: { rewind: 'Start again', play: ' ' } },
  );
  expect(single.actions.play.disabled).toBe(true);
  expect(single.actions.rewind.label).toBe('Start again');
  expect(single.actions.rewind.disabled).toBe(false);
  expect(single.actions.play.label).toBe('Play editions');
});
