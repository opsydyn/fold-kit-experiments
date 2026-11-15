import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { updateEditor } from '@opsydyn/foldkit-zloz';
import { Effect } from 'effect';

import { workbenchAlchemyFindings } from '../src/editor/alchemy-review';
import { decodeAlchemyText, alchemyTextLimits } from '../src/editor/alchemy-text';
import { Message } from '../src/editor/message';
import { init, type Model } from '../src/editor/model';
import { update } from '../src/editor/update';
const sample = readFileSync(new URL('../src/editor/alchemy-example.json', import.meta.url), 'utf8');
function open(model: Model = init().model, json = sample) {
  return update(
    update(
      update(model, Message.SelectedWorkbenchSection({ section: 'alchemy' })).model,
      Message.ChangedAlchemyText({ text: json }),
    ).model,
    Message.ClickedAlchemyReview(),
  ).model;
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
    'packetReader',
    'patchWorkbench',
  ] as const)
    expect(after[key]).toBe(before[key]);
}
test('bounded text rejects ambiguous, malformed and excessive JSON before descriptor projection', () => {
  const good = decodeAlchemyText(sample);
  assert(good.type === 'reviewable');
  expect(good.source.source.revision).toBe('fixture-v1');
  expect(good.coverage).toHaveLength(23);
  for (const text of [
    sample.replace('"version": 1', '"version": 1, "\\u0076ersion": 1'),
    sample + '{}',
    sample + ' garbage',
    sample.slice(0, -2),
    '{"x":' + '['.repeat(17) + '0' + ']'.repeat(17) + '}',
    '[' + '0,'.repeat(alchemyTextLimits.maxValues) + '0]',
    ' '.repeat(alchemyTextLimits.maxBytes + 1),
    '"' + '🌌'.repeat(alchemyTextLimits.maxBytes / 4) + '"',
    sample.replace('"version": 1', '"version": 1e999'),
    sample.replace('"version": 1', '"version": 01'),
    sample.replace('"version": 1', '"version": 2'),
    sample.replace('"version": 1', '"version": 1, "graph": {}'),
  ]) {
    const result = decodeAlchemyText(text);
    expect(result.type).toBe('blocked');
    expect('graph' in result).toBe(false);
  }
  expect(decodeAlchemyText(sample.replaceAll('\n', '\r\n')).type).toBe('reviewable');
  expect(decodeAlchemyText(sample.padEnd(alchemyTextLimits.maxBytes, ' ')).type).toBe('reviewable');
});
test('review is detached, keeps provenance/losses and rejects edits and working actions; close restores working history', () => {
  const base = init().model;
  const source = {
    ...base,
    editor: updateEditor(base.editor, {
      type: 'NodeLabelChanged',
      id: 'source',
      label: 'Unrelated edit',
    }),
  };
  const reviewed = open(source),
    review = reviewed.alchemyReview.review;
  assert(review);
  preserved(source, reviewed);
  expect(review.editor.readOnly).toBe(true);
  expect(review.projection.source.source).toEqual({
    packageVersion: '2.0.0-beta.85',
    namespace: 'example/bank',
    modelName: 'Bank',
    revision: 'fixture-v1',
  });
  expect(review.projection.findings.filter((f) => f.severity === 'loss')).toHaveLength(8);
  for (const message of [
    Message.ObservedZlozInput({
      message: { type: 'NodeLabelChanged', id: 'source', label: 'Bad' },
    }),
    Message.SelectedExample({ example: 'event-storming' }),
    Message.ObservedAlchemyInput({
      id: review.id,
      message: {
        type: 'NodeLabelChanged',
        id: 'example%2Fbank/Bank/view/AccountSummary',
        label: 'Bad',
      },
    }),
    Message.ObservedAlchemyInput({ id: review.id - 1, message: { type: 'FitViewClicked' } }),
  ])
    expect(update(reviewed, message).model).toBe(reviewed);
  const moved = update(
    reviewed,
    Message.ObservedAlchemyInput({
      id: review.id,
      message: { type: 'SurfaceMeasured', size: { width: 900, height: 600 } },
    }),
  ).model;
  preserved(source, moved);
  expect(moved.alchemyReview.review?.editor.surface).toEqual({ width: 900, height: 600 });
  expect(moved.alchemyReview.review?.editor.viewport.zoom).not.toBe(review.editor.viewport.zoom);
  expect(moved.alchemyReview.review?.editor.past).toHaveLength(0);
  const invalid = open(moved, '{"format":"wrong"}');
  expect(invalid.alchemyReview.review).toBe(moved.alchemyReview.review);
  expect(invalid.alchemyReview.notice).toContain('Rejected');
  const closed = update(invalid, Message.ClickedCloseAlchemyReview()).model;
  expect(closed.alchemyReview.review).toBeNull();
  preserved(source, closed);
});
test('file reads are bounded/fatal UTF-8 and stale/cancelled results cannot replace a review', async () => {
  const base = open();
  const chosen = update(
    base,
    Message.ChoseAlchemyFiles({ files: [new File([sample], 'bank.json')] }),
  );
  assert(chosen.commands?.[0]);
  const settled = await Effect.runPromise(chosen.commands[0].effect);
  const cancelled = update(chosen.model, Message.ClickedCancelAlchemyRead()).model;
  expect(update(cancelled, settled).model).toBe(cancelled);
  const edited = update(chosen.model, Message.ChangedAlchemyText({ text: '{}' })).model;
  expect(update(edited, settled).model).toBe(edited);
  const loaded = update(chosen.model, settled).model;
  expect(loaded.alchemyReview.review?.id).not.toBe(base.alchemyReview.review?.id);
  preserved(base, loaded);
  for (const file of [
    new File([new Uint8Array([0xff])], 'invalid.json'),
    new File([' '.repeat(alchemyTextLimits.maxBytes + 1)], 'big.json'),
  ]) {
    const pending = update(base, Message.ChoseAlchemyFiles({ files: [file] }));
    const result = pending.commands?.[0]
      ? update(pending.model, await Effect.runPromise(pending.commands[0].effect)).model
      : pending.model;
    expect(result.alchemyReview.review).toBe(base.alchemyReview.review);
    expect(result.alchemyReview.notice).toContain('Rejected');
    preserved(base, result);
  }
  const other = { ...chosen.model, modelEpoch: chosen.model.modelEpoch + 1 };
  expect(update(other, settled).model).toBe(other);
});

