import { expect, test } from 'bun:test';

import { createReviewReader, resolveReviewReader, updateReviewReader } from '../src/index';
import literal from './fixtures/review-packet-v1.json';
const scope = 'model/1',
  file = { name: 'review.json', byteLength: 40000 };
test('opening validates owned data, retains the last review on failure and preserves its chosen side', () => {
  const initial = createReviewReader(scope);
  const started = updateReviewReader(initial, { scope, type: 'ReadRequested', file });
  expect(started.read?.run).toBe(1);
  const opened = updateReviewReader(started.state, {
    scope,
    type: 'ReadSucceeded',
    run: 1,
    text: JSON.stringify(literal),
  }).state;
  expect(opened.review?.packet.model.id).toBe('orders');
  expect(opened.review?.side).toBe('selected');
  const selected = updateReviewReader(opened, {
    scope,
    type: 'SideSelected',
    reviewId: 1,
    side: 'baseline',
  }).state;
  const retry = updateReviewReader(selected, { scope, type: 'ReadRequested', file }).state;
  const failed = updateReviewReader(retry, {
    scope,
    type: 'ReadSucceeded',
    run: 2,
    text: 'bad',
  }).state;
  expect(failed.review).toBe(selected.review);
  expect(failed.notice).toContain('invalid-json');
  expect(resolveReviewReader(failed).snapshot).toBe(
    selected.review?.packet.baseline.snapshot ?? null,
  );
});
test('live protection, cancellation, scopes and stale replies never replace an accepted review', () => {
  const initial = createReviewReader(scope);
  expect(
    updateReviewReader(
      initial,
      { scope, type: 'ReadRequested', file },
      { blockedReason: 'Pause playback' },
    ).read,
  ).toBeNull();
  const pending = updateReviewReader(initial, { scope, type: 'ReadRequested', file }).state;
  const denied = updateReviewReader(
    pending,
    { scope, type: 'ReadSucceeded', run: 1, text: JSON.stringify(literal) },
    { blockedReason: 'Busy' },
  ).state;
  expect(denied.review).toBeNull();
  expect(denied.pending).toBeNull();
  const cancelled = updateReviewReader(pending, { scope, type: 'ReadCancelled', run: 1 }).state;
  expect(
    updateReviewReader(cancelled, {
      scope,
      type: 'ReadSucceeded',
      run: 1,
      text: JSON.stringify(literal),
    }).state,
  ).toBe(cancelled);
  expect(updateReviewReader(pending, { scope: 'other', type: 'ReadFailed', run: 1 }).state).toBe(
    pending,
  );
  const newer = updateReviewReader(pending, { scope, type: 'ReadRequested', file }).state;
  expect(
    updateReviewReader(newer, {
      scope,
      type: 'ReadSucceeded',
      run: 1,
      text: JSON.stringify(literal),
    }).state,
  ).toBe(newer);
  expect(
    updateReviewReader(initial, {
      scope,
      type: 'ReadRequested',
      file: { ...file, byteLength: 1048577 },
    }).read,
  ).toBeNull();
});
test('closing invalidates pending reads; side policy and scope changes reject stale interaction', () => {
  const pending = updateReviewReader(createReviewReader(scope), {
    scope,
    type: 'ReadRequested',
    file,
  }).state;
  const opened = updateReviewReader(pending, {
    scope,
    type: 'ReadSucceeded',
    run: 1,
    text: JSON.stringify(literal),
  }).state;
  const protectedSide = updateReviewReader(
    opened,
    { scope, type: 'SideSelected', reviewId: 1, side: 'baseline' },
    { selectionReason: '' },
  ).state;
  expect(protectedSide.review).toBe(opened.review);
  expect(protectedSide.notice).toContain('protected');
  const second = updateReviewReader(opened, { scope, type: 'ReadRequested', file }).state;
  const closed = updateReviewReader(second, { scope, type: 'ReviewClosed', reviewId: 1 }).state;
  expect(
    updateReviewReader(closed, {
      scope,
      type: 'ReadSucceeded',
      run: 2,
      text: JSON.stringify(literal),
    }).state,
  ).toBe(closed);
  expect(
    updateReviewReader(opened, { scope, type: 'SideSelected', reviewId: 99, side: 'baseline' })
      .state,
  ).toBe(opened);
  expect(
    updateReviewReader(opened, { scope, type: 'ReadRequested', file }, { blockedReason: '' }).read,
  ).toBeNull();
});
