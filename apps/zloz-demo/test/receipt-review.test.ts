import assert from 'node:assert/strict';

import {
  applyEventStormingDddConversion,
  captureModelDocument,
  captureEdition,
  createArchitectureNode,
  createEditor,
  createHistoryReview,
  updateEditor,
  createEventStormingDddConversionPlan,
  serializeEventStormingDddConversion,
} from '@opsydyn/foldkit-zloz';
import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
import { expect, test } from 'vitest';

import { ReadConversionReceipt } from '../src/editor/command';
import { Message } from '../src/editor/message';
import { init, type Model } from '../src/editor/model';
import { receiptComparison, receiptReviewPanel } from '../src/editor/receipt-review';
import { workbenchSvgReview } from '../src/editor/svg-review';
import { update } from '../src/editor/update';

function receiptJson() {
  const graph = {
    nodes: [
      createArchitectureNode({
        id: 'event',
        label: 'Order placed',
        position: { x: 0, y: 0 },
        size: { width: 240, height: 160 },
        ports: [],
        architecture: {
          family: 'event-storming',
          role: 'domain-event',
          description: 'Workshop intent',
        },
      }),
    ],
    edges: [],
  };
  const edition = captureEdition({ id: 'discovery', name: 'Discovery', snapshot: { graph } });
  const document = captureModelDocument({
    id: 'foreign-model',
    name: 'Portable Orders',
    snapshot: { graph, viewport: { x: 20, y: 40, zoom: 1 } },
    editions: [edition],
    origin: { modelId: 'parent', modelName: 'Discovery model', edition },
  });
  const source = { document, sessionId: 'foreign-tab', revision: 0 };
  const plan = createEventStormingDddConversionPlan(source);
  assert(document.snapshot.viewport);
  const result = applyEventStormingDddConversion(
    createEditor(graph, { viewport: document.snapshot.viewport }),
    source,
    { consent: { planKey: plan.key, accepted: true } },
  );
  assert(result.type === 'applied');
  return serializeEventStormingDddConversion(result.conversion);
}
const file = () => new File([receiptJson()], 'orders.conversion.json');
async function open(model: Model = init().model) {
  const pending = update(model, Message.ChoseConversionReceiptFiles({ files: [file()] }));
  assert(pending.commands?.[0]);
  const message = await Effect.runPromise(pending.commands[0].effect);
  return update(pending.model, message).model;
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
  ] as const)
    expect(after[key]).toBe(before[key]);
}
test('reopening validates the receipt and compares detached before/after without publishing a model or receipt', async () => {
  const base = init().model;
  const source = {
    ...base,
    editor: updateEditor(base.editor, {
      type: 'NodeLabelChanged',
      id: 'source',
      label: 'Unrelated working edit',
    }),
  };
  expect(source.editor.past).toHaveLength(1);
  const opened = await open(source);
  preserved(source, opened);
  const review = opened.receiptReview;
  assert(review);
  expect(review.side).toBe('after');
  expect(review.editor.readOnly).toBe(true);
  expect(review.editor.graph.nodes[0]?.architecture?.family).toBe('ddd');
  expect(review.receipt.source.document.origin?.modelId).toBe('parent');
  const changes = receiptComparison(review);
  expect(
    changes.nodes.map(({ id, semanticChanged, layoutChanged }) => ({
      id,
      semanticChanged,
      layoutChanged,
    })),
  ).toEqual([{ id: 'event', semanticChanged: true, layoutChanged: false }]);
  const before = update(
    opened,
    Message.SelectedReceiptSide({ id: review.id, side: 'before' }),
  ).model;
  expect(before.receiptReview?.editor.graph.nodes[0]?.architecture?.family).toBe('event-storming');
  preserved(source, before);
  const closed = update(before, Message.ClickedCloseReceiptReview()).model;
  expect(closed.receiptReview).toBeNull();
  preserved(source, closed);
});
test('review rejects editor mutations and working actions while permitting only detached navigation and scoped side changes', async () => {
  const source = await open(),
    review = source.receiptReview;
  assert(review);
  for (const message of [
    Message.ObservedZlozInput({
      message: { type: 'NodeLabelChanged', id: 'source', label: 'Bad' },
    }),
    Message.SelectedExample({ example: 'event-storming' }),
    Message.ClickedApplyMappingConversion({
      modelId: source.modelIdentity.id,
      epoch: source.modelEpoch,
      revision: source.editor.revision,
      sourceKey: '',
      planKey: '',
      generation: 0,
    }),
  ])
    expect(update(source, message).model).toBe(source);
  const malicious = update(
    source,
    Message.ObservedReceiptInput({
      id: review.id,
      side: 'after',
      message: { type: 'NodeLabelChanged', id: 'event', label: 'Bad' },
    }),
  ).model;
  expect(malicious).toBe(source);
  const moved = update(
    source,
    Message.ObservedReceiptInput({
      id: review.id,
      side: 'after',
      message: { type: 'ViewportNudged', delta: { x: 20, y: 10 } },
    }),
  ).model;
  expect(moved.receiptReview?.editor.viewport).not.toEqual(review.editor.viewport);
  preserved(source, moved);
  expect(
    update(moved, Message.SelectedReceiptSide({ id: review.id - 1, side: 'before' })).model,
  ).toBe(moved);
  const switched = update(
    moved,
    Message.SelectedReceiptSide({ id: review.id, side: 'before' }),
  ).model;
  expect(
    update(
      switched,
      Message.ObservedReceiptInput({
        id: review.id,
        side: 'after',
        message: { type: 'ViewportNudged', delta: { x: 80, y: 0 } },
      }),
    ).model,
  ).toBe(switched);
});
test('cancel, superseded reads, model switches and busy completion reject stale publication', async () => {
  const source = init().model;
  const first = update(source, Message.ChoseConversionReceiptFiles({ files: [file()] }));
  assert(first.commands?.[0]);
  const message = await Effect.runPromise(first.commands[0].effect);
  const cancelled = update(first.model, Message.ClickedCancelReceiptRead()).model;
  expect(update(cancelled, message).model).toBe(cancelled);
  const second = update(
    first.model,
    Message.ChoseConversionReceiptFiles({ files: [file()] }),
  ).model;
  expect(update(second, message).model).toBe(second);
  for (const changed of [
    { ...first.model, modelEpoch: first.model.modelEpoch + 1 },
    {
      ...first.model,
      active: { requestId: 'busy', revision: source.editor.revision, graph: source.editor.graph },
    },
  ]) {
    const result = update(changed, message).model;
    expect(result.receiptReview).toBeNull();
    preserved(changed, result);
  }
});
test('malformed, tampered, oversized and invalid UTF-8 leave the last valid comparison intact and retry succeeds', async () => {
  const source = await open();
  const tampered = JSON.parse(receiptJson());
  tampered.document.snapshot.graph.nodes[0].label = 'Forged target';
  for (const bad of [
    new File(['{'], 'bad'),
    new File([JSON.stringify(tampered)], 'tampered'),
    new File([new Uint8Array([255])], 'utf8'),
    new File([' '.repeat(5 * 1024 * 1024 + 1)], 'large'),
    new File(['{"format":"foldkit-zloz-ddd-conversion","version":2}'], 'future'),
  ]) {
    const pending = update(source, Message.ChoseConversionReceiptFiles({ files: [bad] }));
    let result = pending.model;
    if (pending.commands?.[0])
      result = update(result, await Effect.runPromise(pending.commands[0].effect)).model;
    expect(result.receiptReview).toBe(source.receiptReview);
    preserved(source, result);
    expect(result.receiptReviewNotice).toContain('Could not open');
  }
  const retried = await open(source);
  expect(retried.receiptReview?.id).not.toBe(source.receiptReview?.id);
  preserved(source, retried);
});
test('minimal mode keeps native reopening, before/after, close, provenance and change explanations available', async () => {
  const opened = await open({ ...init().model, minimalMode: true, diagnosticsEnabled: false });
  const html = (
    await Effect.runPromise(
      renderToString(
        {
          Flags: Schema.Struct({}),
          init: () => ({ model: opened }),
          view: (current, h: HtmlBuilder<Message>) => ({
            title: 'Receipt',
            body: receiptReviewPanel(current, h),
          }),
        },
        { flags: {}, isHydratable: false },
      ),
    )
  ).html;
  expect(html).toContain('Open conversion receipt');
  expect(html).toContain('Before conversion');
  expect(html).toContain('After conversion');
  expect(html).toContain('Return to working model');
  expect(html).toContain('Discovery model');
  expect(html).toContain('event-storming');
  expect(html).toContain('ddd');
  expect(html).toContain('not verified authorship');
});