test('conflicting reads cannot open a descriptor review; latest read wins', async () => {
  const selected = update(
    init().model,
    Message.SelectedWorkbenchSection({ section: 'alchemy' }),
  ).model;
  for (const busy of [
    { ...selected, receiptRead: { id: 1, modelId: selected.modelIdentity.id, epoch: 0 } },
    {
      ...selected,
      patchWorkbench: { ...selected.patchWorkbench, pending: { run: 1, revision: 0 } },
    },
  ]) {
    const blocked = update(busy, Message.ClickedAlchemyExample()).model;
    expect(blocked.alchemyReview.review).toBeNull();
    preserved(busy, blocked);
  }
  const first = update(
    selected,
    Message.ChoseAlchemyFiles({ files: [new File([sample], 'old.json')] }),
  );
  const second = update(
    first.model,
    Message.ChoseAlchemyFiles({
      files: [new File([sample.replace('fixture-v1', 'fixture-v2')], 'new.json')],
    }),
  );
  assert(first.commands?.[0] && second.commands?.[0]);
  const newest = update(second.model, await Effect.runPromise(second.commands[0].effect)).model;
  expect(newest.alchemyReview.review?.projection.source.source.revision).toBe('fixture-v2');
  expect(update(newest, await Effect.runPromise(first.commands[0].effect)).model).toBe(newest);
  preserved(selected, newest);
});

