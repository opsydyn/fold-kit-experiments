import assert from 'node:assert/strict';

import {
  createEditor,
  updateEditor,
  createEditionPlayback,
  updateEditionPlayback,
} from '@opsydyn/foldkit-zloz';
import { expect, test } from 'vitest';

import { auditExampleEditions, workbenchAuditContext } from '../src/editor/audit-comparison';
import { Message } from '../src/editor/message';
import { init, type Model } from '../src/editor/model';
import { workbenchPacketContext } from '../src/editor/review-packet';
import { update } from '../src/editor/update';
function ready(): Model {
  const initial = init().model,
    edition = auditExampleEditions()[1];
  assert(edition);
  const node = edition.snapshot.graph.nodes[0];
  assert(node);
  const editor = updateEditor(createEditor(edition.snapshot.graph), {
    type: 'NodeLabelChanged',
    id: node.id,
    label: 'Working copy',
  });
  return update({ ...initial, editor }, Message.ClickedAuditExample()).model;
}
function input(model: Model, type: 'ConsentChanged' | 'DownloadClicked') {
  const key = workbenchPacketContext(model).key;
  assert(key);
  return Message.ObservedReviewPacketInput({
    modelId: model.modelIdentity.id,
    epoch: model.modelEpoch,
    request: type === 'ConsentChanged' ? { type, key, accepted: true } : { type, key },
  });
}
test('workbench exports chosen audit snapshots via a Command with intact graph, revision, selection and Undo', () => {
  const model = ready();
  expect(update(model, input(model, 'DownloadClicked')).commands).toBeUndefined();
  const accepted = update(model, input(model, 'ConsentChanged')).model;
  const exported = update(accepted, input(accepted, 'DownloadClicked'));
  expect(exported.commands).toHaveLength(1);
  expect(exported.model.editor).toBe(model.editor);
  expect(exported.model.editions).toBe(model.editions);
  expect(exported.model.historyReview).toBe(model.historyReview);
  const context = workbenchPacketContext(accepted);
  assert(context.packet);
  expect(context.packet.baseline.source.id).toBe('audit-before');
  expect(context.packet.selected.source).toEqual({
    kind: 'edition',
    id: 'audit-after',
    name: 'Causal review · after',
  });
  expect(model.editor.past).toHaveLength(1);
  const completed = update(exported.model, Message.CompletedReviewPacketDownload()).model;
  expect(completed.notice).toContain('downloaded');
  expect(completed.editor).toBe(model.editor);
});
test('session, section, protection, target and convention changes cannot reuse an old download request', () => {
  const model = ready(),
    accepted = update(model, input(model, 'ConsentChanged')).model,
    request = input(accepted, 'DownloadClicked');
  for (const changed of [
    { ...accepted, modelEpoch: accepted.modelEpoch + 1 },
    { ...accepted, sidebarSection: 'diagram' as const },
    { ...accepted, modelIdentity: { ...accepted.modelIdentity, id: 'other' } },
    { ...accepted, importing: { id: 1, revision: accepted.editor.revision } },
    { ...accepted, auditComparison: { ...accepted.auditComparison, selectedId: null } },
    { ...accepted, customStormingRelationships: true },
  ])
    expect(update(changed, request).commands).toBeUndefined();
  const context = workbenchPacketContext({
    ...accepted,
    minimalMode: true,
    diagnosticsEnabled: false,
  });
  expect(context.consented).toBe(true);
  expect(context.packet).not.toBeNull();
});

test('packet and visible audit use the same custom convention catalogue', () => {
  const model = { ...ready(), customStormingRelationships: true };
  const context = workbenchPacketContext(model);
  assert(context.packet);
  expect(context.packet.conventions.source).toBe('custom');
  expect(context.packet.conventions.rules.at(-1)?.architecture).toEqual({
    family: 'event-storming',
    role: 'custom',
    name: 'delegates',
  });
  const comparison = workbenchAuditContext(model).comparison;
  assert(comparison);
  expect(context.packet.comparison).toEqual(comparison);
});

test('consenting to a packet pauses playback and invalidates its queued timer without changing working Undo', () => {
  const model = ready();
  const cursor = updateEditionPlayback(
    createEditionPlayback(
      model.editions.map((edition) => edition.id),
      { intervalMs: 1000, reducedMotion: false },
    ),
    { type: 'PlayClicked' },
  );
  const playing = { ...model, historyPlayback: { cursor, editions: model.editions, session: 1 } };
  const accepted = update(playing, input(playing, 'ConsentChanged')).model;
  expect(accepted.historyPlayback?.cursor.status).toBe('paused');
  const tick = Message.AdvancedEditionPlayback({
    modelId: model.modelIdentity.id,
    run: playing.playbackRun,
    milliseconds: 1000,
  });
  expect(update(accepted, tick).model.historyReview).toBe(accepted.historyReview);
  expect(accepted.editor).toBe(model.editor);
});
