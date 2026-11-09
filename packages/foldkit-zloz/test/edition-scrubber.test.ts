import { expect, test } from 'bun:test';

import {
  createEditionPlayback,
  updateEditionPlayback,
  playbackEditionId,
  resolveEditionScrubber,
  editionScrubberRequest,
  resolveEditionSeek,
} from '../src/index';

test('scrubber labels and value text derive from the cursor without changing it', () => {
  const cursor = createEditionPlayback(['first', 'second', 'third']);
  const context = resolveEditionScrubber(cursor, {
    labelEdition: (id) => `Edition ${id}`,
    formatValueText: (entry) => `Review ${entry.label}`,
  });
  expect(context.entries.map((entry) => entry.editionId)).toEqual(['first', 'second', 'third']);
  expect(context.current?.index).toBe(0);
  expect(context.valueText).toBe('Review Edition first');
  expect(context.rangeReason).toBeNull();
  expect(cursor.status).toBe('paused');
  const request = editionScrubberRequest(context, '2');
  expect(request).toEqual({ editionId: 'third' });
  const decision = resolveEditionSeek(cursor, request);
  expect(decision.type).toBe('ready');
  if (decision.type !== 'ready') throw new Error('Seek rejected');
  const playing = updateEditionPlayback(
    updateEditionPlayback(cursor, { type: 'ReducedMotionChanged', reducedMotion: false }),
    { type: 'PlayClicked' },
  );
  const selected = updateEditionPlayback(playing, decision.event);
  expect(selected.status).toBe('paused');
  expect(playbackEditionId(selected)).toBe('third');
});
test('requests preserve visible identity across reorder; missing IDs and malformed indices never select a substitute', () => {
  const context = resolveEditionScrubber(createEditionPlayback(['a', 'b', 'c']));
  const request = editionScrubberRequest(context, '1');
  const reordered = createEditionPlayback(['b', 'a', 'c']);
  expect(resolveEditionSeek(reordered, request)).toEqual({
    type: 'ready',
    event: { type: 'EditionSelected', id: 'b' },
  });
  expect(resolveEditionSeek(createEditionPlayback(['a', 'c']), request)).toEqual({
    type: 'ignored',
  });
  for (const raw of ['', '-1', '1.5', '3', 'NaN', '1e0', '01', ' 1 '])
    expect(editionScrubberRequest(context, raw)).toEqual({ editionId: null });
  expect(resolveEditionSeek(reordered, { editionId: null })).toEqual({ type: 'ignored' });
});
test('manual seeking respects host protection but remains available with reduced motion and a single edition', () => {
  const cursor = createEditionPlayback(['a']);
  const context = resolveEditionScrubber(cursor);
  expect(context.rangeReason).toContain('one edition');
  expect(context.reason).toBeNull();
  expect(resolveEditionSeek(cursor, { editionId: 'a' })).toEqual({
    type: 'ready',
    event: { type: 'EditionSelected', id: 'a' },
  });
  const blocked = resolveEditionScrubber(cursor, { blockedReason: 'Editing is active.' });
  expect(blocked.rangeReason).toBe('Editing is active.');
  expect(editionScrubberRequest(blocked, '0')).toEqual({ editionId: null });
  expect(resolveEditionSeek(cursor, { editionId: 'a' }, { blockedReason: '  ' })).toEqual({
    type: 'blocked',
    reason: 'Edition seeking is unavailable.',
  });
  const empty = resolveEditionScrubber(createEditionPlayback([]));
  expect(empty.current).toBeNull();
  expect(empty.rangeReason).not.toBeNull();
});

test('large playlists keep direct end selection and custom value labels', () => {
  const ids = Array.from({ length: 1000 }, (_, index) => `edition:${index}`);
  const cursor = createEditionPlayback(ids);
  const context = resolveEditionScrubber(cursor, { labelEdition: (id) => `Checkpoint ${id}` });
  expect(context.entries).toHaveLength(1000);
  expect(editionScrubberRequest(context, '999')).toEqual({ editionId: 'edition:999' });
  expect(resolveEditionSeek(cursor, editionScrubberRequest(context, '999'))).toEqual({
    type: 'ready',
    event: { type: 'EditionSelected', id: 'edition:999' },
  });
});