test('finding navigation selects/reveals only the detached target, rejects stale and protected requests, and survives rejected replacement text', () => {
  const source = init().model;
  let model = open(source);
  const review = model.alchemyReview.review;
  assert(review);
  model = update(
    model,
    Message.ObservedAlchemyInput({
      id: review.id,
      message: { type: 'SurfaceMeasured', size: { width: 900, height: 600 } },
    }),
  ).model;
  const navigator = workbenchAlchemyFindings(model);
  assert(navigator);
  const node = navigator.entries.find(
    (e) => e.finding.sourceId === 'example%2Fbank/Bank/stream/Ledger',
  );
  const edge = navigator.entries.find((e) => e.label === 'entry-type: MoneyDeposited → Ledger');
  assert(node?.request && edge?.request && edge.target);
  const revealed = update(
    model,
    Message.ClickedAlchemyFinding({ id: review.id, request: node.request }),
  ).model;
  expect(revealed.alchemyReview.review?.editor.selectedNodes).toEqual([
    'example%2Fbank/Bank/stream/Ledger',
  ]);
  expect(revealed.alchemyReview.notice).toContain('Revealed Ledger');
  preserved(source, revealed);
  expect(revealed.alchemyReview.review?.editor.graph).toBe(
    model.alchemyReview.review?.editor.graph,
  );
  expect(revealed.alchemyReview.review?.editor.past).toBe(model.alchemyReview.review?.editor.past);
  const related = update(
    revealed,
    Message.ClickedAlchemyFinding({ id: review.id, request: edge.request }),
  ).model;
  expect(related.alchemyReview.review?.editor.selectedEdges).toEqual([edge.target.id]);
  expect(related.alchemyReview.review?.editor.selectedNodes).toEqual([]);
  preserved(source, related);
  const invalid = open(related, '{}');
  const retry = update(
    invalid,
    Message.ClickedAlchemyFinding({ id: review.id, request: node.request }),
  ).model;
  expect(retry.alchemyReview.review?.editor.selectedNodes).toEqual([
    'example%2Fbank/Bank/stream/Ledger',
  ]);
  const replacement = open(retry, sample.replace('fixture-v1', 'fixture-v2'));
  expect(
    update(replacement, Message.ClickedAlchemyFinding({ id: review.id, request: node.request }))
      .model,
  ).toBe(replacement);
  const current = replacement.alchemyReview.review;
  assert(current);
  const forged = update(
    replacement,
    Message.ClickedAlchemyFinding({ id: current.id, request: node.request }),
  ).model;
  expect(forged.alchemyReview.review?.editor).toBe(current.editor);
  expect(forged.alchemyReview.notice).toContain('different review');
  const pending = update(
    retry,
    Message.ChoseAlchemyFiles({ files: [new File([sample], 'pending.json')] }),
  ).model;
  const blocked = update(
    pending,
    Message.ClickedAlchemyFinding({ id: review.id, request: node.request }),
  ).model;
  expect(blocked.alchemyReview.review?.editor).toBe(pending.alchemyReview.review?.editor);
  expect(blocked.alchemyReview.notice).toContain('read');
  expect(workbenchAlchemyFindings(pending)?.entries.every((e) => e.reason !== null)).toBe(true);
});

