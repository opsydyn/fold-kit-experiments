import { expect, test } from 'bun:test';

import {
  createSvgReview,
  resolveSvgReview,
  updateSvgReview,
  createEditor,
  createArchitecturePattern,
  type ZlozSvgReviewContext,
} from '../src/index';
const editor = createEditor(createArchitecturePattern('c4-context'));
const context: ZlozSvgReviewContext = {
  scope: 'model/session',
  sourceRevision: 0,
  snapshot: editor,
  surface: { width: 800, height: 600 },
  title: 'Review model',
  theme: { colorScheme: 'light' },
  renderers: { nodes: 'built-in', edges: 'built-in' },
};
test('review settings and download are package-owned, read-only and scoped to the reviewed bytes', () => {
  const state = createSvgReview(context.scope);
  const review = resolveSvgReview(state, context);
  expect(review.result?.type).toBe('written');
  expect(review.downloadReason).toBeNull();
  const requested = updateSvgReview(state, context, {
    ...review.identity,
    type: 'SvgDownloadRequested',
  });
  expect(requested.payload?.svg).toContain('<svg');
  expect(requested.state.download.type).toBe('pending');
  expect(editor.past).toEqual([]);
  const duplicate = updateSvgReview(requested.state, context, {
    ...review.identity,
    type: 'SvgDownloadRequested',
  });
  expect(duplicate.payload).toBeNull();
  const stale = updateSvgReview(
    state,
    { ...context, title: 'Changed export' },
    { ...review.identity, type: 'SvgDownloadRequested' },
  );
  expect(stale.payload).toBeNull();
});
test('loss acceptance is exact-artifact consent and never grants unsupported or policy-controlled downloads', () => {
  const node = editor.graph.nodes[0];
  if (!node) throw new Error('Missing source');
  const ctx = {
    ...context,
    renderers: {
      ...context.renderers,
      overrides: [
        {
          target: { kind: 'node', id: node.id },
          renderer: { type: 'omit', reason: 'Interactive card omitted' },
        },
      ],
    },
  } as const;
  const state = createSvgReview(ctx.scope),
    review = resolveSvgReview(state, ctx);
  expect(review.hasLosses).toBe(true);
  expect(review.downloadReason).toContain('Accept');
  expect(
    updateSvgReview(state, ctx, { ...review.identity, type: 'SvgDownloadRequested' }).payload,
  ).toBeNull();
  const accepted = updateSvgReview(state, ctx, {
    ...review.identity,
    type: 'SvgLossAcceptanceChanged',
    accepted: true,
  }).state;
  expect(resolveSvgReview(accepted, ctx).accepted).toBe(true);
  expect(
    updateSvgReview(accepted, ctx, { ...review.identity, type: 'SvgDownloadRequested' }).payload,
  ).not.toBeNull();
  expect(
    resolveSvgReview(accepted, { ...ctx, canDownload: () => 'Downloads protected' }).accepted,
  ).toBe(true);
  const changed = { ...ctx, title: 'Another title' };
  expect(resolveSvgReview(accepted, changed).accepted).toBe(false);
  expect(
    updateSvgReview(
      accepted,
      { ...ctx, canDownload: () => 'Downloads protected' },
      { ...review.identity, type: 'SvgDownloadRequested' },
    ).payload,
  ).toBeNull();
  const unsupported = { ...ctx, renderers: { nodes: 'unknown', edges: 'unknown' } } as const;
  expect(resolveSvgReview(accepted, unsupported).downloadReason).not.toBeNull();
  expect(
    updateSvgReview(accepted, unsupported, { ...review.identity, type: 'SvgDownloadRequested' })
      .payload,
  ).toBeNull();
});

