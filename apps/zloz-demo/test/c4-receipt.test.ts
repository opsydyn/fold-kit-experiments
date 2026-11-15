import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import {
  parseEventStormingC4Conversion,
  serializeEventStormingC4Conversion,
  type ZlozModelDocument,
} from '@opsydyn/foldkit-zloz';
import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';

import wire from '../../../packages/foldkit-zloz/test/fixtures/c4-conversion-v1.json';
import { Message } from '../src/editor/message';
import { init, type Model } from '../src/editor/model';
import { receiptReviewPanel } from '../src/editor/receipt-review';
import { update } from '../src/editor/update';

const json = () => JSON.stringify(wire);
async function open(model: Model = init().model, text = json()) {
  const pending = update(
    model,
    Message.ChoseConversionReceiptFiles({ files: [new File([text], 'c4.json')] }),
  );
  assert(pending.commands?.[0]);
  const message = await Effect.runPromise(pending.commands[0].effect);
  return update(pending.model, message).model;
}
function preserved(before: Model, after: Model) {
  expect(after.editor).toBe(before.editor);
  expect(after.editions).toBe(before.editions);
  expect(after.modelIdentity).toBe(before.modelIdentity);
  expect(after.c4Conversions).toBe(before.c4Conversions);
  expect(after.c4PlanConsent).toBeNull();
  expect(after.mappingReceipts).toBe(before.mappingReceipts);
}
test('strict C4 data opens in a detached read-only comparison and closes without working-model changes or consent', async () => {
  const model = init().model,
    opened = await open(model);
  assert(opened.receiptReview);
  expect(opened.sidebarSection).toBe('c4mapping');
  expect(opened.receiptReview.receipt.format).toBe('foldkit-zloz-c4-conversion');
  expect(opened.receiptReview.editor.readOnly).toBe(true);
  assert.deepEqual(opened.receiptReview.editor.graph, wire.document.snapshot.graph);
  preserved(model, opened);
  const before = update(
    opened,
    Message.SelectedReceiptSide({ id: opened.receiptReview.id, side: 'before' }),
  ).model;
  assert.deepEqual(before.receiptReview?.editor.graph, wire.source.document.snapshot.graph);
  const edited = update(
    before,
    Message.ObservedReceiptInput({
      id: opened.receiptReview.id,
      side: 'before',
      message: { type: 'NodeLabelChanged', id: 'system', label: 'Illegal' },
    }),
  ).model;
  assert.deepEqual(edited.receiptReview?.editor.graph, wire.source.document.snapshot.graph);
  preserved(model, edited);
  const closed = update(edited, Message.ClickedCloseReceiptReview()).model;
  expect(closed.receiptReview).toBeNull();
  preserved(model, closed);
});
test('invalid C4 receipts preserve the previous comparison and working model', async () => {
  const valid = await open();
  const wrong = { ...wire, document: { ...wire.document, name: 'Forged target' } };
  const rejected = await open(valid, JSON.stringify(wrong));
  expect(rejected.receiptReview).toBe(valid.receiptReview);
  expect(rejected.receiptReviewNotice).toContain('Could not open');
  preserved(valid, rejected);
});
test('C4 download is validated before creating a Command, rechecks current scope and preserves records', () => {
  const receipt = parseEventStormingC4Conversion(json());
  const model: Model = { ...init().model, sidebarSection: 'c4mapping', c4Conversions: [receipt] };
  const input = { modelId: model.modelIdentity.id, epoch: model.modelEpoch, index: 0 };
  const result = update(model, Message.ClickedC4ReceiptDownload(input));
  expect(result.model).toBe(model);
  expect(result.commands).toHaveLength(1);
  expect(serializeEventStormingC4Conversion(receipt)).toContain('foldkit-zloz-c4-conversion');
  for (const request of [
    { ...input, epoch: input.epoch + 1 },
    { ...input, index: -1 },
    { ...input, index: 99 },
    { ...input, modelId: 'foreign' },
  ])
    expect(update(model, Message.ClickedC4ReceiptDownload(request)).commands).toBeUndefined();
  const forged = { ...receipt, document: { ...receipt.document, name: 'Forged' } };
  const denied = update(
    { ...model, c4Conversions: [forged] },
    Message.ClickedC4ReceiptDownload(input),
  );
  expect(denied.commands).toBeUndefined();
  expect(denied.model.c4Conversions[0]).toBe(forged);
  expect(denied.model.c4ApplyNotice).toContain('could not be validated');
  expect(update(model, Message.FailedC4ReceiptDownload(input)).model.c4Conversions).toBe(
    model.c4Conversions,
  );
});
test('cancelled and source-switched reads cannot replace a current C4 comparison', async () => {
  const model = await open();
  const pending = update(
    model,
    Message.ChoseConversionReceiptFiles({ files: [new File([json()], 'c4.json')] }),
  );
  assert(pending.commands?.[0]);
  const message = await Effect.runPromise(pending.commands[0].effect);
  const switched = { ...pending.model, modelEpoch: pending.model.modelEpoch + 1 };
  expect(update(switched, message).model.receiptReview).toBe(model.receiptReview);
  const cancelled = update(pending.model, Message.ClickedCancelReceiptRead()).model;
  expect(update(cancelled, message).model.receiptReview).toBe(model.receiptReview);
});