test('opt-in ELK preview layout preserves source/findings and working history; original geometry is reversible and finding requests remain valid', async () => {
  const source = init().model;
  let model = open(source);
  const review = model.alchemyReview.review;
  assert(review);
  model = update(
    model,
    Message.ObservedAlchemyInput({
      id: review.id,
      message: { type: 'SurfaceMeasured', size: { width: 1100, height: 700 } },
    }),
  ).model;
  const row = workbenchAlchemyFindings(model)?.entries.find((e) => e.label === 'Ledger (stream)');
  assert(row?.request);
  const started = update(model, Message.ClickedAlchemyLayout({ id: review.id }));
  assert(started.commands?.[0]);
  const message = await Effect.runPromise(started.commands[0].effect);
  expect(message._tag).toBe('SucceededAlchemyLayout');
  const arranged = update(started.model, message).model,
    next = arranged.alchemyReview.review;
  assert(next);
  expect(next.layout.displayed).toBe('elk');
  expect(next.layout.pending).toBeNull();
  expect(next.projection).toBe(review.projection);
  expect(next.editor.readOnly).toBe(true);
  expect(next.editor.past).toBe(review.editor.past);
  expect(next.editor.future).toBe(review.editor.future);
  expect(next.editor.routes).toHaveLength(8);
  expect(started.model.alchemyReview.review?.layout.pending?.edgeLabels).toHaveLength(8);
  for (const route of next.editor.routes) {
    expect(route.label?.size).toEqual({ width: 176, height: 36 });
    expect(Number.isFinite(route.label?.position.x)).toBe(true);
    expect(Number.isFinite(route.label?.position.y)).toBe(true);
  }
  expect(next.editor.graph.edges).toEqual(review.editor.graph.edges);
  expect(next.editor.graph.nodes.map((n) => n.position)).not.toEqual(
    review.editor.graph.nodes.map((n) => n.position),
  );
  expect(next.editor.graph.nodes.map(({ position, size, ...n }) => n)).toEqual(
    review.editor.graph.nodes.map(({ position, size, ...n }) => n),
  );
  preserved(source, arranged);
  const focused = update(
    arranged,
    Message.ClickedAlchemyFinding({ id: review.id, request: row.request }),
  ).model;
  expect(focused.alchemyReview.review?.editor.selectedNodes).toEqual([
    'example%2Fbank/Bank/stream/Ledger',
  ]);
  const restored = update(focused, Message.ClickedRestoreAlchemyLayout({ id: review.id })).model;
  expect(restored.alchemyReview.review?.layout.displayed).toBe('original');
  expect(restored.alchemyReview.review?.editor.graph).toEqual(review.editor.graph);
  expect(restored.alchemyReview.review?.editor.routes).toEqual([]);
  expect(restored.alchemyReview.review?.editor.selectedNodes).toEqual([
    'example%2Fbank/Bank/stream/Ledger',
  ]);
  preserved(source, restored);
});
test('cancel, replacement, navigation and malformed layout results retain the last valid preview and discard late results', async () => {
  let model = open();
  const review = model.alchemyReview.review;
  assert(review);
  model = update(
    model,
    Message.ObservedAlchemyInput({
      id: review.id,
      message: { type: 'SurfaceMeasured', size: { width: 900, height: 600 } },
    }),
  ).model;
  const started = update(model, Message.ClickedAlchemyLayout({ id: review.id }));
  assert(started.commands?.[0]);
  const completed = await Effect.runPromise(started.commands[0].effect);
  const cancelled = update(
    started.model,
    Message.ClickedCancelAlchemyLayout({ id: review.id }),
  ).model;
  expect(update(cancelled, completed).model).toBe(cancelled);
  const replaced = open(started.model, sample.replace('fixture-v1', 'fixture-v2'));
  expect(update(replaced, completed).model).toBe(replaced);
  const navigated = update(
    started.model,
    Message.ObservedAlchemyInput({
      id: review.id,
      message: { type: 'NodeSelected', id: 'example%2Fbank/Bank/stream/Ledger', additive: false },
    }),
  ).model;
  expect(navigated.alchemyReview.review?.layout.pending).toBeNull();
  expect(update(navigated, completed).model).toBe(navigated);
  const active = started.model.alchemyReview.review?.layout.pending;
  assert(active);
  const malformed = update(
    started.model,
    Message.SucceededAlchemyLayout({
      id: review.id,
      result: { requestId: active.requestId, revision: active.revision, positions: [], routes: [] },
    }),
  ).model;
  expect(malformed.alchemyReview.review?.editor).toBe(started.model.alchemyReview.review?.editor);
  expect(malformed.alchemyReview.notice).toContain('preserved');
  expect(malformed.alchemyReview.review?.layout.pending).toBeNull();
  const failed = update(
    started.model,
    Message.FailedAlchemyLayout({ id: review.id, requestId: active.requestId }),
  ).model;
  expect(failed.alchemyReview.review?.editor).toBe(started.model.alchemyReview.review?.editor);
  expect(failed.alchemyReview.review?.layout.pending).toBeNull();
  const blocked = update(open(), Message.ClickedAlchemyLayout({ id: review.id }));
  expect(blocked.commands).toBeUndefined();
});

