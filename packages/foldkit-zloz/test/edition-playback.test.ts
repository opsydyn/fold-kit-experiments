import { expect, test } from 'bun:test';

import {
  createEditionPlayback,
  updateEditionPlayback,
  playbackEditionId,
  editionPlaybackReason,
} from '../src/index';

test('explicit play advances deterministically, pauses at the end and never catches up in a burst', () => {
  const ids = ['original', 'changed', 'future'];
  const initial = createEditionPlayback(ids, {
    intervalMs: 1000,
    reducedMotion: false,
  });
  ids.reverse();
  expect(initial.status).toBe('paused');
  let state = updateEditionPlayback(initial, { type: 'PlayClicked' });
  state = updateEditionPlayback(state, { type: 'Elapsed', milliseconds: 999 });
  expect(playbackEditionId(state)).toBe('original');
  state = updateEditionPlayback(state, { type: 'Elapsed', milliseconds: 1 });
  expect(playbackEditionId(state)).toBe('changed');
  const stalled = updateEditionPlayback(updateEditionPlayback(initial, { type: 'PlayClicked' }), {
    type: 'Elapsed',
    milliseconds: 9000,
  });
  expect(playbackEditionId(stalled)).toBe('changed');
  state = updateEditionPlayback(state, { type: 'Elapsed', milliseconds: 1000 });
  expect(playbackEditionId(state)).toBe('future');
  expect(state.status).toBe('paused');
  expect(playbackEditionId(updateEditionPlayback(state, { type: 'PlayClicked' }))).toBe('original');
  expect(initial.status).toBe('paused');
});
test('pause, rewind, manual seeking and speed changes reset elapsed time without automatic resumption', () => {
  const initial = createEditionPlayback(['a', 'b', 'c'], { reducedMotion: false });
  const partial = updateEditionPlayback(updateEditionPlayback(initial, { type: 'PlayClicked' }), {
    type: 'Elapsed',
    milliseconds: 1900,
  });
  const paused = updateEditionPlayback(partial, { type: 'PauseClicked' });
  expect(updateEditionPlayback(paused, { type: 'Elapsed', milliseconds: 10000 })).toBe(paused);
  expect(
    playbackEditionId(
      updateEditionPlayback(updateEditionPlayback(paused, { type: 'PlayClicked' }), {
        type: 'Elapsed',
        milliseconds: 100,
      }),
    ),
  ).toBe('a');
  const next = updateEditionPlayback(partial, { type: 'NextClicked' });
  expect(next.status).toBe('paused');
  expect(playbackEditionId(next)).toBe('b');
  expect(playbackEditionId(updateEditionPlayback(next, { type: 'PreviousClicked' }))).toBe('a');
  expect(playbackEditionId(updateEditionPlayback(next, { type: 'RewindClicked' }))).toBe('a');
  const selected = updateEditionPlayback(partial, { type: 'EditionSelected', id: 'c' });
  expect(selected.status).toBe('paused');
  expect(playbackEditionId(selected)).toBe('c');
  expect(updateEditionPlayback(selected, { type: 'EditionSelected', id: 'missing' })).toBe(
    selected,
  );
  const speed = updateEditionPlayback(partial, { type: 'IntervalChanged', intervalMs: 4000 });
  expect(speed.status).toBe('paused');
  expect(speed.intervalMs).toBe(4000);
});
test('reduced motion is safe by default, pauses immediately and keeps manual steps available', () => {
  const initial = createEditionPlayback(['a', 'b']);
  expect(editionPlaybackReason(initial)).toContain('reduced motion');
  expect(updateEditionPlayback(initial, { type: 'PlayClicked' })).toBe(initial);
  expect(playbackEditionId(updateEditionPlayback(initial, { type: 'NextClicked' }))).toBe('b');
  const playing = updateEditionPlayback(
    updateEditionPlayback(initial, { type: 'ReducedMotionChanged', reducedMotion: false }),
    { type: 'PlayClicked' },
  );
  const reduced = updateEditionPlayback(playing, {
    type: 'ReducedMotionChanged',
    reducedMotion: true,
  });
  expect(reduced.status).toBe('paused');
  expect(
    updateEditionPlayback(reduced, { type: 'ReducedMotionChanged', reducedMotion: false }).status,
  ).toBe('paused');
});
test('empty/single playlists cannot play and invalid identities or timing reject', () => {
  const empty = createEditionPlayback([]);
  expect(empty.status).toBe('empty');
  expect(playbackEditionId(empty)).toBeNull();
  expect(updateEditionPlayback(empty, { type: 'RewindClicked' })).toBe(empty);
  const single = createEditionPlayback(['a'], { reducedMotion: false });
  expect(editionPlaybackReason(single)).not.toBeNull();
  expect(updateEditionPlayback(single, { type: 'PlayClicked' })).toBe(single);
  for (const ids of [['a', 'a'], [' ']]) expect(() => createEditionPlayback(ids)).toThrow();
  for (const intervalMs of [0, -1, Infinity, NaN])
    expect(() => createEditionPlayback(['a'], { intervalMs })).toThrow();
  const playing = updateEditionPlayback(
    createEditionPlayback(['a', 'b'], { reducedMotion: false }),
    { type: 'PlayClicked' },
  );
  expect(() => updateEditionPlayback(playing, { type: 'Elapsed', milliseconds: -1 })).toThrow();
});
