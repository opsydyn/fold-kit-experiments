import assert from 'node:assert/strict';

import { Effect } from 'effect';
import { expect, test } from 'vitest';

import { Message } from '../src/editor/message';
import { init, type Model } from '../src/editor/model';
import { patchWorkbenchState, patchWorkbenchReview } from '../src/editor/patch-review';
import { update } from '../src/editor/update';
const base = (): Model => ({ ...init().model, sidebarSection: 'patch' });
function example(model = base()) {
  return update(model, Message.ClickedPatchExample({ scope: patchWorkbenchState(model).scope }))
    .model;
}
function ack(model: Model) {
  const review = patchWorkbenchReview(model);
  assert(review?.key);
  return update(
    model,
    Message.ObservedPatchReviewInput({
      scope: patchWorkbenchState(model).scope,
      request: { type: 'AcknowledgementChanged', key: review.key, accepted: true },
    }),
  ).model;
}
function apply(model: Model, key?: string) {
  return update(
    model,
    Message.ObservedPatchReviewInput({
      scope: patchWorkbenchState(model).scope,
      request: { type: 'ApplyClicked', key: key ?? patchWorkbenchReview(model)?.key },
    }),
  ).model;
}
test('review and guarded Apply publish editor plus retained receipt together; Undo retains provenance', () => {
  const before = base(),
    proposed = example(before),
    accepted = ack(proposed),
    after = apply(accepted);
  expect(proposed.editor).toBe(before.editor);
  expect(after.editor.past).toHaveLength(1);
  expect(after.patchWorkbench.receipts).toHaveLength(1);
  expect(after.editor.graph.nodes[0]?.label).toContain('reviewed');
  expect(after.patchWorkbench.receipts[0]?.graph).toBe(after.editor.graph);
  const undone = update(
    after,
    Message.ObservedModelInput({
      modelId: after.modelIdentity.id,
      epoch: after.modelEpoch,
      message: { type: 'UndoPressed' },
    }),
  ).model;
  expect(undone.editor.graph).toEqual(before.editor.graph);
  expect(undone.patchWorkbench.receipts).toBe(after.patchWorkbench.receipts);
  const receipt = after.patchWorkbench.receipts[0];
  assert(receipt);
  const downloaded = update(
    after,
    Message.ClickedPatchDownload({
      scope: patchWorkbenchState(after).scope,
      kind: 'receipt',
      receiptId: `${receipt.patch.source.sessionId}:${receipt.revision}`,
    }),
  );
  expect(downloaded.commands).toHaveLength(1);
  expect(downloaded.model.editor).toBe(after.editor);
});
test('live protection, stale consent and model changes preserve the working editor', () => {
  const accepted = ack(example()),
    key = patchWorkbenchReview(accepted)?.key;
  assert(key);
  const protectedModel = update(accepted, Message.ClickedPatchProtection()).model;
  expect(apply(protectedModel).editor).toBe(protectedModel.editor);
  const changed = update(
    accepted,
    Message.ObservedModelInput({
      modelId: accepted.modelIdentity.id,
      epoch: accepted.modelEpoch,
      message: { type: 'SelectionNudged', id: 'source', delta: { x: 10, y: 0 } },
    }),
  ).model;
  expect(apply(changed, key).editor).toBe(changed.editor);
  const other = { ...accepted, modelEpoch: accepted.modelEpoch + 1 };
  expect(apply(other, key).editor).toBe(other.editor);
});
test('bounded reads, cancellation, failures and stale completions retain the last proposal', async () => {
  const model = example(),
    state = patchWorkbenchState(model),
    json = JSON.stringify(state.patch);
  const read = (data: string) =>
    update(
      model,
      Message.ChosePatchFiles({ scope: state.scope, files: [new File([data], 'patch.json')] }),
    );
  const bad = read('{bad');
  assert(bad.commands?.[0]);
  const failed = update(bad.model, await Effect.runPromise(bad.commands[0].effect)).model;
  expect(failed.patchWorkbench.patch).toBe(state.patch);
  expect(failed.patchWorkbench.notice).toContain('invalid-json');
  const started = read(json);
  assert(started.commands?.[0]);
  const pending = patchWorkbenchState(started.model);
  assert(pending.pending);
  const cancelled = update(
    started.model,
    Message.ClickedPatchReadCancel({ scope: state.scope, run: pending.pending.run }),
  ).model;
  expect(update(cancelled, await Effect.runPromise(started.commands[0].effect)).model).toBe(
    cancelled,
  );
  const changed = { ...started.model, modelEpoch: started.model.modelEpoch + 1 };
  expect(update(changed, await Effect.runPromise(started.commands[0].effect)).model).toBe(changed);
  const overlay = {
    ...started.model,
    historyReview: { editionId: 'past', editor: { ...model.editor, readOnly: true } },
  };
  const denied = update(overlay, await Effect.runPromise(started.commands[0].effect)).model;
  expect(denied.patchWorkbench.patch).toBe(state.patch);
  expect(denied.patchWorkbench.pending).toBeNull();
  expect(denied.editor).toBe(model.editor);
  const valid = update(started.model, await Effect.runPromise(started.commands[0].effect)).model;
  expect(valid.patchWorkbench.patch?.id).toBe(state.patch?.id);
  expect(valid.editor).toBe(model.editor);
});

test('an oversized working source reports the package limit without losing the last proposal', () => {
  const before = example(),
    node = before.editor.graph.nodes[0];
  assert(node);
  const large = {
    ...before,
    editor: {
      ...before.editor,
      graph: {
        ...before.editor.graph,
        nodes: [{ ...node, data: 'x'.repeat(2000001) }, ...before.editor.graph.nodes.slice(1)],
      },
    },
  };
  const review = patchWorkbenchReview(large);
  expect(review?.preview.type).toBe('rejected');
  expect(review?.reason).toContain('2000000');
  const retried = example(large);
  expect(retried.editor).toBe(large.editor);
  expect(retried.patchWorkbench.patch).toBe(before.patchWorkbench.patch);
  expect(retried.patchWorkbench.notice).toContain('Previous proposal preserved');
});