test('measured badge bounds stay opt-in, arrange only after a full current batch, and reject renderer changes during layout', async () => {
  const source = init().model;
  let model = open(source);
  const review = model.alchemyReview.review;
  assert(review);
  const id = review.id;
  model = update(
    model,
    Message.ObservedAlchemyInput({
      id,
      message: { type: 'SurfaceMeasured', size: { width: 1100, height: 700 } },
    }),
  ).model;
  model = update(model, Message.SelectedAlchemyLabelMode({ id, mode: 'measured' })).model;
  expect(update(model, Message.ClickedAlchemyLayout({ id })).commands).toBeUndefined();
  model = update(model, Message.ClickedMeasureAlchemyLabels({ id })).model;
  const pending = model.alchemyReview.review?.layout.labels.measurement;
  assert(pending?.type === 'pending');
  const result = {
    type: 'measured' as const,
    requestId: pending.request.requestId,
    revision: pending.request.revision,
    renderKey: pending.request.renderKey,
    labels: review.editor.graph.edges.map((edge, index) => ({
      id: edge.id,
      size: { width: 110 + index * 15.25, height: 37.5 },
    })),
  };
  const before = model.alchemyReview.review?.editor;
  model = update(model, Message.ObservedAlchemyLabels({ id, result })).model;
  expect(model.alchemyReview.review?.layout.labels.measurement.type).toBe('ready');
  expect(model.alchemyReview.review?.editor).toBe(before);
  const started = update(model, Message.ClickedAlchemyLayout({ id }));
  assert(started.commands?.[0]);
  expect(started.model.alchemyReview.review?.layout.pending?.edgeLabels).toEqual(result.labels);
  const completed = await Effect.runPromise(started.commands[0].effect);
  expect(completed._tag).toBe('SucceededAlchemyLayout');
  const changed = update(
    started.model,
    Message.SelectedThemePreference({ themePreference: 'dark' }),
  ).model;
  const discarded = update(changed, completed).model;
  expect(discarded.alchemyReview.review?.editor).toBe(before);
  expect(discarded.alchemyReview.review?.layout.pending).toBeNull();
  expect(discarded.alchemyReview.notice).toContain('Renderer changed');
  const applied = update(started.model, completed).model;
  expect(applied.alchemyReview.review?.layout.displayed).toBe('elk');
  expect(
    applied.alchemyReview.review?.editor.routes.map((r) => ({ id: r.id, size: r.label?.size })),
  ).toEqual(result.labels);
  preserved(source, applied);
});
test('cancel, new badge content, replacement and repeated measurement runs reject late observations', () => {
  let model = open();
  const review = model.alchemyReview.review;
  assert(review);
  const id = review.id;
  model = update(
    model,
    Message.ObservedAlchemyInput({
      id,
      message: { type: 'SurfaceMeasured', size: { width: 900, height: 600 } },
    }),
  ).model;
  model = update(model, Message.SelectedAlchemyLabelMode({ id, mode: 'measured' })).model;
  model = update(model, Message.ClickedMeasureAlchemyLabels({ id })).model;
  const pending = model.alchemyReview.review?.layout.labels.measurement;
  assert(pending?.type === 'pending');
  const result = {
    type: 'failed' as const,
    requestId: pending.request.requestId,
    revision: pending.request.revision,
    renderKey: pending.request.renderKey,
    reason: 'Old failure',
  };
  const cancelled = update(model, Message.ClickedCancelAlchemyLabels({ id })).model;
  expect(update(cancelled, Message.ObservedAlchemyLabels({ id, result })).model).toBe(cancelled);
  const detail = update(
    model,
    Message.SelectedAlchemyLabelDetail({ id, detail: 'expanded' }),
  ).model;
  expect(update(detail, Message.ObservedAlchemyLabels({ id, result })).model).toBe(detail);
  const replaced = update(model, Message.ClickedAlchemyExample()).model;
  expect(update(replaced, Message.ObservedAlchemyLabels({ id, result })).model).toBe(replaced);
  const restarted = update(model, Message.ClickedMeasureAlchemyLabels({ id })).model;
  expect(update(restarted, Message.ObservedAlchemyLabels({ id, result })).model).toBe(restarted);
  expect(restarted.alchemyReview.review?.layout.labels.run).toBe(2);
});

test('expanded group headings share declared layout bounds, preserve source/history and cancel old layout when changed', async () => {
  const source = init().model;
  let model = open(source);
  const review = model.alchemyReview.review;
  assert(review);
  const id = review.id;
  model = update(
    model,
    Message.ObservedAlchemyInput({
      id,
      message: { type: 'SurfaceMeasured', size: { width: 1100, height: 700 } },
    }),
  ).model;
  const previous = model.alchemyReview.review?.editor;
  assert(previous);
  model = update(model, Message.SelectedAlchemyGroupHeader({ id, header: 'expanded' })).model;
  expect(model.alchemyReview.review?.editor).toBe(previous);
  const started = update(model, Message.ClickedAlchemyLayout({ id }));
  assert(started.commands?.[0]);
  const pending = started.model.alchemyReview.review?.layout.pending;
  assert(pending);
  expect(pending.groupHeaders).toHaveLength(1);
  const header = pending.groupHeaders?.[0];
  assert(header);
  const sourceGroup = review.projection.graph.nodes.find((n) => n.kind === 'group');
  assert(sourceGroup);
  expect(header).toEqual({
    id: sourceGroup.id,
    size: { width: 640, height: 112 },
    padding: { top: 24, right: 24, bottom: 24, left: 24 },
    gap: 24,
  });
  const completed = await Effect.runPromise(started.commands[0].effect);
  expect(completed._tag).toBe('SucceededAlchemyLayout');
  const applied = update(started.model, completed).model;
  const editor = applied.alchemyReview.review?.editor;
  assert(editor);
  const parent = editor.graph.nodes.find((n) => n.id === header.id);
  assert(parent);
  for (const child of editor.graph.nodes.filter((n) => n.parentId === parent.id))
    expect(child.position.y - parent.position.y).toBeGreaterThanOrEqual(160);
  expect(editor.past).toBe(previous.past);
  expect(editor.future).toBe(previous.future);
  expect(applied.alchemyReview.review?.projection).toBe(review.projection);
  preserved(source, applied);
  const changed = update(
    started.model,
    Message.SelectedAlchemyGroupHeader({ id, header: 'default' }),
  ).model;
  expect(changed.alchemyReview.review?.layout.pending).toBeNull();
  expect(update(changed, completed).model).toBe(changed);
  const restored = update(applied, Message.ClickedRestoreAlchemyLayout({ id })).model;
  expect(restored.alchemyReview.review?.editor.graph).toEqual(previous.graph);
  preserved(source, restored);
});

