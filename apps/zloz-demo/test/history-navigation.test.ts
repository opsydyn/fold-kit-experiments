import { expect, test } from 'bun:test';

import { updateEditor } from '@opsydyn/foldkit-zloz';

import { historyChangeNavigatorContext } from '../src/editor/history-navigation';
import { Message } from '../src/editor/message';
import { init, type Model } from '../src/editor/model';
import { update } from '../src/editor/update';
function ready(): Model {
  const initial = init().model;
  const edited = updateEditor(initial.editor, {
    type: 'NodeLabelChanged',
    id: 'source',
    label: 'Working draft',
  });
  const measured = { ...initial, editor: { ...edited, surface: { width: 1000, height: 700 } } };
  const history = update(
    update(measured, Message.SelectedWorkbenchSection({ section: 'history' })).model,
    Message.ClickedOrderHistory(),
  ).model;
  return update(history, Message.SelectedHistoryEdition({ id: 'order-evolved' })).model;
}
function request(model: Model, id: string, entity: 'node' | 'edge' = 'node') {
  const entry = historyChangeNavigatorContext(model).entries.find(
    (value) => value.id === id && value.entity === entity,
  );
  if (!entry) throw new Error('Missing fixture entry');
  return Message.ClickedHistoryChange({
    ...entry.request,
    modelId: model.modelIdentity.id,
    epoch: model.modelEpoch,
  });
}
test('removed focus frames earlier geometry without restoring content, changing ghost choices or working Undo', () => {
  const model = ready();
  const message = request(model, 'pricing');
  const focused = update(model, message).model;
  const node = model.editions
    .find((edition) => edition.id === 'order-start')
    ?.snapshot.graph.nodes.find((value) => value.id === 'pricing');
  const editor = focused.historyReview?.editor;
  if (!node || !editor?.surface) throw new Error('Missing review geometry');
  expect((editor.surface.width / 2 - editor.viewport.x) / editor.viewport.zoom).toBeCloseTo(
    node.position.x + node.size.width / 2,
  );
  expect((editor.surface.height / 2 - editor.viewport.y) / editor.viewport.zoom).toBeCloseTo(
    node.position.y + node.size.height / 2,
  );
  expect(editor.graph.nodes.some((value) => value.id === 'pricing')).toBe(false);
  expect(model.historyReview?.editor.graph).toBe(editor.graph);
  expect(focused.editor).toBe(model.editor);
  expect(focused.editor.past).toHaveLength(1);
  expect(focused.editions).toBe(model.editions);
  expect(focused.historyGhosts).toBe(model.historyGhosts);
});
test('selected node and edge focus use existing reveal paths and keep read-only projections', () => {
  const model = ready();
  for (const [id, entity] of [
    ['delivery', 'node'],
    ['delivery-trigger', 'edge'],
  ] as const) {
    const focused = update(model, request(model, id, entity)).model;
    expect(focused.historyReview?.editor.readOnly).toBe(true);
    expect(focused.historyReview?.editor.graph).toBe(model.historyReview?.editor.graph);
    expect(focused.historyReview?.editor.viewport).not.toEqual(
      model.historyReview?.editor.viewport,
    );
    expect(focused.editor).toBe(model.editor);
  }
});
test('stale model/epoch/comparison, hidden changes, absent surface and busy policies never move the camera', () => {
  const model = ready(),
    message = request(model, 'pricing');
  for (const stale of [
    { ...message, modelId: 'another' },
    { ...message, epoch: model.modelEpoch - 1 },
    { ...message, selectedId: 'missing' },
    { ...message, baselineId: 'missing' },
  ])
    expect(update(model, stale).model.historyReview).toBe(model.historyReview);
  const filtered = update(model, Message.ClickedHistoryChangeFilter({ kind: 'removed' })).model;
  expect(update(filtered, message).model.historyReview).toBe(model.historyReview);
  const review = model.historyReview;
  if (!review) throw new Error('Missing review');
  const unmeasured = {
    ...model,
    historyReview: { ...review, editor: { ...review.editor, surface: null } },
  };
  expect(update(unmeasured, message).model.historyReview).toBe(unmeasured.historyReview);
  const busy = { ...model, importing: { id: 100, revision: model.editor.revision } };
  expect(update(busy, message).model.historyReview).toBe(model.historyReview);
  expect(historyChangeNavigatorContext(busy).entries.every((entry) => entry.reason !== null)).toBe(
    true,
  );
  const present = update(model, Message.ClickedHistoryPresent()).model;
  expect(update(present, message).model.editor).toBe(model.editor);
});
test('a valid explicit focus pauses playback; a stale focus cannot interrupt it', () => {
  const loaded = update(ready(), Message.ClickedScrubberHistory()).model;
  const reviewed = update(loaded, Message.SelectedHistoryEdition({ id: 'scrubber-order-4' })).model;
  const reduced = update(
    reviewed,
    Message.ChangedPlaybackReducedMotion({ reducedMotion: false }),
  ).model;
  const visible = update(reduced, Message.ChangedPlaybackVisibility({ visible: true })).model;
  const enabled = update(visible, Message.ClickedPlaybackEnabled()).model;
  const started = update(enabled, Message.ClickedPlaybackPlay()).model;
  const message = request(started, 'pricing');
  expect(started.historyPlayback?.cursor.status).toBe('playing');
  const stale = update(started, { ...message, modelId: 'stale' }).model;
  expect(stale.historyPlayback?.cursor.status).toBe('playing');
  const focused = update(started, message).model;
  expect(focused.historyPlayback?.cursor.status).toBe('paused');
  expect(focused.editor).toBe(started.editor);
  const tick = Message.AdvancedEditionPlayback({
    modelId: started.modelIdentity.id,
    run: started.playbackRun,
    milliseconds: 1000,
  });
  expect(update(focused, tick).model.historyReview).toBe(focused.historyReview);
});
