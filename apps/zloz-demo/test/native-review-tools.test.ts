import { expect, test } from 'bun:test';

import { Model, Message, update, type ReadyState } from '../src/group-workbench/main';
import type { NativeReviewEvent } from '../src/group-workbench/review-tools';
const ready = (model: Model): ReadyState => {
  if (model._tag !== 'Ready') throw new Error('Not ready');
  // SAFETY: Only this application's typed Ready constructor supplies test state.
  return model.state as ReadyState;
};
const initial = () =>
  update(Model.Preparing(), Message.SucceededIdentity({ id: 'native-review-test' })).model;
const event = (model: Model, e: NativeReviewEvent) =>
  update(model, Message.ObservedNativeReview({ event: e })).model;
test('native host publishes patch and receipt together, rejects stale consent and reopens read-only without touching working Undo', () => {
  let model = initial();
  model = event(model, { type: 'SamplePatchClicked' });
  const tools = ready(model).nativeTools,
    proposal = tools.proposal;
  if (proposal?.kind !== 'patch') throw new Error('Patch absent');
  // The package review owns exact source/output consent, not the host receipt store.
  const review = resolveModellingPatchReviewV3(
    ready(model).workbench.editor,
    ready(model).catalogue.id,
    proposal.patch,
  );
  model = event(model, { type: 'ConsentChanged', key: review.key!, accepted: true });
  model = event(model, { type: 'ApplyClicked' });
  expect(ready(model).workbench.editor.history.past).toHaveLength(1);
  const artifact = ready(model).nativeTools.artifact!;
  expect(artifact.filename).toContain('patch-receipt');
  const working = ready(model).workbench;
  model = event(model, { type: 'TextChanged', text: artifact.text });
  model = event(model, { type: 'OpenEvidenceClicked' });
  expect(ready(model).evidenceReview?.editor.readOnly).toBe(true);
  expect(ready(model).workbench).toBe(working);
  model = update(model, Message.ObservedWorkbenchInput({ event: { type: 'DeletePressed' } })).model;
  expect(ready(model).workbench).toBe(working);
  model = event(model, { type: 'EvidenceSideChosen', side: 'before' });
  expect(ready(model).nativeTools.opened?.side).toBe('before');
  model = event(model, { type: 'CloseEvidenceClicked' });
  model = update(model, Message.ObservedWorkbenchInput({ event: { type: 'UndoPressed' } })).model;
  expect(ready(model).workbench.editor.document.graph.nodes[0]?.label).toBe('Orders boundary');
});
import { resolveModellingPatchReviewV3 } from '@opsydyn/foldkit-zloz';
test('mapping preview retains explicit choices and blocks consent after source changes', () => {
  let model = event(initial(), {
    type: 'C4ChoiceClicked',
    nodeId: 'service',
    role: 'software-system',
  });
  const p = ready(model).nativeTools.proposal;
  expect(p?.kind).toBe('c4');
  model = update(
    model,
    Message.ObservedWorkbenchInput({
      event: { type: 'NodeSelected', id: 'service', additive: false },
    }),
  ).model;
  model = update(
    model,
    Message.ObservedWorkbenchInput({ event: { type: 'SelectionNudged', delta: { x: 20, y: 0 } } }),
  ).model;
  const editor = ready(model).workbench.editor;
  model = event(model, { type: 'ApplyClicked' });
  expect(ready(model).workbench.editor).toBe(editor);
  expect(ready(model).nativeTools.notice).toContain('source changed');
  expect(ready(model).nativeTools.artifact).toBeNull();
});