test('history and Undo remain exact across review; closing invalidates pending file callbacks', async () => {
  const start = init().model;
  const historyReview = createHistoryReview(
    captureEdition({ id: 'past', name: 'Past', snapshot: { graph: start.editor.graph } }),
    start.editor,
  );
  const historical = { ...start, historyReview };
  const opened = await open(historical);
  preserved(historical, opened);
  const pending = update(opened, Message.ChoseConversionReceiptFiles({ files: [file()] }));
  assert(pending.commands?.[0]);
  const completed = await Effect.runPromise(pending.commands[0].effect);
  const closed = update(pending.model, Message.ClickedCloseReceiptReview()).model;
  expect(update(closed, completed).model).toBe(closed);
  preserved(historical, closed);
});
test('the read Command rejects excessive bytes before accessing file contents', async () => {
  let reads = 0;
  class TooLarge extends File {
    override arrayBuffer() {
      reads++;
      return super.arrayBuffer();
    }
  }
  const oversized = new TooLarge([' '.repeat(5 * 1024 * 1024 + 1)], 'oversized');
  const response = await Effect.runPromise(
    ReadConversionReceipt.make({ id: 92, file: oversized }).effect,
  );
  expect(response).toEqual(Message.FailedConversionReceiptRead({ id: 92 }));
  expect(reads).toBe(0);
});

test('an SVG download can settle while a read-only receipt comparison is open', async () => {
  const initial = init().model;
  const controls = workbenchSvgReview(initial);
  const pending = update(
    initial,
    Message.ObservedSvgReviewInput({
      request: { ...controls.identity, type: 'SvgDownloadRequested' },
    }),
  ).model;
  assert(pending.svgReview.download.type === 'pending');
  const opened = await open(pending);
  assert(opened.receiptReview);
  const settled = update(
    opened,
    Message.CompletedSvgDownload({
      scope: pending.svgReview.scope,
      generation: pending.svgReview.generation,
      key: pending.svgReview.download.key,
      run: pending.svgReview.download.run,
    }),
  ).model;
  expect(settled.svgReview.download.type).toBe('idle');
  expect(settled.receiptReview).toBe(opened.receiptReview);
  expect(settled.editor).toBe(pending.editor);
});
