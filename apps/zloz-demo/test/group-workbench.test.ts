import assert from 'node:assert/strict';

import { createElkGroupLayoutV3 } from '@opsydyn/foldkit-zloz-elk';
import { expect, test } from 'vitest';

import { Message, Model, update, type ReadyState } from '../src/group-workbench/main';
import { groupMermaidControls } from '../src/group-workbench/mermaid';
import { groupPngControls } from '../src/group-workbench/png';
import { groupSvgControls } from '../src/group-workbench/svg';
function ready(model: Model): ReadyState {
  if (model._tag !== 'Ready') throw new Error('Expected ready fixture.');
  // SAFETY: Test models are created only by the application's typed initializer/transitions.
  return model.state as ReadyState;
}
const initial = () =>
  update(Model.Preparing(), Message.SucceededIdentity({ id: 'app-v3-test' })).model;
const input = (
  model: Model,
  event: Parameters<typeof Message.ObservedWorkbenchInput>[0]['event'],
) => update(model, Message.ObservedWorkbenchInput({ event })).model;
test('workbench saves live camera with a checkpoint, restores the full document and retains independent read-only review', () => {
  let model = initial();
  model = input(model, { type: 'ViewportNudged', delta: { x: 30, y: 20 } });
  model = update(model, Message.ClickedCheckpoint()).model;
  const first = ready(model).catalogue.editions[0];
  expect(first?.snapshot.viewport).toEqual({ x: 50, y: 40, zoom: 1 });
  model = input(model, { type: 'NodeSelected', id: 'orders', additive: false });
  model = input(model, { type: 'SelectionNudged', delta: { x: 20, y: 0 } });
  const working = ready(model).workbench;
  assert(first);
  model = update(model, Message.ClickedReview({ id: first?.id ?? '' })).model;
  expect(ready(model).review?.workbench.editor.readOnly).toBe(true);
  model = input(model, { type: 'DeletePressed' });
  expect(ready(model).workbench).toBe(working);
  model = update(model, Message.ClickedRestore()).model;
  expect(ready(model).review).toBeNull();
  expect(ready(model).workbench.editor.document).toEqual(first.snapshot);
  model = input(model, { type: 'UndoPressed' });
  expect(ready(model).workbench.editor.document).toEqual(working.editor.document);
});
test('late model-open completions cannot overwrite newer requests or intervening graph edits', () => {
  let model = initial();
  const document = { ...ready(model).catalogue, snapshot: ready(model).workbench.editor.document };
  model = update(model, Message.ClickedOpen()).model;
  model = update(model, Message.ClickedOpen()).model;
  expect(update(model, Message.SucceededOpen({ document, id: 'old', token: 1 })).model).toBe(model);
  model = input(model, { type: 'NodeSelected', id: 'orders', additive: false });
  model = input(model, { type: 'SelectionNudged', delta: { x: 20, y: 0 } });
  const changed = ready(model).workbench.editor;
  model = update(model, Message.SucceededOpen({ document, id: 'late', token: 2 })).model;
  expect(ready(model).workbench.editor).toBe(changed);
  expect(ready(model).notice).toContain('Current edits were retained');
  model = update(model, Message.ClickedOpen()).model;
  model = update(model, Message.SucceededOpen({ document, id: 'new-incarnation', token: 3 })).model;
  expect(ready(model).workbench.editor.sessionId).toBe('new-incarnation');
  expect(ready(model).workbench.editor.history.past).toEqual([]);
});