test('intrinsic group headings arrange from measured sizes only, reject content/theme changes and preserve working history', async () => {
  const source = init().model;
  let model = open(source);
  const review = model.alchemyReview.review;
  assert(review);
  const id = review.id;
  model = update(
    model,
    Message.ObservedAlchemyInput({
      id,
      message: { type: 'SurfaceMeasured', size: { width: 1100, height: 700 } },
    }),
  ).model;
  model = update(model, Message.SelectedAlchemyGroupHeader({ id, header: 'measured' })).model;
  expect(update(model, Message.ClickedAlchemyLayout({ id })).commands).toBeUndefined();
  model = update(model, Message.ClickedMeasureAlchemyHeadings({ id })).model;
  const pending = model.alchemyReview.review?.layout.heading.measurement;
  assert(pending?.type === 'pending');
  const spec = pending.request.headers[0];
  assert(spec);
  const result = {
    type: 'measured' as const,
    requestId: pending.request.requestId,
    revision: pending.request.revision,
    renderKey: pending.request.renderKey,
    headers: [{ id: spec.id, size: { width: 413.75, height: 94.5 } }],
  };
  const previous = model.alchemyReview.review?.editor;
  assert(previous);
  const cancelled = update(model, Message.ClickedCancelAlchemyHeadings({ id })).model;
  expect(update(cancelled, Message.ObservedAlchemyHeadings({ id, result })).model).toBe(cancelled);
  const changedDetail = update(
    model,
    Message.SelectedAlchemyHeadingDetail({ id, detail: 'provenance' }),
  ).model;
  expect(update(changedDetail, Message.ObservedAlchemyHeadings({ id, result })).model).toBe(
    changedDetail,
  );
  model = update(model, Message.ObservedAlchemyHeadings({ id, result })).model;
  expect(model.alchemyReview.review?.editor).toBe(previous);
  const started = update(model, Message.ClickedAlchemyLayout({ id }));
  assert(started.commands?.[0]);
  expect(started.model.alchemyReview.review?.layout.pending?.groupHeaders).toEqual([
    { ...spec, size: { width: 413.75, height: 94.5 } },
  ]);
  const completed = await Effect.runPromise(started.commands[0].effect);
  expect(completed._tag).toBe('SucceededAlchemyLayout');
  const changed = update(
    started.model,
    Message.SelectedThemePreference({ themePreference: 'dark' }),
  ).model;
  const discarded = update(changed, completed).model;
  expect(discarded.alchemyReview.review?.editor).toBe(previous);
  expect(discarded.alchemyReview.review?.layout.pending).toBeNull();
  const applied = update(started.model, completed).model;
  const parent = applied.alchemyReview.review?.editor.graph.nodes.find(
    (node) => node.id === spec.id,
  );
  assert(parent);
  for (const child of applied.alchemyReview.review?.editor.graph.nodes.filter(
    (node) => node.parentId === spec.id,
  ) ?? [])
    expect(child.position.y - parent.position.y).toBeGreaterThanOrEqual(142.5);
  expect(applied.alchemyReview.review?.editor.past).toBe(previous.past);
  preserved(source, applied);
});
