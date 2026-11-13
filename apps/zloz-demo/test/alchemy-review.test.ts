import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { updateEditor } from '@opsydyn/foldkit-zloz';
import { Effect } from 'effect';

import { decodeAlchemyText, alchemyTextLimits } from '../src/editor/alchemy-text';
import { Message } from '../src/editor/message';
import { init, type Model } from '../src/editor/model';
import { update } from '../src/editor/update';
const sample = readFileSync(new URL('../src/editor/alchemy-example.json', import.meta.url), 'utf8');
function open(model: Model = init().model, json = sample) {
  return update(
    update(
      update(model, Message.SelectedWorkbenchSection({ section: 'alchemy' })).model,
      Message.ChangedAlchemyText({ text: json }),
    ).model,
    Message.ClickedAlchemyReview(),
  ).model;
}
function preserved(before: Model, after: Model) {
  for (const key of [
    'editor',
    'editions',
    'modelIdentity',
    'savedModels',
    'historyReview',
    'mappingReceipts',
    'mappingLossConsent',
    'packetReader',
    'patchWorkbench',
  ] as const)
    expect(after[key]).toBe(before[key]);
}
test('bounded text rejects ambiguous, malformed and excessive JSON before descriptor projection', () => {
  const good = decodeAlchemyText(sample);
  assert(good.type === 'reviewable');
  expect(good.source.source.revision).toBe('fixture-v1');
  expect(good.coverage).toHaveLength(23);
  for (const text of [
    sample.replace('"version": 1', '"version": 1, "\\u0076ersion": 1'),
    sample + '{}',
    sample + ' garbage',
    sample.slice(0, -2),
    '{"x":' + '['.repeat(17) + '0' + ']'.repeat(17) + '}',
    '[' + '0,'.repeat(alchemyTextLimits.maxValues) + '0]',
    ' '.repeat(alchemyTextLimits.maxBytes + 1),
    '"' + '🌌'.repeat(alchemyTextLimits.maxBytes / 4) + '"',
    sample.replace('"version": 1', '"version": 1e999'),
    sample.replace('"version": 1', '"version": 01'),
    sample.replace('"version": 1', '"version": 2'),
    sample.replace('"version": 1', '"version": 1, "graph": {}'),
  ]) {
    const result = decodeAlchemyText(text);
    expect(result.type).toBe('blocked');
    expect('graph' in result).toBe(false);
  }
  expect(decodeAlchemyText(sample.replaceAll('\n', '\r\n')).type).toBe('reviewable');
  expect(decodeAlchemyText(sample.padEnd(alchemyTextLimits.maxBytes, ' ')).type).toBe('reviewable');
});
test('review is detached, keeps provenance/losses and rejects edits and working actions; close restores working history', () => {
  const base = init().model;
  const source = {
    ...base,
    editor: updateEditor(base.editor, {
      type: 'NodeLabelChanged',
      id: 'source',
      label: 'Unrelated edit',
    }),
  };
  const reviewed = open(source),
    review = reviewed.alchemyReview.review;
  assert(review);
  preserved(source, reviewed);
  expect(review.editor.readOnly).toBe(true);
  expect(review.projection.source.source).toEqual({
    packageVersion: '2.0.0-beta.85',
    namespace: 'example/bank',
    modelName: 'Bank',
    revision: 'fixture-v1',
  });
  expect(review.projection.findings.filter((f) => f.severity === 'loss')).toHaveLength(8);
  for (const message of [
    Message.ObservedZlozInput({
      message: { type: 'NodeLabelChanged', id: 'source', label: 'Bad' },
    }),
    Message.SelectedExample({ example: 'event-storming' }),
    Message.ObservedAlchemyInput({
      id: review.id,
      message: {
        type: 'NodeLabelChanged',
        id: 'example%2Fbank/Bank/view/AccountSummary',
        label: 'Bad',
      },
    }),
    Message.ObservedAlchemyInput({ id: review.id - 1, message: { type: 'FitViewClicked' } }),
  ])
    expect(update(reviewed, message).model).toBe(reviewed);
  const moved = update(
    reviewed,
    Message.ObservedAlchemyInput({
      id: review.id,
      message: { type: 'SurfaceMeasured', size: { width: 900, height: 600 } },
    }),
  ).model;
  preserved(source, moved);
  expect(moved.alchemyReview.review?.editor.surface).toEqual({ width: 900, height: 600 });
  expect(moved.alchemyReview.review?.editor.viewport.zoom).not.toBe(review.editor.viewport.zoom);
  expect(moved.alchemyReview.review?.editor.past).toHaveLength(0);
  const invalid = open(moved, '{"format":"wrong"}');
  expect(invalid.alchemyReview.review).toBe(moved.alchemyReview.review);
  expect(invalid.alchemyReview.notice).toContain('Rejected');
  const closed = update(invalid, Message.ClickedCloseAlchemyReview()).model;
  expect(closed.alchemyReview.review).toBeNull();
  preserved(source, closed);
});
test('file reads are bounded/fatal UTF-8 and stale/cancelled results cannot replace a review', async () => {
  const base = open();
  const chosen = update(
    base,
    Message.ChoseAlchemyFiles({ files: [new File([sample], 'bank.json')] }),
  );
  assert(chosen.commands?.[0]);
  const settled = await Effect.runPromise(chosen.commands[0].effect);
  const cancelled = update(chosen.model, Message.ClickedCancelAlchemyRead()).model;
  expect(update(cancelled, settled).model).toBe(cancelled);
  const edited = update(chosen.model, Message.ChangedAlchemyText({ text: '{}' })).model;
  expect(update(edited, settled).model).toBe(edited);
  const loaded = update(chosen.model, settled).model;
  expect(loaded.alchemyReview.review?.id).not.toBe(base.alchemyReview.review?.id);
  preserved(base, loaded);
  for (const file of [
    new File([new Uint8Array([0xff])], 'invalid.json'),
    new File([' '.repeat(alchemyTextLimits.maxBytes + 1)], 'big.json'),
  ]) {
    const pending = update(base, Message.ChoseAlchemyFiles({ files: [file] }));
    const result = pending.commands?.[0]
      ? update(pending.model, await Effect.runPromise(pending.commands[0].effect)).model
      : pending.model;
    expect(result.alchemyReview.review).toBe(base.alchemyReview.review);
    expect(result.alchemyReview.notice).toContain('Rejected');
    preserved(base, result);
  }
  const other = { ...chosen.model, modelEpoch: chosen.model.modelEpoch + 1 };
  expect(update(other, settled).model).toBe(other);
});