test('layout completion uses the active request and current live policy, retaining all state on failures', async () => {
  let model = initial();
  const original = ready(model).workbench.editor.document;
  model = update(model, Message.ClickedLayout({ direction: 'RIGHT' })).model;
  const first = ready(model).pendingLayout!;
  const firstResult = await createElkGroupLayoutV3()(first);
  model = update(model, Message.ClickedLayout({ direction: 'DOWN' })).model;
  expect(update(model, Message.SucceededLayout({ result: firstResult })).model).toBe(model);
  const active = ready(model).pendingLayout!;
  const result = await createElkGroupLayoutV3({ direction: 'DOWN' })(active);
  model = update(model, Message.ClickedProtection()).model;
  model = update(model, Message.SucceededLayout({ result })).model;
  expect(ready(model).workbench.editor.document).toEqual(original);
  expect(ready(model).notice).toContain('pinned');
  expect(ready(model).pendingLayout).toBeNull();
  model = update(model, Message.ClickedProtection()).model;
  model = update(model, Message.ClickedLayout({ direction: 'RIGHT' })).model;
  const request = ready(model).pendingLayout!;
  model = update(
    model,
    Message.SucceededLayout({ result: await createElkGroupLayoutV3()(request) }),
  ).model;
  expect(ready(model).workbench.editor.history.past).toHaveLength(1);
  model = input(model, { type: 'UndoPressed' });
  expect(ready(model).workbench.editor.document).toEqual(original);
  model = update(model, Message.ClickedLayout({ direction: 'RIGHT' })).model;
  const failed = ready(model).pendingLayout!;
  model = update(
    model,
    Message.FailedLayout({ requestId: failed.requestId, reason: 'Worker unavailable.' }),
  ).model;
  expect(ready(model).notice).toContain('Worker unavailable');
  expect(ready(model).workbench.editor.document).toEqual(original);
});
test('cancel, in-flight edits, session replacement and read-only review cannot publish an obsolete layout', async () => {
  let model = update(initial(), Message.ClickedLayout({ direction: 'RIGHT' })).model;
  const result = await createElkGroupLayoutV3()(ready(model).pendingLayout!);
  model = update(model, Message.ClickedCancelLayout()).model;
  expect(update(model, Message.SucceededLayout({ result })).model).toBe(model);
  model = update(model, Message.ClickedLayout({ direction: 'RIGHT' })).model;
  const second = await createElkGroupLayoutV3()(ready(model).pendingLayout!);
  model = input(model, { type: 'NodeSelected', id: 'orders', additive: false });
  model = input(model, { type: 'SelectionNudged', delta: { x: 20, y: 0 } });
  const edited = ready(model).workbench.editor;
  model = update(model, Message.SucceededLayout({ result: second })).model;
  expect(ready(model).workbench.editor).toBe(edited);
  expect(ready(model).notice).toContain('changed');
  model = update(model, Message.ClickedCheckpoint()).model;
  model = update(model, Message.ClickedLayout({ direction: 'RIGHT' })).model;
  const late = await createElkGroupLayoutV3()(ready(model).pendingLayout!);
  model = update(
    model,
    Message.ClickedReview({ id: ready(model).catalogue.editions[0]!.id }),
  ).model;
  expect(ready(model).pendingLayout).toBeNull();
  expect(update(model, Message.SucceededLayout({ result: late })).model).toBe(model);
  expect(update(model, Message.ClickedLayout({ direction: 'DOWN' })).model).toBe(model);
  model = update(model, Message.ClickedWorking()).model;
  model = update(model, Message.ClickedLayout({ direction: 'RIGHT' })).model;
  const old = await createElkGroupLayoutV3()(ready(model).pendingLayout!);
  const document = { ...ready(model).catalogue, snapshot: ready(model).workbench.editor.document };
  model = update(model, Message.ClickedOpen()).model;
  model = update(
    model,
    Message.SucceededOpen({ document, id: 'new-layout-session', token: 1 }),
  ).model;
  expect(update(model, Message.SucceededLayout({ result: old })).model).toBe(model);
});
test('native SVG review requires current loss consent and policy while preserving editor/history', () => {
  let model = update(initial(), Message.ClickedSvgCustom()).model;
  const state = ready(model),
    editor = state.workbench.editor;
  const controls = groupSvgControls(state);
  expect(controls.hasLosses).toBe(true);
  const blocked = update(
    model,
    Message.ObservedSvgReview({ request: { ...controls.identity, type: 'SvgDownloadRequested' } }),
  );
  expect(blocked.commands).toBeUndefined();
  model = update(
    model,
    Message.ObservedSvgReview({
      request: { ...controls.identity, type: 'SvgLossAcceptanceChanged', accepted: true },
    }),
  ).model;
  model = update(model, Message.ClickedSvgProtection()).model;
  const protectedResult = update(
    model,
    Message.ObservedSvgReview({ request: { ...controls.identity, type: 'SvgDownloadRequested' } }),
  );
  expect(protectedResult.commands).toBeUndefined();
  expect(ready(protectedResult.model).notice).toContain('protected');
  model = update(protectedResult.model, Message.ClickedSvgProtection()).model;
  const download = update(
    model,
    Message.ObservedSvgReview({ request: { ...controls.identity, type: 'SvgDownloadRequested' } }),
  );
  expect(download.commands).toHaveLength(1);
  expect(ready(download.model).workbench.editor).toBe(editor);
  expect(editor.history.past).toEqual([]);
  const changed = update(model, Message.ClickedTheme()).model;
  expect(groupSvgControls(ready(changed)).accepted).toBe(false);
  expect(
    update(
      changed,
      Message.ObservedSvgReview({
        request: { ...controls.identity, type: 'SvgDownloadRequested' },
      }),
    ).commands,
  ).toBeUndefined();
});
test('native SVG retained-route opt-in waits for layout, keeps source meaning and allows independent read-only edition export', async () => {
  let model = update(initial(), Message.ClickedSvgRetained()).model;
  expect(groupSvgControls(ready(model)).downloadReason).toContain('Arrange with ELK');
  model = update(model, Message.ClickedLayout({ direction: 'RIGHT' })).model;
  expect(groupSvgControls(ready(model)).downloadReason).toContain('Wait for or cancel');
  const result = await createElkGroupLayoutV3()(ready(model).pendingLayout!);
  model = update(model, Message.SucceededLayout({ result })).model;
  const controls = groupSvgControls(ready(model));
  expect(controls.downloadReason).toBeNull();
  expect(controls.result?.plan.layout?.routes).toHaveLength(1);
  expect(controls.result?.plan.document.capabilities.groupPorts).toBe(true);
  model = update(model, Message.ClickedSvgRetained()).model;
  model = update(model, Message.ClickedCheckpoint()).model;
  const working = ready(model).workbench.editor;
  model = update(
    model,
    Message.ClickedReview({ id: ready(model).catalogue.editions[0]!.id }),
  ).model;
  const review = groupSvgControls(ready(model));
  expect(review.result?.type).toBe('written');
  expect(review.identity.scope).not.toBe(controls.identity.scope);
  const downloaded = update(
    model,
    Message.ObservedSvgReview({ request: { ...review.identity, type: 'SvgDownloadRequested' } }),
  );
  expect(downloaded.commands).toHaveLength(1);
  expect(ready(downloaded.model).workbench.editor).toBe(working);
  model = update(downloaded.model, Message.ClickedWorking()).model;
  const late = update(
    model,
    Message.ObservedSvgReview({
      request: { ...review.identity, type: 'SvgDownloadSettled', run: 1, outcome: 'succeeded' },
    }),
  );
  expect(late.model).toBe(model);
});
test('native PNG handoff requires raster consent, supports cancellation/retry and preserves working Undo', () => {
  let model = initial();
  const editor = ready(model).workbench.editor,
    view = groupPngControls(ready(model));
  expect(
    update(
      model,
      Message.ObservedPngReview({ request: { ...view.identity, type: 'PngRenderRequested' } }),
    ).commands,
  ).toBeUndefined();
  model = update(
    model,
    Message.ObservedPngReview({
      request: { ...view.identity, type: 'PngLossAcceptanceChanged', accepted: true },
    }),
  ).model;
  const started = update(
    model,
    Message.ObservedPngReview({ request: { ...view.identity, type: 'PngRenderRequested' } }),
  );
  expect(started.commands).toHaveLength(1);
  model = started.model;
  const run = ready(model).pngReview.run;
  const staleCancellation = update(
    model,
    Message.ObservedPngReview({
      request: { ...view.identity, key: 'stale', type: 'PngRenderCancelled' },
    }),
  );
  expect(staleCancellation.commands).toBeUndefined();
  expect(ready(staleCancellation.model).pngReview.rendering.type).toBe('pending');
  const cancelled = update(
    model,
    Message.ObservedPngReview({ request: { ...view.identity, type: 'PngRenderCancelled' } }),
  );
  expect(cancelled.commands).toHaveLength(1);
  model = cancelled.model;
  expect(ready(model).pngReview.rendering.type).toBe('idle');
  const old = update(
    model,
    Message.ObservedPngReview({
      request: {
        ...view.identity,
        type: 'PngRenderSettled',
        run,
        result: { type: 'failed', code: 'timeout', reason: 'Late failure' },
      },
    }),
  );
  expect(ready(old.model).pngReview).toBe(ready(model).pngReview);
  const retry = update(
    model,
    Message.ObservedPngReview({ request: { ...view.identity, type: 'PngRenderRequested' } }),
  );
  expect(retry.commands).toHaveLength(1);
  expect(ready(retry.model).pngReview.run).toBe(run + 1);
  expect(ready(retry.model).workbench.editor).toBe(editor);
  expect(editor.history.past).toEqual([]);
});
test('native PNG protection, layout readiness and review scopes are current at action/settlement', async () => {
  let model = update(initial(), Message.ClickedPngRetained()).model;
  expect(groupPngControls(ready(model)).renderReason).toContain('Arrange with ELK');
  model = update(model, Message.ClickedLayout({ direction: 'RIGHT' })).model;
  const layout = await createElkGroupLayoutV3()(ready(model).pendingLayout!);
  model = update(model, Message.SucceededLayout({ result: layout })).model;
  const controls = groupPngControls(ready(model));
  expect(controls.svg.result?.plan.document.capabilities.groupPorts).toBe(true);
  expect(controls.svg.result?.plan.layout?.routes).toHaveLength(1);
  model = update(
    model,
    Message.ObservedPngReview({
      request: { ...controls.identity, type: 'PngLossAcceptanceChanged', accepted: true },
    }),
  ).model;
  model = update(model, Message.ClickedPngProtection()).model;
  const protectedResult = update(
    model,
    Message.ObservedPngReview({ request: { ...controls.identity, type: 'PngRenderRequested' } }),
  );
  expect(protectedResult.commands).toBeUndefined();
  expect(ready(protectedResult.model).notice).toContain('protected');
  model = update(model, Message.ClickedPngProtection()).model;
  model = update(model, Message.ClickedPngRetained()).model;
  model = update(model, Message.ClickedCheckpoint()).model;
  model = update(
    model,
    Message.ClickedReview({ id: ready(model).catalogue.editions[0]!.id }),
  ).model;
  const readonly = groupPngControls(ready(model));
  expect(readonly.plan?.type).toBe('ready');
  expect(readonly.identity.scope).not.toBe(controls.identity.scope);
  const old = update(
    model,
    Message.ObservedPngReview({
      request: {
        ...controls.identity,
        type: 'PngRenderSettled',
        run: 1,
        result: { type: 'failed', code: 'aborted', reason: 'Old source' },
      },
    }),
  );
  expect(old.model).toBe(model);
  const oldDownload = update(
    model,
    Message.SettledPngDownload({
      scope: controls.identity.scope,
      key: controls.identity.key,
      succeeded: true,
    }),
  );
  expect(oldDownload.model).toBe(model);
});
test('native clipboard demo keeps editor publication in package controls with current protection, camera and one Undo', () => {
  let model = input(initial(), { type: 'NodeSelected', id: 'orders', additive: false });
  const original = ready(model).workbench.editor;
  model = input(model, { type: 'CopyPressed' });
  const clipboard = ready(model).workbench.clipboard;
  expect(ready(model).workbench.editor).toBe(original);
  expect(ready(model).workbench.clipboardFindings[0]?.code).toBe('boundary-edge-omitted');
  model = update(model, Message.ClickedProtection()).model;
  model = input(model, { type: 'PastePressed' });
  expect(ready(model).workbench.editor).toBe(original);
  expect(ready(model).workbench.status).toContain('published interface is protected');
  model = update(model, Message.ClickedProtection()).model;
  model = input(model, { type: 'PastePressed' });
  expect(ready(model).workbench.editor.document.graph.nodes).toHaveLength(5);
  expect(ready(model).workbench.editor.history.past).toHaveLength(1);
  expect(ready(model).workbench.editor.document.graph.nodes[3]?.position.y).toBe(480);
  model = input(model, { type: 'UndoPressed' });
  expect(ready(model).workbench.editor.document).toEqual(original.document);
  expect(ready(model).workbench.clipboard).toBe(clipboard);
});

