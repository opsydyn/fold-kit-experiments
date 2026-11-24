import {
  createModelEditorV2,
  captureModellingPatchV2,
  updateEditor,
  serializeModellingPatchReceiptV2,
} from '@opsydyn/foldkit-zloz';
import { expect, test } from 'vitest';

import {
  nativeReview,
  nativeSource,
  nativeArtifact,
} from '../src/history-workbench/native-authoring';
import { init, update, Message } from '../src/history-workbench/state';

const step = (model: ReturnType<typeof init>['model'], message: Message) =>
  update(model, message).model;
function readyModel() {
  return step(init().model, Message.SucceededNativeSession({ id: 'test-session' }));
}
function proposed() {
  let model = step(readyModel(), Message.SelectedSection({ section: 'authoring' }));
  model = step(model, Message.ClickedExampleProposal());
  return step(model, Message.ClickedReviewProposal());
}
function accepted() {
  let model = proposed();
  model = step(model, Message.ClickedPatchAcknowledgement({ part: 'reviewed' }));
  return step(model, Message.ClickedPatchAcknowledgement({ part: 'lossesAccepted' }));
}
test('exact native review applies editor and receipt together with one mode-preserving Undo', () => {
  const model = accepted(),
    review = nativeReview(model)!;
  expect(review.canApply).toBe(true);
  expect(review.preview.type).toBe('reviewable');
  const applied = step(model, Message.ClickedApplyProposal({ key: review.key! }));
  expect(applied.editor.graph.nodes[0]!.label).toBe('Orders — reviewed');
  expect(applied.native.receipts).toHaveLength(1);
  expect(applied.native.receipts[0]!.revision).toBe(applied.editor.revision);
  expect(updateEditor(applied.editor, { type: 'UndoPressed' }).graph).toEqual(model.editor.graph);
  expect(applied.editor.connectionMode).toBe(model.editor.connectionMode);
  expect(applied.editor.past.length).toBe(model.editor.past.length + 1);
});
test('live protection, stale revision/mode and missing consent never publish a receipt', () => {
  const model = accepted(),
    key = nativeReview(model)!.key!;
  for (const blocked of [
    proposed(),
    step(model, Message.ClickedPatchProtection()),
    { ...model, editor: { ...model.editor, connectionMode: 'loose' as const } },
    { ...model, editor: { ...model.editor, revision: model.editor.revision + 1 } },
    { ...model, epoch: model.epoch + 1 },
  ]) {
    const result = step(blocked, Message.ClickedApplyProposal({ key }));
    expect(result.editor).toBe(blocked.editor);
    expect(result.native.receipts).toHaveLength(0);
  }
  const protectedModel = step(model, Message.ClickedPatchProtection());
  expect(nativeReview(protectedModel)!.reason).toContain('protected');
});
test('changing proposal text clears consent and cannot apply the previous proposal', () => {
  const model = accepted(),
    key = nativeReview(model)!.key!;
  const changed = step(model, Message.ChangedProposalText({ text: '{bad' }));
  expect(nativeReview(changed)).toBeNull();
  expect(step(changed, Message.ClickedApplyProposal({ key })).editor).toBe(model.editor);
});
test('receipt reopening and side selection are detached and preserve the working session', () => {
  const model = accepted();
  const applied = step(model, Message.ClickedApplyProposal({ key: nativeReview(model)!.key! }));
  const json = serializeModellingPatchReceiptV2(applied.native.receipts[0]!);
  const result = nativeArtifact('receipt', json, applied.editor, 'baseline');
  expect(result.type).toBe('opened');
  if (result.type !== 'opened') throw new Error('Expected native receipt');
  expect(result.inspection.review.editor.readOnly).toBe(true);
  expect(result.inspection.review.editor.graph).toEqual(model.editor.graph);
  expect(result.inspection.review.editor.past).toHaveLength(0);
  expect(applied.editor.graph.nodes[0]!.label).toBe('Orders — reviewed');
  expect(nativeSource(applied).sessionId).not.toBe('');
  const forged = JSON.parse(json);
  forged.snapshot.graph.nodes[0].label = 'Forged';
  expect(nativeArtifact('receipt', JSON.stringify(forged), applied.editor, 'selected').type).toBe(
    'rejected',
  );
});