test('conflicting reads cannot open a descriptor review; latest read wins', async () => {
  const selected = update(
    init().model,
    Message.SelectedWorkbenchSection({ section: 'alchemy' }),
  ).model;
  for (const busy of [
    { ...selected, receiptRead: { id: 1, modelId: selected.modelIdentity.id, epoch: 0 } },
    {
      ...selected,
      patchWorkbench: { ...selected.patchWorkbench, pending: { run: 1, revision: 0 } },
    },
  ]) {
    const blocked = update(busy, Message.ClickedAlchemyExample()).model;
    expect(blocked.alchemyReview.review).toBeNull();
    preserved(busy, blocked);
  }
  const first = update(
    selected,
    Message.ChoseAlchemyFiles({ files: [new File([sample], 'old.json')] }),
  );
  const second = update(
    first.model,
    Message.ChoseAlchemyFiles({
      files: [new File([sample.replace('fixture-v1', 'fixture-v2')], 'new.json')],
    }),
  );
  assert(first.commands?.[0] && second.commands?.[0]);
  const newest = update(second.model, await Effect.runPromise(second.commands[0].effect)).model;
  expect(newest.alchemyReview.review?.projection.source.source.revision).toBe('fixture-v2');
  expect(update(newest, await Effect.runPromise(first.commands[0].effect)).model).toBe(newest);
  preserved(selected, newest);
});