test('native Mermaid review hands exact consented bundles to Commands and rejects current protection, stale source and foreign edition scope', () => {
  let model = initial();
  const editor = ready(model).workbench.editor;
  let controls = groupMermaidControls(ready(model));
  const accepted = update(
    model,
    Message.ObservedMermaidReview({
      request: { ...controls.identity, type: 'MermaidLossAcceptanceChanged', accepted: true },
    }),
  );
  model = accepted.model;
  expect(ready(model).workbench.editor).toBe(editor);
  model = update(model, Message.ClickedMermaidProtection()).model;
  const denied = update(
    model,
    Message.ObservedMermaidReview({
      request: { ...controls.identity, type: 'MermaidDownloadRequested' },
    }),
  );
  expect(denied.commands).toBeUndefined();
  expect(ready(denied.model).notice).toContain('protected');
  model = update(model, Message.ClickedMermaidProtection()).model;
  const download = update(
    model,
    Message.ObservedMermaidReview({
      request: { ...controls.identity, type: 'MermaidDownloadRequested' },
    }),
  );
  expect(download.commands).toHaveLength(1);
  expect(download.commands?.[0]?.name).toBe('DownloadGroupMermaid');
  expect(ready(download.model).workbench.editor).toBe(editor);
  model = input(model, { type: 'NodeSelected', id: 'orders', additive: false });
  model = input(model, { type: 'SelectionNudged', delta: { x: 20, y: 0 } });
  expect(
    update(
      model,
      Message.ObservedMermaidReview({
        request: { ...controls.identity, type: 'MermaidDownloadRequested' },
      }),
    ).commands,
  ).toBeUndefined();
  controls = groupMermaidControls(ready(model));
  expect(controls.accepted).toBe(false);
  model = update(model, Message.ClickedCheckpoint()).model;
  const edition = ready(model).catalogue.editions[0]!;
  model = update(model, Message.ClickedReview({ id: edition.id })).model;
  const reviewControls = groupMermaidControls(ready(model));
  expect(reviewControls.identity.scope).not.toBe(controls.identity.scope);
  expect(reviewControls.accepted).toBe(false);
  expect(
    update(
      model,
      Message.ObservedMermaidReview({
        request: {
          ...controls.identity,
          type: 'MermaidDownloadSettled',
          run: 1,
          outcome: 'succeeded',
        },
      }),
    ).model,
  ).toBe(model);
});