test('C4 comparison uses existing change navigation while preserving the chosen side and working Undo', async () => {
  const model = await open();
  assert(model.receiptReview);
  const review = model.receiptReview;
  const measured = update(
    model,
    Message.ObservedReceiptInput({
      id: review.id,
      side: review.side,
      message: { type: 'SurfaceMeasured', size: { width: 1000, height: 600 } },
    }),
  ).model;
  const focused = update(
    measured,
    Message.ClickedReceiptChangeStep({
      reviewId: review.id,
      side: 'after',
      direction: 'next',
      from: null,
    }),
  ).model;
  assert(focused.receiptReview?.focusedChange);
  const before = update(
    focused,
    Message.SelectedReceiptSide({ id: review.id, side: 'before' }),
  ).model;
  expect(before.receiptReview?.focusedChange).toEqual(focused.receiptReview.focusedChange);
  const next = update(
    before,
    Message.ClickedReceiptChangeStep({
      reviewId: review.id,
      side: 'before',
      direction: 'next',
      from: before.receiptReview?.focusedChange ?? null,
    }),
  ).model;
  expect(next.receiptReview?.side).toBe('before');
  preserved(model, next);
});
test('C4 reopening rejects invalid UTF-8 and excessive files without discarding a valid comparison', async () => {
  const model = await open();
  const invalid = new File([new Uint8Array([0xc3, 0x28])], 'invalid.json');
  const pending = update(model, Message.ChoseConversionReceiptFiles({ files: [invalid] }));
  assert(pending.commands?.[0]);
  const failed = update(pending.model, await Effect.runPromise(pending.commands[0].effect)).model;
  expect(failed.receiptReview).toBe(model.receiptReview);
  expect(failed.receiptReviewNotice).toContain('Could not open');
  const large = update(
    model,
    Message.ChoseConversionReceiptFiles({
      files: [new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.json')],
    }),
  );
  expect(large.commands).toBeUndefined();
  expect(large.model.receiptReview).toBe(model.receiptReview);
});

test('Minimal-mode C4 comparison exposes plan-specific membership and constraint losses with native read-only controls', async () => {
  const opened = await open();
  const model = { ...opened, minimalMode: true, diagnosticsEnabled: false };
  const result = await Effect.runPromise(
    renderToString(
      {
        Flags: Schema.Struct({}),
        init: () => ({ model }),
        view: (current, h: HtmlBuilder<Message>) => ({
          title: 'C4 receipt',
          body: receiptReviewPanel(current, h),
        }),
      },
      { flags: {}, isHydratable: false },
    ),
  );
  expect(result.html).toContain('C4 conversion receipt');
  expect(result.html).toContain('The authored parent membership would be removed');
  expect(result.html).toContain('Before conversion');
  expect(result.html).toContain('After conversion');
  expect(result.html).not.toContain('Apply C4 conversion');
});

test('download refuses receipts beyond the reopening byte limit, retaining provenance with visible feedback', () => {
  const receipt = parseEventStormingC4Conversion(json());
  const data = { payload: 'x'.repeat(5 * 1024 * 1024) };
  const withPayload = (document: ZlozModelDocument): ZlozModelDocument => ({
    ...document,
    snapshot: {
      ...document.snapshot,
      graph: {
        ...document.snapshot.graph,
        nodes: document.snapshot.graph.nodes.map((node) =>
          node.id === 'system' ? { ...node, data } : node,
        ),
      },
    },
  });
  const oversized = {
    ...receipt,
    source: { ...receipt.source, document: withPayload(receipt.source.document) },
    document: withPayload(receipt.document),
  };
  const model: Model = { ...init().model, sidebarSection: 'c4mapping', c4Conversions: [oversized] };
  const result = update(
    model,
    Message.ClickedC4ReceiptDownload({
      modelId: model.modelIdentity.id,
      epoch: model.modelEpoch,
      index: 0,
    }),
  );
  expect(result.commands).toBeUndefined();
  expect(result.model.notice).toContain('5 MiB');
  expect(result.model.c4Conversions).toBe(model.c4Conversions);
});
