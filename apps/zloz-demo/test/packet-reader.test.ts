import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { Effect } from 'effect';

import { Message } from '../src/editor/message';
import { init, type Model } from '../src/editor/model';
import { packetReaderState } from '../src/editor/packet-reader';
import { update } from '../src/editor/update';
const json = readFileSync(
  new URL(
    '../../../packages/foldkit-zloz-mermaid/test/fixtures/review-packet-v1.json',
    import.meta.url,
  ),
  'utf8',
);
const base = () => ({ ...init().model, sidebarSection: 'review' as const });
function choose(model: Model, text = json) {
  return update(
    model,
    Message.ChoseReviewPacketFiles({
      scope: packetReaderState(model).scope,
      files: [new File([text], 'review.json')],
    }),
  );
}
async function open(model: Model = base(), text = json) {
  const started = choose(model, text);
  assert(started.commands?.[0]);
  return update(started.model, await Effect.runPromise(started.commands[0].effect)).model;
}
function preserved(a: Model, b: Model) {
  for (const key of [
    'editor',
    'editions',
    'savedModels',
    'modelIdentity',
    'historyReview',
    'mappingReceipts',
    'mappingLossConsent',
  ] as const)
    expect(b[key]).toBe(a[key]);
}
test('file publication, side switching, canvas edits and closure preserve the working editor and Undo', async () => {
  const before = base(),
    opened = await open(before);
  preserved(before, opened);
  assert(opened.packetReader.review);
  assert(opened.packetPreview);
  expect(opened.packetPreview.editor.readOnly).toBe(true);
  const id = opened.packetReader.review.id,
    scope = opened.packetReader.scope;
  const baseline = update(
    opened,
    Message.ObservedReviewReaderInput({
      request: { scope, type: 'SideSelected', reviewId: id, side: 'baseline' },
    }),
  ).model;
  preserved(before, baseline);
  expect(baseline.packetPreview?.side).toBe('baseline');
  const moved = update(
    baseline,
    Message.ObservedPacketCanvasInput({
      scope,
      id,
      side: 'baseline',
      message: { type: 'ViewportChanged', viewport: { x: 10, y: 20, zoom: 1.5 } },
    }),
  ).model;
  preserved(before, moved);
  expect(moved.packetPreview?.editor.viewport).toEqual({ x: 10, y: 20, zoom: 1.5 });
  expect(moved.packetReader.review?.packet.baseline.snapshot.viewport).toEqual(
    baseline.packetReader.review?.packet.baseline.snapshot.viewport,
  );
  const blocked = update(baseline, Message.ClickedAdd()).model;
  expect(blocked).toBe(baseline);
  const edited = update(
    baseline,
    Message.ObservedPacketCanvasInput({
      scope,
      id,
      side: 'baseline',
      message: { type: 'EdgeDeleted', id: baseline.packetPreview?.editor.graph.edges[0]?.id },
    }),
  ).model;
  preserved(before, edited);
  expect(edited.packetPreview?.editor.graph).toBe(baseline.packetPreview?.editor.graph);
  const failed = await open(baseline, 'invalid');
  preserved(before, failed);
  expect(failed.packetReader.review).toBe(baseline.packetReader.review);
  expect(failed.packetPreview).toBe(baseline.packetPreview);
  const closed = update(
    failed,
    Message.ObservedReviewReaderInput({ request: { scope, type: 'ReviewClosed', reviewId: id } }),
  ).model;
  preserved(before, closed);
  expect(closed.packetPreview).toBeNull();
  expect(closed.packetReader.review).toBeNull();
});
test('cancellation, model epochs and live opening protection reject late publication', async () => {
  const before = base(),
    started = choose(before);
  assert(started.commands?.[0]);
  const state = started.model.packetReader;
  const cancelled = update(
    started.model,
    Message.ObservedReviewReaderInput({
      request: { scope: state.scope, type: 'ReadCancelled', run: state.run },
    }),
  ).model;
  const late = await Effect.runPromise(started.commands[0].effect);
  expect(update(cancelled, late).model.packetReader.review).toBeNull();
  const protectedModel = update(started.model, Message.ClickedPacketOpeningProtection()).model;
  const refused = update(protectedModel, late).model;
  expect(refused.packetReader.review).toBeNull();
  expect(refused.packetReader.notice).toContain('protected');
  preserved(before, refused);
  const changed = { ...started.model, modelEpoch: started.model.modelEpoch + 1 };
  expect(update(changed, late).model.packetReader.review).toBeNull();
  const invalid = update(
    before,
    Message.ChoseReviewPacketFiles({
      scope: packetReaderState(before).scope,
      files: [new File([new Uint8Array([0xc3])], 'invalid-utf8.json')],
    }),
  );
  assert(invalid.commands?.[0]);
  expect((await Effect.runPromise(invalid.commands[0].effect))._tag).toBe('FailedReviewPacketRead');
});

test('invalid UTF-8, oversized input and stale canvas facts retain the accepted preview', async () => {
  const before = await open();
  const scope = packetReaderState(before).scope;
  const started = update(
    before,
    Message.ChoseReviewPacketFiles({
      scope,
      files: [new File([new Uint8Array([0xc3])], 'invalid.json')],
    }),
  );
  assert(started.commands?.[0]);
  const rejected = update(started.model, await Effect.runPromise(started.commands[0].effect)).model;
  expect(rejected.packetReader.review).toBe(before.packetReader.review);
  expect(rejected.packetPreview).toBe(before.packetPreview);
  const oversized = update(
    before,
    Message.ChoseReviewPacketFiles({
      scope,
      files: [new File([new Uint8Array(1048577)], 'large.json')],
    }),
  );
  expect(oversized.commands).toBeUndefined();
  expect(oversized.model.packetReader.review).toBe(before.packetReader.review);
  const stale = update(
    before,
    Message.ObservedPacketCanvasInput({
      scope,
      id: 99,
      side: 'selected',
      message: { type: 'FitViewClicked' },
    }),
  ).model;
  expect(stale).toBe(before);
  const protectedModel = { ...before, protectReviewOpening: true };
  expect(choose(protectedModel).commands).toBeUndefined();
  preserved(before, rejected);
});
