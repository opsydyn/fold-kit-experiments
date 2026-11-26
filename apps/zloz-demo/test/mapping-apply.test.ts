import assert from 'node:assert/strict';

import {
  parseEventStormingDddConversion,
  createHistoryReview,
  captureEdition,
  serializeEventStormingDddConversion,
} from '@opsydyn/foldkit-zloz';
import { Effect, Schema } from 'effect';
import { renderToString } from 'foldkit/experimental/server';
import type { HtmlBuilder } from 'foldkit/html';
import { expect, test } from 'vitest';

import { workbenchMappingReview } from '../src/editor/mapping-review';
import { mappingReviewPanel } from '../src/editor/mapping-review-view';
import { Message } from '../src/editor/message';
import { init, type Model } from '../src/editor/model';
import { workbenchDocument } from '../src/editor/model-sessions';
import { update } from '../src/editor/update';
function choose(model: Model, key: string, value: string) {
  return update(
    model,
    Message.SelectedMappingReviewChoice({ ...workbenchMappingReview(model).scope, key, value }),
  ).model;
}
function prepared(): Model {
  let model: Model = {
    ...update(init().model, Message.SelectedExample({ example: 'event-storming' })).model,
    sidebarSection: 'mapping',
  };
  for (const id of ['note:0', 'note:1', 'note:4', 'note:5'])
    model = choose(model, `node:${id}`, 'retain');
  for (const id of ['step:0', 'step:1', 'step:3', 'step:4'])
    model = choose(model, `edge:${id}`, 'retain');
  return acknowledge(model);
}
function acknowledge(model: Model) {
  const context = workbenchMappingReview(model);
  return update(
    model,
    Message.ClickedMappingLossAcknowledgement({
      ...context.scope,
      generation: model.mappingConsentRun,
      planKey: context.conversion.plan.key,
      accepted: true,
    }),
  ).model;
}
function request(model: Model) {
  const context = workbenchMappingReview(model);
  return Message.ClickedApplyMappingConversion({
    ...context.scope,
    generation: model.mappingConsentRun,
    planKey: context.conversion.plan.key,
  });
}
test('Apply publishes editor and retained receipt together; one Undo/Redo keeps immutable provenance', () => {
  const model = prepared(),
    original = workbenchDocument(model),
    message = request(model);
  expect(workbenchMappingReview(model).applyReason).toBeNull();
  const result = update(model, message),
    applied = result.model;
  expect(result.commands ?? []).toEqual([]);
  expect(applied.mappingReceipts).toHaveLength(1);
  const saved = applied.mappingReceipts[0];
  assert(saved, 'Missing receipt');
  expect(saved.conversion.source.document).toEqual(original);
  expect(saved.conversion.document.snapshot.graph).toEqual(applied.editor.graph);
  expect(applied.editor.past).toEqual([model.editor.graph]);
  expect(applied.editor.graph.nodes.find((n) => n.id === 'note:3')?.architecture?.family).toBe(
    'ddd',
  );
  expect(applied.editor.graph.edges.find((e) => e.id === 'step:2')?.architecture?.family).toBe(
    'ddd',
  );
  expect(applied.modelIdentity).toBe(model.modelIdentity);
  expect(applied.editions).toBe(model.editions);
  expect(applied.mappingReviewNotice).toContain('Conversion applied');
  expect(applied.mappingLossConsent).toBeNull();
  expect(update(applied, message).model).toBe(applied);
  const undone = update(
    applied,
    Message.ObservedZlozInput({ message: { type: 'UndoPressed' } }),
  ).model;
  expect(undone.editor.graph).toEqual(model.editor.graph);
  expect(undone.mappingReceipts).toBe(applied.mappingReceipts);
  expect(update(undone, message).model).toBe(undone);
  const redone = update(
    undone,
    Message.ObservedZlozInput({ message: { type: 'RedoPressed' } }),
  ).model;
  expect(redone.editor.graph).toEqual(applied.editor.graph);
  expect(redone.mappingReceipts).toBe(applied.mappingReceipts);
  expect(
    parseEventStormingDddConversion(serializeEventStormingDddConversion(saved.conversion)),
  ).toEqual(saved.conversion);
});
test('current Apply protection and final-state semantic policy veto without publishing either value', () => {
  const model = prepared();
  const protectedModel = update(model, Message.ClickedMappingApplyProtection()).model;
  expect(workbenchMappingReview(protectedModel).applyReason).toContain('protected');
  const denied = update(protectedModel, request(protectedModel)).model;
  expect(denied.editor).toBe(model.editor);
  expect(denied.mappingReceipts).toBe(model.mappingReceipts);
  expect(denied.mappingReviewNotice).toContain('protected');
  let invalid = choose(model, 'node:note:1', 'domain-service');
  invalid = acknowledge(invalid);
  expect(workbenchMappingReview(invalid).applyReason).toContain('Issues');
  expect(update(invalid, request(invalid)).model.editor).toBe(invalid.editor);
  expect(update(invalid, request(invalid)).model.mappingReceipts).toHaveLength(0);
});
test('stale, hidden, historical, busy and unacknowledged requests cannot append receipts', () => {
  const model = prepared(),
    message = request(model);
  for (const state of [
    { ...model, modelEpoch: model.modelEpoch + 1 },
    {
      ...model,
      historyReview: createHistoryReview(
        captureEdition({
          id: 'historical',
          name: 'Historical',
          snapshot: { graph: model.editor.graph },
        }),
        model.editor,
      ),
    },
    { ...model, sidebarCollapsed: true },
    { ...model, sidebarSection: 'diagram' as const },
    { ...model, importing: { id: 1, revision: model.editor.revision } },
    { ...model, mappingLossConsent: null },
    { ...model, editor: { ...model.editor, readOnly: true } },
  ]) {
    const result = update(state, message).model;
    expect(result.editor).toBe(state.editor);
    expect(result.mappingReceipts).toHaveLength(0);
  }
  for (const changed of [
    { ...message, generation: message.generation - 1 },
    { ...message, planKey: 'old' },
    { ...message, modelId: 'other' },
  ])
    expect(update(model, changed).model).toBe(model);
});
test('retained receipts survive model switching and downloads are scoped Commands with safe failure feedback', () => {
  const model = prepared(),
    applied = update(model, request(model)).model,
    saved = applied.mappingReceipts[0];
  assert(saved, 'Missing receipt');
  const input = {
    modelId: applied.modelIdentity.id,
    epoch: applied.modelEpoch,
    receiptId: saved.id,
  };
  const download = update(applied, Message.ClickedDownloadConversionReceipt(input));
  expect(download.model.editor).toBe(applied.editor);
  expect(download.commands).toHaveLength(1);
  const failed = update(applied, Message.FailedConversionReceiptDownload(input)).model;
  expect(failed.mappingReceipts).toBe(applied.mappingReceipts);
  expect(failed.mappingReviewNotice).toContain('still retained');
  const other = update(
    {
      ...applied,
      savedModels: [
        {
          identity: { id: 'other', name: 'Other model', origin: null },
          editor: init().model.editor,
          editions: [],
          nodeDesign: 'cards',
        },
      ],
    },
    Message.SelectedWorkingModel({ id: 'other' }),
  ).model;
  expect(workbenchMappingReview(other).receipts).toHaveLength(0);
  expect(other.mappingReceipts).toBe(applied.mappingReceipts);
  expect(update(other, Message.ClickedDownloadConversionReceipt(input)).commands ?? []).toEqual([]);
  expect(update(other, Message.CompletedConversionReceiptDownload(input)).model).toBe(other);
  const returned = update(
    other,
    Message.SelectedWorkingModel({ id: applied.modelIdentity.id }),
  ).model;
  expect(workbenchMappingReview(returned).receipts).toHaveLength(1);
});
test('new accepted conversion after Undo appends a distinct receipt without rewriting earlier records', () => {
  const model = prepared(),
    first = update(model, request(model)).model;
  const undone = update(
    first,
    Message.ObservedZlozInput({ message: { type: 'UndoPressed' } }),
  ).model;
  let next = undone;
  for (const id of ['note:0', 'note:1', 'note:4', 'note:5'])
    next = choose(next, `node:${id}`, 'retain');
  for (const id of ['step:0', 'step:1', 'step:3', 'step:4'])
    next = choose(next, `edge:${id}`, 'retain');
  next = acknowledge(next);
  const second = update(next, request(next)).model;
  expect(second.mappingReceipts).toHaveLength(2);
  expect(second.mappingReceipts[0]).toBe(first.mappingReceipts[0]);
  expect(second.mappingReceipts[1]?.id).not.toBe(first.mappingReceipts[0]?.id);
});
test('native guarded Apply, protection reasons and receipt download survive minimal diagnostics', async () => {
  const model = prepared(),
    protectedModel = { ...model, protectMappingApply: true };
  const render = async (state: Model) =>
    (
      await Effect.runPromise(
        renderToString(
          {
            Flags: Schema.Struct({}),
            init: () => ({ model: state }),
            view: (current, h: HtmlBuilder<Message>) => ({
              title: 'Apply',
              body: mappingReviewPanel(current, h),
            }),
          },
          { flags: {}, isHydratable: false },
        ),
      )
    ).html;
  const blocked = await render(protectedModel);
  expect(blocked).toMatch(
    /<button\b(?=[^>]*aria-label="Apply DDD conversion")(?=[^>]*disabled)[^>]*>/u,
  );
  expect(blocked).toContain('aria-describedby="mapping-apply-reason"');
  const applied = update(model, request(model)).model;
  const html = await render({ ...applied, minimalMode: true, diagnosticsEnabled: false });
  expect(html).toContain('Retained conversion receipts');
  expect(html).toContain('Download conversion receipt 1');
  expect(html).toContain('independent of Undo');
});