test('source revisions, adapter bytes and settings invalidate acceptance; whole-model camera motion does not', () => {
  const node = editor.graph.nodes[0];
  if (!node) throw new Error('Expected fixture');
  const ctx = {
    ...context,
    renderers: {
      ...context.renderers,
      overrides: [
        {
          target: { kind: 'node', id: node.id },
          renderer: { type: 'omit', reason: 'Card omitted' },
        },
      ],
    },
  } as const;
  const initial = createSvgReview(ctx.scope),
    review = resolveSvgReview(initial, ctx);
  const accepted = updateSvgReview(initial, ctx, {
    ...review.identity,
    type: 'SvgLossAcceptanceChanged',
    accepted: true,
  }).state;
  expect(resolveSvgReview(accepted, { ...ctx, sourceRevision: 1 }).accepted).toBe(false);
  expect(
    resolveSvgReview(accepted, {
      ...ctx,
      snapshot: { ...editor, viewport: { x: 100, y: 200, zoom: 2 } },
    }).accepted,
  ).toBe(true);
  const changed = updateSvgReview(accepted, ctx, {
    ...review.identity,
    type: 'SvgSettingsChanged',
    preferences: { ...accepted.preferences, themeId: 'dark' },
  }).state;
  expect(changed.lossKey).toBeNull();
  expect(changed.generation).toBe(1);
  expect(
    updateSvgReview(changed, ctx, { ...review.identity, type: 'SvgDownloadRequested' }).payload,
  ).toBeNull();
  const custom = {
    ...context,
    renderers: {
      nodes: 'built-in',
      edges: 'built-in',
      overrides: [
        {
          target: { kind: 'node', id: node.id },
          renderer: {
            type: 'svg',
            id: 'card',
            version: '1',
            bounds: { x: 0, y: 0, width: 1000, height: 1000 },
            fidelity: 'approximate',
            reason: 'Static replacement',
          },
        },
      ],
    },
    writing: {
      adapters: [
        {
          id: 'card',
          version: '1',
          render: () => [{ type: 'text' as const, position: { x: 20, y: 30 }, text: 'first' }],
        },
      ],
    },
  } as const;
  const before = resolveSvgReview(initial, custom);
  const consent = updateSvgReview(initial, custom, {
    ...before.identity,
    type: 'SvgLossAcceptanceChanged',
    accepted: true,
  }).state;
  const updated = {
    ...custom,
    writing: {
      adapters: [
        {
          id: 'card',
          version: '1',
          render: () => [{ type: 'text', position: { x: 20, y: 30 }, text: 'changed' } as const],
        },
      ],
    },
  };
  expect(resolveSvgReview(consent, updated).accepted).toBe(false);
});
test('viewport measurement, configured bounds and missing catalog choices are explicit', () => {
  const state = createSvgReview(context.scope, { regionId: 'viewport' });
  expect(resolveSvgReview(state, { ...context, surface: null }).downloadReason).toContain(
    'Measure',
  );
  expect(
    resolveSvgReview(state, { ...context, surface: { width: 0, height: 0 } }).result,
  ).toBeNull();
  const bounds = {
    ...context,
    regions: [
      {
        id: 'crop',
        label: 'Configured crop',
        value: { type: 'bounds', bounds: { x: -10, y: -20, width: 120, height: 80 } },
      },
    ],
  } as const;
  const crop = resolveSvgReview(createSvgReview(context.scope, { regionId: 'crop' }), bounds);
  expect(crop.result?.plan.viewBox).toEqual({ x: -10, y: -20, width: 120, height: 80 });
  expect(
    resolveSvgReview(createSvgReview(context.scope, { regionId: 'absent' }), context)
      .downloadReason,
  ).toContain('no longer');
  expect(() =>
    resolveSvgReview(state, {
      ...context,
      regions: [
        { id: 'a', label: 'A', value: { type: 'viewport' } },
        { id: 'a', label: 'Duplicate', value: { type: 'viewport' } },
      ],
    }),
  ).toThrow();
});
test('only the matching pending job may settle; old completions cannot overwrite current review feedback', () => {
  const state = createSvgReview(context.scope),
    review = resolveSvgReview(state, context);
  const one = updateSvgReview(state, context, { ...review.identity, type: 'SvgDownloadRequested' });
  if (!one.payload) throw new Error('Expected download');
  const twoContext = { ...context, title: 'New artifact' };
  const twoReview = resolveSvgReview(one.state, twoContext);
  const two = updateSvgReview(one.state, twoContext, {
    ...twoReview.identity,
    type: 'SvgDownloadRequested',
  });
  if (!two.payload) throw new Error('Expected new download');
  const old = updateSvgReview(two.state, twoContext, {
    ...one.payload,
    type: 'SvgDownloadSettled',
    outcome: 'succeeded',
  });
  expect(old.state).toBe(two.state);
  const failed = updateSvgReview(two.state, twoContext, {
    ...two.payload,
    type: 'SvgDownloadSettled',
    outcome: 'failed',
  });
  expect(failed.state.download.type).toBe('idle');
  expect(failed.notice).toContain('failed');
  const changed = updateSvgReview(one.state, twoContext, {
    ...one.payload,
    type: 'SvgDownloadSettled',
    outcome: 'succeeded',
  });
  expect(changed.notice).toBe('');
  expect(changed.state.download.type).toBe('idle');
});
