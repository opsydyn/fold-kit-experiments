import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import {
  createEditor,
  updateEditor,
  createEditionPlayback,
  updateEditionPlayback,
} from '@opsydyn/foldkit-zloz';

import { dddAuditExampleEditions, workbenchDddAuditContext } from '../src/editor/ddd-audit';
import { Message } from '../src/editor/message';
import { init, type Model } from '../src/editor/model';
import { update } from '../src/editor/update';
function ready(): Model {
  const graph = dddAuditExampleEditions()[1]?.snapshot.graph;
  assert(graph);
  const editor = updateEditor(createEditor(graph), {
    type: 'NodeLabelChanged',
    id: 'order',
    label: 'Working order',
  });
  return update(
    { ...init().model, editor: { ...editor, surface: { width: 1100, height: 750 } } },
    Message.ClickedDddAuditExample(),
  ).model;
}
function focus(
  model: Model,
  kind: 'introduced' | 'resolved' | 'persisting' | 'current',
  subject: 'edge' | 'source' | 'target' = 'edge',
) {
  const entry = workbenchDddAuditContext(model).entries.find((e) => e.kind === kind);
  assert(entry);
  return Message.ObservedDddAuditInput({
    modelId: model.modelIdentity.id,
    epoch: model.modelEpoch,
    request: { ...entry.request, subject },
  });
}
test('DDD review opens the correct immutable edition and node or edge, preserving working graph and Undo', () => {
  const model = ready();
  expect(workbenchDddAuditContext(model).comparison?.summary).toEqual({
    introduced: 2,
    resolved: 3,
    persisting: 1,
  });
  for (const kind of ['introduced', 'resolved', 'persisting'] as const) {
    for (const subject of ['edge', 'source', 'target'] as const) {
      const next = update(model, focus(model, kind, subject)).model;
      expect(next.historyReview?.editionId).toBe(kind === 'resolved' ? 'ddd-before' : 'ddd-after');
      expect(next.historyReview?.editor.readOnly).toBe(true);
      expect(next.historyReview?.editor.notice).toContain(
        subject === 'edge' ? 'Revealed connection' : 'Revealed',
      );
      expect(next.editor).toBe(model.editor);
      expect(next.editor.past).toHaveLength(1);
      expect(next.editions).toBe(model.editions);
    }
  }
});
test('DDD single-target current review is independent of camera, rejects stale/hidden/busy input and preserves source', () => {
  const model = ready();
  const current = { ...model, dddAudit: { ...model.dddAudit, baselineId: null, selectedId: null } };
  const request = focus(current, 'current');
  const next = update(current, request).model;
  expect(next.historyReview).toBeNull();
  expect(next.editor.graph).toBe(current.editor.graph);
  expect(next.editor.past).toBe(current.editor.past);
  expect(next.editor.revision).toBe(current.editor.revision);
  for (const stale of [
    { ...request, epoch: request.epoch - 1 },
    { ...request, modelId: 'other' },
  ])
    expect(update(current, stale).model).toBe(current);
  expect(update({ ...current, sidebarSection: 'diagram' }, request).model.historyReview).toBe(
    current.historyReview,
  );
  const busy = { ...current, importing: { id: 1, revision: current.editor.revision } };
  expect(update(busy, request).model.historyReview).toBe(busy.historyReview);
  const filtered = {
    ...model,
    dddAudit: { ...model.dddAudit, filters: { ...model.dddAudit.filters, introduced: false } },
  };
  expect(update(filtered, focus(model, 'introduced')).model.historyReview).toBe(
    filtered.historyReview,
  );
});
test('DDD navigation pauses playback and old ticks cannot replace the chosen side', () => {
  const model = ready();
  const cursor = updateEditionPlayback(
    createEditionPlayback(
      model.editions.map((e) => e.id),
      { intervalMs: 1000, reducedMotion: false },
    ),
    { type: 'PlayClicked' },
  );
  const playing = { ...model, historyPlayback: { cursor, editions: model.editions, session: 1 } };
  const focused = update(playing, focus(playing, 'resolved')).model;
  expect(focused.historyPlayback?.cursor.status).toBe('paused');
  const tick = Message.AdvancedEditionPlayback({
    modelId: model.modelIdentity.id,
    run: playing.playbackRun,
    milliseconds: 1000,
  });
  expect(update(focused, tick).model.historyReview).toBe(focused.historyReview);
});
