import { expect, test } from 'bun:test';
import assert from 'node:assert/strict';

import { createEventStormingPattern, eventStormingRelationshipRules } from '@opsydyn/foldkit-zloz';

import { resolveReviewPacketControls, resolveReviewPacketRequest } from '../src/index';

const graph = createEventStormingPattern();
const document = {
  id: 'orders',
  name: 'Orders',
  origin: null,
  snapshot: { graph, viewport: { x: 0, y: 0, zoom: 1 } },
  editions: [{ id: 'base', name: 'Baseline', snapshot: { graph } }],
};
const selection = { baselineId: 'base', selectedId: null };
const state = { consentKey: null };
test('loss preview requires explicit content-bound consent; fresh download is atomic and read-only', () => {
  const original = JSON.stringify(document);
  const context = resolveReviewPacketControls(document, selection, state);
  assert(context.key);
  expect(context.scopeText).toContain('Baseline');
  expect(context.scopeText).toContain('Current graph');
  expect(
    context.diagnostics.some(
      (item) => item.side === 'selected' && item.code === 'viewport-omitted',
    ),
  ).toBe(true);
  expect(context.downloadReason).toContain('consent');
  const download = { type: 'DownloadClicked' as const, key: context.key };
  expect(resolveReviewPacketRequest(document, selection, state, download).type).toBe('blocked');
  const consent = resolveReviewPacketRequest(document, selection, state, {
    type: 'ConsentChanged',
    key: context.key,
    accepted: true,
  });
  assert(consent.type === 'ready');
  const result = resolveReviewPacketRequest(document, selection, consent.state, download);
  assert(result.type === 'download');
  expect(result.packet.selected.source).toEqual({ kind: 'current' });
  expect(result.packet.projections.selected.source).toContain('flowchart LR');
  expect(JSON.stringify(document)).toBe(original);
  const revoked = resolveReviewPacketRequest(document, selection, consent.state, {
    type: 'ConsentChanged',
    key: context.key,
    accepted: false,
  });
  assert(revoked.type === 'ready');
  expect(resolveReviewPacketRequest(document, selection, revoked.state, download).type).toBe(
    'blocked',
  );
});
test('old consent and requests fail closed after source, viewport, convention or selection changes and live protection', () => {
  const context = resolveReviewPacketControls(document, selection, state);
  assert(context.key);
  const accepted = { consentKey: context.key };
  const request = { type: 'DownloadClicked' as const, key: context.key };
  for (const changed of [
    { ...document, name: 'Renamed' },
    { ...document, snapshot: { ...document.snapshot, viewport: { x: 5, y: 0, zoom: 1 } } },
    {
      ...document,
      snapshot: {
        ...document.snapshot,
        graph: { ...graph, nodes: graph.nodes.map((n) => ({ ...n, label: n.label + '!' })) },
      },
    },
    { ...document, editions: document.editions.map((e) => ({ ...e, name: 'New name' })) },
  ]) {
    expect(resolveReviewPacketControls(changed, selection, accepted).consented).toBe(false);
    expect(resolveReviewPacketRequest(changed, selection, accepted, request).type).toBe('blocked');
  }
  expect(
    resolveReviewPacketRequest(document, { ...selection, selectedId: 'base' }, accepted, request)
      .type,
  ).toBe('blocked');
  expect(
    resolveReviewPacketRequest(document, selection, accepted, request, { direction: 'TB' }).type,
  ).toBe('blocked');
  expect(
    resolveReviewPacketRequest(document, selection, accepted, request, {
      rules: [...eventStormingRelationshipRules].reverse(),
    }).type,
  ).toBe('blocked');
  const busy = resolveReviewPacketRequest(document, selection, accepted, request, {
    blockedReason: 'Finish editing',
  });
  expect(busy).toEqual({ type: 'blocked', reason: 'Finish editing' });
  const hidden = resolveReviewPacketControls(
    document,
    { baselineId: null, selectedId: null },
    accepted,
  );
  expect(hidden.key).toBeNull();
  expect(hidden.reason).toContain('baseline');
  const missing = resolveReviewPacketControls(
    document,
    { ...selection, baselineId: 'missing' },
    accepted,
  );
  expect(missing.key).toBeNull();
  expect(missing.diagnostics[0]?.severity).toBe('error');
});
test('empty loss-free projections download without consent; unrelated history does not change the selected packet', () => {
  const empty = {
    ...document,
    snapshot: { graph: { nodes: [], edges: [] } },
    editions: [{ id: 'base', name: 'Baseline', snapshot: { graph: { nodes: [], edges: [] } } }],
  };
  const context = resolveReviewPacketControls(empty, selection, state);
  assert(context.key);
  expect(context.requiresConsent).toBe(false);
  expect(
    resolveReviewPacketRequest(empty, selection, state, {
      type: 'DownloadClicked',
      key: context.key,
    }).type,
  ).toBe('download');
  const expanded = {
    ...empty,
    editions: [...empty.editions, { id: 'unrelated', name: 'Other', snapshot: { graph } }],
  };
  expect(resolveReviewPacketControls(expanded, selection, state).key).toBe(context.key);
});

test('projection errors cannot be consented away or downloaded', () => {
  const group = {
    id: 'empty',
    label: 'Empty group',
    kind: 'group' as const,
    position: { x: 0, y: 0 },
    size: { width: 200, height: 100 },
    ports: [],
  };
  const invalid = { ...document, snapshot: { graph: { nodes: [group], edges: [] } } };
  const context = resolveReviewPacketControls(invalid, selection, { consentKey: 'forged' });
  expect(context.packet).toBeNull();
  expect(
    context.diagnostics.some((item) => item.side === 'selected' && item.severity === 'error'),
  ).toBe(true);
  expect(
    resolveReviewPacketRequest(
      invalid,
      selection,
      { consentKey: 'forged' },
      { type: 'DownloadClicked', key: 'forged' },
    ).type,
  ).toBe('blocked');
});
