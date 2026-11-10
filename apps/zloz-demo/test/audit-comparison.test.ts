import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import {
  createEditor,
  createEditionPlayback,
  updateEditionPlayback,
  updateEditor,
} from '@opsydyn/foldkit-zloz';

import { auditExampleEditions, workbenchAuditContext } from '../src/editor/audit-comparison';
import { Message } from '../src/editor/message';
import { init, type Model } from '../src/editor/model';
import { update } from '../src/editor/update';

function ready(): Model {
  const initial = init().model,
    edition = auditExampleEditions()[1];
  assert(edition);
  const first = edition.snapshot.graph.nodes[0];
  assert(first);
  const editor = updateEditor(createEditor(edition.snapshot.graph), {
    type: 'NodeLabelChanged',
    id: first.id,
    label: 'Working actor',
  });
  return update(
    { ...initial, editor: { ...editor, surface: { width: 1100, height: 750 } } },
    Message.ClickedAuditExample(),
  ).model;
}
function message(model: Model, kind: 'introduced' | 'resolved' | 'persisting') {
  const entry = workbenchAuditContext(model).entries.find((entry) => entry.kind === kind);
  assert(entry);
  return Message.ObservedAuditComparisonInput({
    modelId: model.modelIdentity.id,
    epoch: model.modelEpoch,
    request: entry.request,
  });
}
test('example loads owned editions and native findings open the correct read-only side without editing working Undo', () => {
  const model = ready();
  expect(workbenchAuditContext(model).comparison?.summary).toEqual({
    introduced: 1,
    resolved: 2,
    persisting: 1,
  });
  const sameSide = update(model, message(model, 'introduced')).model;
  expect(sameSide.modelEpoch).toBe(model.modelEpoch);
  expect(update(sameSide, message(model, 'resolved')).model.historyReview?.editionId).toBe(
    'audit-before',
  );
  for (const kind of ['introduced', 'resolved', 'persisting'] as const) {
    const focused = update(model, message(model, kind)).model;
    expect(focused.historyReview?.editionId).toBe(
      kind === 'resolved' ? 'audit-before' : 'audit-after',
    );
    expect(focused.historyReview?.editor.readOnly).toBe(true);
    expect(focused.historyReview?.editor.notice).toContain('Revealed connection');
    expect(
      focused.historyReview?.editor.graph.edges.some(
        (edge) =>
          edge.id ===
          (kind === 'introduced'
            ? 'audit-added'
            : kind === 'resolved'
              ? 'audit-fixed'
              : 'audit-keep'),
      ),
    ).toBe(true);
    expect(focused.auditComparison).toBe(model.auditComparison);
    expect(focused.editor).toBe(model.editor);
    expect(focused.editor.past).toHaveLength(1);
    expect(focused.editions).toBe(model.editions);
  }
});
test('current target reveals a live edge while preserving graph, revision and Undo; stale requests cannot navigate', () => {
  const model = ready();
  const current = update(
    model,
    Message.ObservedAuditComparisonInput({
      modelId: model.modelIdentity.id,
      epoch: model.modelEpoch,
      request: { type: 'TargetSelected', editionId: null },
    }),
  ).model;
  const request = message(current, 'introduced');
  const focused = update(current, request).model;
  expect(focused.historyReview).toBeNull();
  expect(focused.editor.notice).toBe('Revealed connection Handles.');
  expect(focused.editor.viewport).not.toEqual(model.editor.viewport);
  expect(focused.editor.selectedEdges).toBe(model.editor.selectedEdges);
  expect(focused.editor.graph).toBe(model.editor.graph);
  expect(focused.editor.revision).toBe(model.editor.revision);
  expect(focused.editor.past).toBe(model.editor.past);
  for (const stale of [
    { ...request, epoch: request.epoch - 1 },
    { ...request, modelId: 'other' },
  ])
    expect(update(current, stale).model).toBe(current);
  expect(update(focused, request).model).toBe(focused);
  const hidden = { ...current, sidebarSection: 'diagram' as const };
  expect(update(hidden, request).model).toBe(hidden);
  const busy = { ...current, importing: { id: 1, revision: current.editor.revision } };
  expect(update(busy, request).model.historyReview).toBe(busy.historyReview);
});
test('finding focus pauses playback and rejects an old timer tick; filtered findings never navigate', () => {
  const model = ready();
  const cursor = updateEditionPlayback(
    createEditionPlayback(
      model.editions.map((edition) => edition.id),
      { intervalMs: 1000, reducedMotion: false },
    ),
    { type: 'PlayClicked' },
  );
  const playing = { ...model, historyPlayback: { cursor, editions: model.editions, session: 1 } };
  const request = message(playing, 'resolved');
  const focused = update(playing, request).model;
  expect(focused.historyPlayback?.cursor.status).toBe('paused');
  const tick = Message.AdvancedEditionPlayback({
    modelId: model.modelIdentity.id,
    run: playing.playbackRun,
    milliseconds: 1000,
  });
  expect(update(focused, tick).model.historyReview).toBe(focused.historyReview);
  const filtered = update(
    playing,
    Message.ObservedAuditComparisonInput({
      modelId: playing.modelIdentity.id,
      epoch: playing.modelEpoch,
      request: { type: 'FilterToggled', kind: 'resolved' },
    }),
  ).model;
  expect(filtered.historyPlayback?.cursor.status).toBe('playing');
  expect(update(filtered, request).model.historyReview).toBe(filtered.historyReview);
});
