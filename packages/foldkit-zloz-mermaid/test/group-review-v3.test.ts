import { expect, test } from 'bun:test';

import { captureGroupDocumentV3 } from '@opsydyn/foldkit-zloz';

import wire from '../../foldkit-zloz/test/fixtures/group-document-v3-ported.json';
import {
  createGroupMermaidReviewV3,
  resolveGroupMermaidReviewV3,
  updateGroupMermaidReviewV3,
  groupMermaidReviewForScopeV3,
} from '../src/index';
const context = () => ({
  scope: 'native:mermaid',
  sourceRevision: 0,
  document: captureGroupDocumentV3(wire),
});
test('exact native output consent gates detached downloads; live policy is rerun and publication changes no source', () => {
  const ctx = context(),
    initial = createGroupMermaidReviewV3(ctx.scope),
    controls = resolveGroupMermaidReviewV3(initial, ctx);
  expect(controls.hasLosses).toBe(true);
  expect(controls.accepted).toBe(false);
  expect(
    updateGroupMermaidReviewV3(initial, ctx, {
      ...controls.identity,
      type: 'MermaidDownloadRequested',
    }).payload,
  ).toBeNull();
  const accepted = updateGroupMermaidReviewV3(initial, ctx, {
    ...controls.identity,
    type: 'MermaidLossAcceptanceChanged',
    accepted: true,
  }).state;
  const denied = updateGroupMermaidReviewV3(
    accepted,
    { ...ctx, canDownload: () => 'Exports protected.' },
    { ...controls.identity, type: 'MermaidDownloadRequested' },
  );
  expect(denied.payload).toBeNull();
  expect(denied.notice).toBe('Exports protected.');
  const download = updateGroupMermaidReviewV3(accepted, ctx, {
    ...controls.identity,
    type: 'MermaidDownloadRequested',
  });
  if (controls.result.status !== 'converted') throw new Error('Expected reviewed projection');
  expect(download.payload?.bundle).toEqual(controls.result.value);
  expect(download.payload?.text).toBe(JSON.stringify(download.payload?.bundle, null, 2) + '\n');
  expect(download.payload?.fileName).toBe('zloz-native-v3.mermaid.json');
  expect(download.state.download.type).toBe('pending');
  expect(
    updateGroupMermaidReviewV3(download.state, ctx, {
      ...controls.identity,
      type: 'MermaidDownloadRequested',
    }).payload,
  ).toBeNull();
  const settled = updateGroupMermaidReviewV3(download.state, ctx, {
    ...controls.identity,
    type: 'MermaidDownloadSettled',
    run: 1,
    outcome: 'failed',
  });
  expect(settled.state.download.type).toBe('idle');
  expect(settled.notice).toContain('failed');
  expect(
    updateGroupMermaidReviewV3(settled.state, ctx, {
      ...controls.identity,
      type: 'MermaidDownloadRequested',
    }).payload?.run,
  ).toBe(2);
  expect(ctx.sourceRevision).toBe(0);
  expect(ctx.document.graph.nodes).toHaveLength(3);
});
test('scope, revision, complete graph, camera, mode, capability, settings and stale runs never inherit consent', () => {
  const ctx = context(),
    initial = createGroupMermaidReviewV3(ctx.scope),
    controls = resolveGroupMermaidReviewV3(initial, ctx),
    accept = {
      ...controls.identity,
      type: 'MermaidLossAcceptanceChanged',
      accepted: true,
    } as const;
  const accepted = updateGroupMermaidReviewV3(initial, ctx, accept).state;
  for (const changed of [
    { ...ctx, sourceRevision: 1 },
    { ...ctx, scope: 'replacement:mermaid' },
    { ...ctx, document: { ...ctx.document, viewport: { x: 20, y: 10, zoom: 1 } } },
    { ...ctx, document: { ...ctx.document, connectionMode: 'loose' as const } },
    {
      ...ctx,
      document: {
        ...ctx.document,
        graph: {
          ...ctx.document.graph,
          nodes: ctx.document.graph.nodes.map((n) => ({ ...n, data: { changed: true } })),
        },
      },
    },
  ]) {
    expect(resolveGroupMermaidReviewV3(accepted, changed).accepted).toBe(false);
    expect(
      updateGroupMermaidReviewV3(accepted, changed, {
        ...controls.identity,
        type: 'MermaidDownloadRequested',
      }).payload,
    ).toBeNull();
  }
  const settings = updateGroupMermaidReviewV3(accepted, ctx, {
    ...controls.identity,
    type: 'MermaidDirectionChanged',
    direction: 'TB',
  }).state;
  const next = resolveGroupMermaidReviewV3(settings, ctx);
  expect(next.accepted).toBe(false);
  expect(next.identity.generation).toBe(1);
  expect(updateGroupMermaidReviewV3(settings, ctx, accept).state).toBe(settings);
  const pending = updateGroupMermaidReviewV3(accepted, ctx, {
    ...controls.identity,
    type: 'MermaidDownloadRequested',
  });
  expect(
    updateGroupMermaidReviewV3(pending.state, ctx, {
      ...controls.identity,
      type: 'MermaidDownloadSettled',
      run: 99,
      outcome: 'succeeded',
    }).state,
  ).toBe(pending.state);
  expect(groupMermaidReviewForScopeV3(accepted, 'edition:mermaid').lossKey).toBeNull();
});
test('invalid projections stay blocked with no consentable partial value and policy defects are not swallowed', () => {
  const ctx = context(),
    state = createGroupMermaidReviewV3(ctx.scope);
  const invalid = {
    ...ctx,
    document: {
      ...ctx.document,
      graph: {
        nodes: ctx.document.graph.nodes.filter((n) => n.id !== 'child'),
        edges: ctx.document.graph.edges,
      },
    },
  };
  const controls = resolveGroupMermaidReviewV3(state, invalid);
  expect(controls.reason).toContain('cannot be projected');
  expect(controls.result?.status).toBe('rejected');
  expect(
    updateGroupMermaidReviewV3(state, invalid, {
      ...controls.identity,
      type: 'MermaidLossAcceptanceChanged',
      accepted: true,
    }).state.lossKey,
  ).toBeNull();
  expect(() =>
    resolveGroupMermaidReviewV3(state, {
      ...ctx,
      canDownload: () => {
        throw new Error('policy defect');
      },
    }),
  ).toThrow('policy defect');
});
test('capability-only changes and returning direction settings do not reuse old review facts', () => {
  const original = context(),
    doc = captureGroupDocumentV3({
      ...original.document,
      graph: {
        ...original.document.graph,
        nodes: original.document.graph.nodes.map((n) => ({ ...n, ports: [] })),
        edges: [],
      },
    }),
    ctx = { ...original, document: doc };
  const initial = createGroupMermaidReviewV3(ctx.scope),
    controls = resolveGroupMermaidReviewV3(initial, ctx),
    accepted = updateGroupMermaidReviewV3(initial, ctx, {
      ...controls.identity,
      type: 'MermaidLossAcceptanceChanged',
      accepted: true,
    }).state;
  const changed = { ...ctx, document: { ...doc, capabilities: { groupPorts: false } } };
  expect(resolveGroupMermaidReviewV3(accepted, changed).accepted).toBe(false);
  expect(
    updateGroupMermaidReviewV3(accepted, changed, {
      ...controls.identity,
      type: 'MermaidDownloadRequested',
    }).payload,
  ).toBeNull();
  const tb = updateGroupMermaidReviewV3(accepted, ctx, {
      ...controls.identity,
      type: 'MermaidDirectionChanged',
      direction: 'TB',
    }).state,
    tbControls = resolveGroupMermaidReviewV3(tb, ctx);
  const lr = updateGroupMermaidReviewV3(tb, ctx, {
    ...tbControls.identity,
    type: 'MermaidDirectionChanged',
    direction: 'LR',
  }).state;
  expect(resolveGroupMermaidReviewV3(lr, ctx).accepted).toBe(false);
  expect(
    updateGroupMermaidReviewV3(lr, ctx, {
      ...controls.identity,
      type: 'MermaidLossAcceptanceChanged',
      accepted: true,
    }).state,
  ).toBe(lr);
});

test('late within-scope download settlement cannot overwrite newer review feedback', () => {
  const ctx = context(),
    initial = createGroupMermaidReviewV3(ctx.scope),
    controls = resolveGroupMermaidReviewV3(initial, ctx),
    accepted = updateGroupMermaidReviewV3(initial, ctx, {
      ...controls.identity,
      type: 'MermaidLossAcceptanceChanged',
      accepted: true,
    }).state;
  const pending = updateGroupMermaidReviewV3(accepted, ctx, {
    ...controls.identity,
    type: 'MermaidDownloadRequested',
  });
  const result = updateGroupMermaidReviewV3(
    pending.state,
    { ...ctx, sourceRevision: 1 },
    { ...controls.identity, type: 'MermaidDownloadSettled', run: 1, outcome: 'succeeded' },
  );
  expect(result.state).toBe(pending.state);
  expect(result.notice).toBe('');
  expect(result.payload).toBeNull();
});
