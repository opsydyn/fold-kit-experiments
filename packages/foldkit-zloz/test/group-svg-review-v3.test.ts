import { expect, test } from 'bun:test';

import {
  captureGroupDocumentV3,
  createSvgReview,
  resolveGroupSvgReviewV3,
  updateGroupSvgReviewV3,
  type ZlozGroupSvgReviewContextV3,
  type ZlozSvgPrimitive,
} from '../src/index';
import wire from './fixtures/group-document-v3-ported.json';
const document = captureGroupDocumentV3(wire);
const context: ZlozGroupSvgReviewContextV3 = {
  scope: 'native/svg/session',
  sourceRevision: 0,
  document,
  title: 'Native review',
  theme: { colorScheme: 'light' },
  renderers: {
    nodes: 'built-in',
    edges: 'built-in',
    overrides: [
      {
        target: { kind: 'node', id: 'g' },
        renderer: { type: 'fallback', reason: 'Interactive shell becomes static group artwork.' },
      },
    ],
  },
};
test('native review binds loss consent to full document and exact produced bytes without changing source', () => {
  const state = createSvgReview(context.scope),
    review = resolveGroupSvgReviewV3(state, context);
  expect(review.result?.plan.document).toEqual(document);
  expect(review.hasLosses).toBe(true);
  expect(
    updateGroupSvgReviewV3(state, context, { ...review.identity, type: 'SvgDownloadRequested' })
      .payload,
  ).toBeNull();
  const accepted = updateGroupSvgReviewV3(state, context, {
    ...review.identity,
    type: 'SvgLossAcceptanceChanged',
    accepted: true,
  }).state;
  const download = updateGroupSvgReviewV3(accepted, context, {
    ...review.identity,
    type: 'SvgDownloadRequested',
  });
  expect(download.payload?.svg).toContain('data-zloz-document-version="3"');
  expect(document).toEqual(captureGroupDocumentV3(wire));
  const changed = {
    ...context,
    document: captureGroupDocumentV3({ ...document, connectionMode: 'loose' }),
  };
  expect(resolveGroupSvgReviewV3(accepted, changed).accepted).toBe(false);
  expect(
    updateGroupSvgReviewV3(accepted, changed, { ...review.identity, type: 'SvgDownloadRequested' })
      .payload,
  ).toBeNull();
});
test('native review rechecks live policy and refuses unsupported renderers or stale session clicks', () => {
  const state = createSvgReview(context.scope),
    review = resolveGroupSvgReviewV3(state, context),
    accepted = updateGroupSvgReviewV3(state, context, {
      ...review.identity,
      type: 'SvgLossAcceptanceChanged',
      accepted: true,
    }).state;
  const protectedContext = { ...context, canDownload: () => 'Export protected now.' };
  expect(resolveGroupSvgReviewV3(accepted, protectedContext).downloadReason).toBe(
    'Export protected now.',
  );
  expect(
    updateGroupSvgReviewV3(accepted, protectedContext, {
      ...review.identity,
      type: 'SvgDownloadRequested',
    }).payload,
  ).toBeNull();
  expect(
    updateGroupSvgReviewV3(
      accepted,
      { ...context, scope: 'replacement' },
      { ...review.identity, type: 'SvgDownloadRequested' },
    ).payload,
  ).toBeNull();
  const unsupported = { ...context, renderers: { nodes: 'unknown', edges: 'unknown' } } as const;
  expect(resolveGroupSvgReviewV3(accepted, unsupported).result?.type).toBe('blocked');
  expect(
    updateGroupSvgReviewV3(accepted, unsupported, {
      ...review.identity,
      type: 'SvgDownloadRequested',
    }).payload,
  ).toBeNull();
});
test('native consent resets for capability/camera, renderer bytes and settings; old download completions cannot settle a newer run', () => {
  const state = createSvgReview(context.scope),
    review = resolveGroupSvgReviewV3(state, context);
  const accepted = updateGroupSvgReviewV3(state, context, {
    ...review.identity,
    type: 'SvgLossAcceptanceChanged',
    accepted: true,
  }).state;
  for (const changed of [
    {
      ...context,
      document: captureGroupDocumentV3({ ...document, viewport: { x: 0, y: 0, zoom: 1 } }),
    },
    { ...context, theme: { colorScheme: 'dark' } },
    { ...context, sourceRevision: 1 },
  ] as const)
    expect(resolveGroupSvgReviewV3(accepted, changed).accepted).toBe(false);
  const requested = updateGroupSvgReviewV3(accepted, context, {
    ...review.identity,
    type: 'SvgDownloadRequested',
  });
  expect(requested.payload).not.toBeNull();
  expect(
    updateGroupSvgReviewV3(requested.state, context, {
      ...review.identity,
      type: 'SvgDownloadRequested',
    }).payload,
  ).toBeNull();
  const first = requested.payload!;
  const settled = updateGroupSvgReviewV3(requested.state, context, {
    ...first,
    type: 'SvgDownloadSettled',
    outcome: 'failed',
  });
  const retried = updateGroupSvgReviewV3(settled.state, context, {
    ...review.identity,
    type: 'SvgDownloadRequested',
  });
  expect(retried.payload?.run).toBe(first.run + 1);
  expect(
    updateGroupSvgReviewV3(retried.state, context, {
      ...first,
      type: 'SvgDownloadSettled',
      outcome: 'succeeded',
    }).state,
  ).toBe(retried.state);
  const changed = updateGroupSvgReviewV3(accepted, context, {
    ...review.identity,
    type: 'SvgSettingsChanged',
    preferences: { ...review.preferences, themeId: 'dark' },
  });
  expect(resolveGroupSvgReviewV3(changed.state, context).accepted).toBe(false);
  const unported = captureGroupDocumentV3({
    ...document,
    capabilities: { groupPorts: false },
    graph: { nodes: [], edges: [] },
  });
  const unportedContext = {
    ...context,
    document: unported,
    renderers: { nodes: 'built-in', edges: 'built-in' },
  } as const;
  const plain = resolveGroupSvgReviewV3(state, unportedContext);
  expect(
    resolveGroupSvgReviewV3(state, {
      ...unportedContext,
      document: captureGroupDocumentV3({ ...unported, capabilities: { groupPorts: true } }),
    }).identity.key,
  ).not.toBe(plain.identity.key);
});
test('adapter-produced bytes invalidate native acceptance even when renderer identity is reused', () => {
  const state = createSvgReview(context.scope);
  const configured = {
    ...context,
    renderers: {
      nodes: 'built-in',
      edges: 'built-in',
      overrides: [
        {
          target: { kind: 'node', id: 'g' },
          renderer: {
            type: 'svg',
            id: 'badge',
            version: '1',
            bounds: { x: 100, y: 80, width: 400, height: 300 },
            fidelity: 'approximate',
            reason: 'A static badge approximation.',
          },
        },
      ],
    },
    writing: {
      adapters: [
        {
          id: 'badge',
          version: '1',
          render: (): readonly ZlozSvgPrimitive[] => [
            { type: 'text', position: { x: 120, y: 100 }, text: 'Before' },
          ],
        },
      ],
    },
  } as const;
  const controls = resolveGroupSvgReviewV3(state, configured);
  const accepted = updateGroupSvgReviewV3(state, configured, {
    ...controls.identity,
    type: 'SvgLossAcceptanceChanged',
    accepted: true,
  }).state;
  const after = {
    ...configured,
    writing: {
      adapters: [
        {
          id: 'badge',
          version: '1',
          render: (): readonly ZlozSvgPrimitive[] => [
            { type: 'text', position: { x: 120, y: 100 }, text: 'After' },
          ],
        },
      ],
    },
  } as const;
  expect(resolveGroupSvgReviewV3(accepted, after).accepted).toBe(false);
  expect(
    updateGroupSvgReviewV3(accepted, after, { ...controls.identity, type: 'SvgDownloadRequested' })
      .payload,
  ).toBeNull();
});