test('native evidence reads ignore old completions and preserve working state after intervening gestures or edits', () => {
  let model = initial();
  const file = new File(['{}'], 'receipt.json', { type: 'application/json' });
  model = update(model, Message.ChoseNativeEvidenceFiles({ files: [file] })).model;
  model = update(model, Message.ChoseNativeEvidenceFiles({ files: [file] })).model;
  expect(update(model, Message.SucceededNativeRead({ token: 1, text: '{}' })).model).toBe(model);
  model = update(
    model,
    Message.ObservedWorkbenchInput({
      event: { type: 'NodeSelected', id: 'service', additive: false },
    }),
  ).model;
  model = update(
    model,
    Message.ObservedWorkbenchInput({ event: { type: 'SelectionNudged', delta: { x: 20, y: 0 } } }),
  ).model;
  const working = ready(model).workbench;
  model = update(model, Message.SucceededNativeRead({ token: 2, text: '{}' })).model;
  expect(ready(model).workbench).toBe(working);
  expect(ready(model).notice).toContain('stale');
  expect(ready(model).evidenceReview).toBeNull();
  model = update(model, Message.ChoseNativeEvidenceFiles({ files: [file] })).model;
  model = event(model, { type: 'TextChanged', text: 'newer user intent' });
  expect(update(model, Message.SucceededNativeRead({ token: 3, text: '{}' })).model).toBe(model);
});

import { createGroupEditorV3, captureGroupDocumentV3 } from '@opsydyn/foldkit-zloz';

import {
  createNativeReviewTools,
  updateNativeReviewTools,
} from '../src/group-workbench/review-tools';
test('mapping review composes multiple explicit node choices and invalidates acknowledgement on each change', () => {
  const state = ready(initial()),
    snapshot = captureGroupDocumentV3({
      ...state.workbench.editor.document,
      graph: {
        ...state.workbench.editor.document.graph,
        nodes: state.workbench.editor.document.graph.nodes.map((n) =>
          n.id === 'warehouse'
            ? { ...n, architecture: { family: 'event-storming', role: 'command' } }
            : n,
        ),
      },
    }),
    editor = createGroupEditorV3(snapshot, { sessionId: 'two-choices' }),
    document = { ...state.catalogue, snapshot };
  const first = updateNativeReviewTools(
    createNativeReviewTools(),
    { type: 'C4ChoiceClicked', nodeId: 'service', role: 'software-system' },
    editor,
    document,
  );
  const second = updateNativeReviewTools(
    { ...first.tools, consentKey: 'outdated' },
    { type: 'C4ChoiceClicked', nodeId: 'warehouse', role: 'software-system' },
    editor,
    document,
  );
  expect(second.tools.proposal?.kind).toBe('c4');
  if (second.tools.proposal?.kind !== 'c4') throw new Error('Expected C4 choices');
  expect(second.tools.proposal.options.mappings?.nodes?.map((n) => n.nodeId)).toEqual([
    'service',
    'warehouse',
  ]);
  expect(second.tools.consentKey).toBeNull();
  expect(second.editor).toBe(editor);
});

test('native conversion requires an explicit decision for crossing workshop relations and retains it before atomic Apply', () => {
  let model = event(initial(), {
    type: 'C4ChoiceClicked',
    nodeId: 'service',
    role: 'software-system',
  });
  let state = ready(model),
    document = { ...state.catalogue, snapshot: state.workbench.editor.document };
  expect(
    nativeReviewContext(state.nativeTools, state.workbench.editor, document, {}, false).reason,
  ).toContain('Resolve every');
  model = event(model, { type: 'RelationRetained', family: 'c4', edgeId: 'service-events' });
  state = ready(model);
  document = { ...state.catalogue, snapshot: state.workbench.editor.document };
  const review = nativeReviewContext(
    state.nativeTools,
    state.workbench.editor,
    document,
    {},
    false,
  );
  expect(review.reason).toBeNull();
  model = event(model, { type: 'ConsentChanged', key: review.key!, accepted: true });
  model = event(model, { type: 'ApplyClicked' });
  expect(ready(model).workbench.editor.history.past).toHaveLength(1);
  expect(ready(model).nativeTools.artifact?.filename).toContain('c4');
  expect(ready(model).workbench.editor.document.graph.edges[0]?.id).toBe('service-events');
});
import { nativeReviewContext } from '../src/group-workbench/review-tools';
