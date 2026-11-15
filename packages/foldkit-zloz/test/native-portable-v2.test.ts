import { expect, test } from 'bun:test';

import {
  captureModellingPatchV2,
  parseModellingPatchV2,
  parseModellingPatch,
  dryRunModellingPatchV2,
  resolveModellingPatchReviewV2,
  applyModellingPatchV2,
  createModelEditorV2,
  updateEditor,
  parseConnectionDocument,
  auditConnectionDddRelationships,
  auditConnectionEventStormingRelationships,
  compareModelDddRelationshipsV2,
  compareModelEventStormingRelationshipsV2,
  parseModellingPatchReceiptV2,
  serializeModellingPatchReceiptV2,
} from '../src/index';
import wire from './fixtures/connection-v2-loose.json';
const snapshot = parseConnectionDocument(JSON.stringify(wire));
const model = {
  id: 'm',
  name: 'M',
  snapshot,
  editions: [{ id: 'base', name: 'Base', snapshot }],
  origin: null,
};
const source = {
  modelId: 'm',
  sessionId: 's',
  revision: 0,
  connectionMode: snapshot.connectionMode,
  graph: snapshot.graph,
};
const proposal = {
  format: 'foldkit-zloz-patch',
  version: 2,
  id: 'p',
  source,
  provenance: { actor: { kind: 'agent', id: 'agent' }, reason: 'Rename', references: [] },
  operations: [
    { id: 'rename', type: 'node.replace', node: { ...snapshot.graph.nodes[0], label: 'Renamed' } },
  ],
};

test('native v2 patch owns mode, exact review and one Undo; v1 decoder stays closed', () => {
  const patch = captureModellingPatchV2(proposal);
  expect(parseModellingPatch(JSON.stringify(patch))).toMatchObject({
    status: 'rejected',
    code: 'unsupported-version',
  });
  expect(parseModellingPatchV2(JSON.stringify(patch)).status).toBe('parsed');
  expect(
    parseModellingPatchV2(JSON.stringify(patch).replace('"version":2', '"version":2,"version":2')),
  ).toMatchObject({ status: 'rejected', code: 'invalid-json' });
  expect(dryRunModellingPatchV2(source, patch).type).toBe('reviewable');
  const editor = createModelEditorV2(model);
  const identity = { modelId: 'm', sessionId: 's' };
  const review = resolveModellingPatchReviewV2(editor, identity, patch);
  expect(review.key).not.toBeNull();
  const options = {
    consent: { key: review.key!, reviewed: true as const, lossesAccepted: true as const },
  };
  const applied = applyModellingPatchV2(editor, identity, patch, options);
  expect(applied.type).toBe('applied');
  if (applied.type !== 'applied') throw new Error('Expected Apply');
  expect(applied.editor.connectionMode).toBe('loose');
  expect(applied.editor.graph.edges).toEqual(snapshot.graph.edges);
  expect(updateEditor(applied.editor, { type: 'UndoPressed' }).graph).toEqual(editor.graph);
  expect(parseModellingPatchReceiptV2(serializeModellingPatchReceiptV2(applied.receipt))).toEqual(
    applied.receipt,
  );
  expect(
    applyModellingPatchV2(editor, identity, patch, {
      ...options,
      policy: {
        canMoveNode: () => 'Protected',
        canChangeNodeAppearance: () => 'Protected',
        canDelete: () => 'Protected',
      },
      blockedReason: 'Busy',
    }).type,
  ).toBe('blocked');
  expect(applyModellingPatchV2(applied.editor, identity, patch, options).type).toBe('blocked');
});
test('v2 audits validate explicit mode while domain meaning remains independent from port direction', () => {
  expect(auditConnectionDddRelationships(snapshot).summary.unrelated).toBe(1);
  expect(auditConnectionEventStormingRelationships(snapshot).summary.unrelated).toBe(1);
  for (const compare of [
    compareModelDddRelationshipsV2,
    compareModelEventStormingRelationshipsV2,
  ]) {
    const result = compare(model, { baselineId: 'base' });
    expect(result.type).toBe('compared');
    if (result.type === 'compared') expect(result.comparison.baseline.connectionMode).toBe('loose');
  }
  expect(() =>
    auditConnectionDddRelationships({ ...snapshot, connectionMode: 'strict' }),
  ).toThrow();
});

test('v2 patch checks live loose port policies, source mode freshness and raw getter ownership', () => {
  const patch = captureModellingPatchV2({
    ...proposal,
    operations: [
      {
        id: 'reverse',
        type: 'edge.add',
        edge: {
          id: 'reverse',
          source: { node: 'b', port: 'shared' },
          target: { node: 'a', port: 'shared' },
        },
      },
    ],
  });
  const editor = createModelEditorV2(model),
    identity = { modelId: 'm', sessionId: 's' };
  const review = resolveModellingPatchReviewV2(editor, identity, patch);
  if (!review.key) throw new Error('Review missing');
  const options = {
    consent: { key: review.key, reviewed: true as const, lossesAccepted: true as const },
  };
  const blocked = applyModellingPatchV2(editor, identity, patch, {
    ...options,
    policy: { canConnectPort: () => 'Socket locked' },
  });
  expect(blocked).toMatchObject({ type: 'blocked', reason: 'Socket locked', editor });
  const applied = applyModellingPatchV2(editor, identity, patch, options);
  expect(applied.type).toBe('applied');
  if (applied.type === 'applied') {
    const tampered = JSON.parse(serializeModellingPatchReceiptV2(applied.receipt));
    tampered.revision++;
    expect(() => parseModellingPatchReceiptV2(JSON.stringify(tampered))).toThrow();
  }
  const strictGraph = { ...source.graph, edges: [] };
  const loosePatch = captureModellingPatchV2({
    ...proposal,
    source: { ...source, graph: strictGraph },
  });
  expect(
    dryRunModellingPatchV2({ ...source, graph: strictGraph, connectionMode: 'strict' }, loosePatch),
  ).toMatchObject({ type: 'rejected', findings: [{ code: 'source-changed' }] });
  let reads = 0;
  const authored = { ...source };
  Object.defineProperty(authored, 'connectionMode', {
    enumerable: true,
    get: () => {
      reads++;
      return 'loose';
    },
  });
  expect(() => dryRunModellingPatchV2(authored, patch)).toThrow();
  expect(reads).toBe(0);
});