test('artifact reads reject cancellation, stale sources and cross-workflow edits', () => {
  const ready = step(readyModel(), Message.SelectedSection({ section: 'evidence' }));
  const reading = step(
    ready,
    Message.ChoseNativeFile({ kind: 'receipt', files: [new File(['{}'], 'receipt.json')] }),
  );
  const token = reading.native.pending!.token;
  expect(reading.editor).toBe(ready.editor);
  const cancelled = step(reading, Message.ClickedCancelNativeRead());
  expect(step(cancelled, Message.SucceededNativeRead({ token, text: '{}' }))).toBe(cancelled);
  const stale = step(
    { ...reading, epoch: reading.epoch + 1 },
    Message.SucceededNativeRead({ token, text: '{}' }),
  );
  expect(stale.native.inspection).toBeNull();
  expect(stale.native.notice).toContain('changed during read');
  for (const message of [
    Message.ClickedCapture(),
    Message.ClickedPreviousSession(),
    Message.ClickedRestoreConfirm(),
    Message.ClickedReview(),
  ]) {
    const blocked = step(reading, message);
    expect(blocked.editor).toBe(reading.editor);
    expect(blocked.editions).toBe(reading.editions);
    expect(blocked.review).toBeNull();
  }
});

test('opening and switching native receipt sides preserves graph, mode, history and ignores old canvas bindings', () => {
  const model = accepted();
  const applied = step(model, Message.ClickedApplyProposal({ key: nativeReview(model)!.key! }));
  const ready = step(applied, Message.SelectedSection({ section: 'evidence' }));
  const reading = step(
    ready,
    Message.ChoseNativeFile({ kind: 'receipt', files: [new File(['{}'], 'receipt.json')] }),
  );
  let opened = step(
    reading,
    Message.SucceededNativeRead({
      token: reading.native.pending!.token,
      text: serializeModellingPatchReceiptV2(applied.native.receipts[0]!),
    }),
  );
  expect(opened.native.inspection?.side).toBe('selected');
  expect(opened.epoch).toBeGreaterThan(reading.epoch);
  const old = step(
    opened,
    Message.ObservedEditor({
      epoch: reading.epoch,
      event: { type: 'NodeLabelChanged', id: 'a', label: 'Late' },
    }),
  );
  expect(old).toBe(opened);
  opened = step(opened, Message.SelectedNativeSide({ side: 'baseline' }));
  expect(opened.native.inspection?.review.editor.graph).toEqual(model.editor.graph);
  expect(opened.editor).toBe(applied.editor);
  const closed = step(opened, Message.ClickedCloseNativeReview());
  expect(closed.editor).toBe(applied.editor);
  expect(closed.native.inspection).toBeNull();
  expect(closed.native.consent).toBeNull();
});

test('a fresh page incarnation cannot reuse old proposal consent or accept a late session rebind', () => {
  const model = accepted();
  const key = nativeReview(model)!.key!;
  const fresh = { ...model, native: { ...model.native, sessionId: 'different-page' } };
  expect(step(fresh, Message.ClickedApplyProposal({ key })).native.receipts).toHaveLength(0);
  expect(step(model, Message.SucceededNativeSession({ id: 'late-rebind' }))).toBe(model);
  const unavailable = { ...model, native: { ...model.native, sessionId: null } };
  expect(nativeReview(unavailable)!.canApply).toBe(false);
});

test('oversized generated receipt fails visibly without publishing a partial edit', () => {
  let model = readyModel();
  const graph = {
    ...model.editor.graph,
    nodes: model.editor.graph.nodes.map((n, i) =>
      i === 0 ? { ...n, data: { large: 'x'.repeat(1_020_000) } } : n,
    ),
  };
  model = {
    ...model,
    section: 'authoring',
    editor: createModelEditorV2({
      ...model.identity,
      origin: null,
      editions: [],
      snapshot: { version: 2, connectionMode: 'strict', graph },
    }),
  };
  const oversizedExample = step(model, Message.ClickedExampleProposal());
  expect(oversizedExample.editor).toBe(model.editor);
  expect(oversizedExample.native.patch).toBeNull();
  expect(oversizedExample.native.notice).toContain('exceeds');
  const patch = captureModellingPatchV2({
    format: 'foldkit-zloz-patch',
    version: 2,
    id: 'large-receipt',
    source: nativeSource(model),
    provenance: {
      actor: { kind: 'human', id: 'test' },
      reason: 'Rename second node',
      references: [],
    },
    operations: [
      {
        id: 'rename',
        type: 'node.replace',
        node: { ...graph.nodes[1]!, label: 'Renamed billing' },
      },
    ],
  });
  model = step(model, Message.ChangedProposalText({ text: JSON.stringify(patch) }));
  model = step(model, Message.ClickedReviewProposal());
  model = step(model, Message.ClickedPatchAcknowledgement({ part: 'reviewed' }));
  model = step(model, Message.ClickedPatchAcknowledgement({ part: 'lossesAccepted' }));
  const review = nativeReview(model)!;
  expect(review.canApply).toBe(true);
  const result = step(model, Message.ClickedApplyProposal({ key: review.key! }));
  expect(result.editor).toBe(model.editor);
  expect(result.native.receipts).toHaveLength(0);
  expect(result.native.notice).toContain('exceeds 2000000');
});
